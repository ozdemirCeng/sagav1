using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace Saga.Server.Services;

/// <summary>
/// HuggingFace Spaces üzerindeki AI microservice ile iletişim
/// Semantic search için embedding + FAISS kullanır
/// </summary>
public interface ISemanticSearchService
{
    Task<List<SemanticSearchResult>> SearchAsync(string query, int limit = 5, string? tur = null, CancellationToken cancellationToken = default);
    Task<bool> IndexContentsAsync(List<SemanticContent> contents, CancellationToken cancellationToken = default);
    Task<bool> IsHealthyAsync(CancellationToken cancellationToken = default);
    Task<IdentifyResult?> IdentifyContentAsync(string description, string? tur = null, CancellationToken cancellationToken = default);
    
    // Yeni AI Chat metodları
    Task<ChatResult> ChatAsync(List<ChatMessageDto> messages, string? context = null, CancellationToken cancellationToken = default);
    Task<ContentAnswerResult> AskAboutContentAsync(string contentTitle, string contentType, string question, string? description = null, CancellationToken cancellationToken = default);
    Task<AssistantResult> AskAssistantAsync(string query, string? currentPage = null, object? userContext = null, List<ChatMessage>? chatHistory = null, CancellationToken cancellationToken = default);
    Task<SummaryResult> GetContentSummaryAsync(string contentTitle, string contentType, bool spoilerFree = true, CancellationToken cancellationToken = default);
}

public class SemanticSearchService : ISemanticSearchService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<SemanticSearchService> _logger;
    private readonly string _baseUrl;

    public SemanticSearchService(HttpClient httpClient, ILogger<SemanticSearchService> logger, IConfiguration configuration)
    {
        _httpClient = httpClient;
        _logger = logger;
        _baseUrl = configuration["AI:SemanticSearchUrl"] ?? "https://ozdemirceng-saga-semantic.hf.space";
        
        _httpClient.BaseAddress = new Uri(_baseUrl);
        _httpClient.Timeout = TimeSpan.FromSeconds(120); // LLM için 2 dakika
    }

    public async Task<List<SemanticSearchResult>> SearchAsync(string query, int limit = 5, string? tur = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var request = new SemanticSearchRequest
            {
                Query = query,
                Limit = limit,
                Tur = tur
            };

            var response = await _httpClient.PostAsJsonAsync("/search", request, cancellationToken);
            
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Semantic search başarısız: {StatusCode}", response.StatusCode);
                return new List<SemanticSearchResult>();
            }

            var result = await response.Content.ReadFromJsonAsync<SemanticSearchResponse>(cancellationToken: cancellationToken);
            return result?.Results ?? new List<SemanticSearchResult>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Semantic search hatası: {Query}", query);
            return new List<SemanticSearchResult>();
        }
    }

    public async Task<bool> IndexContentsAsync(List<SemanticContent> contents, CancellationToken cancellationToken = default)
    {
        try
        {
            var request = new SemanticIndexRequest { Contents = contents };
            var response = await _httpClient.PostAsJsonAsync("/index", request, cancellationToken);
            
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Semantic index güncellendi: {Count} içerik", contents.Count);
                return true;
            }
            
            _logger.LogWarning("Semantic index başarısız: {StatusCode}", response.StatusCode);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Semantic index hatası");
            return false;
        }
    }

    public async Task<bool> IsHealthyAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _httpClient.GetAsync("/", cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    public async Task<IdentifyResult?> IdentifyContentAsync(string description, string? tur = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var request = new IdentifyRequest
            {
                Description = description,
                Tur = tur
            };

            // LLM yüklemesi zaman alabilir, timeout'u artır
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromMinutes(3));

            var response = await _httpClient.PostAsJsonAsync("/identify", request, cts.Token);
            
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(cts.Token);
                _logger.LogWarning("Identify başarısız: {StatusCode} - {Error}", response.StatusCode, error);
                return null;
            }

            var result = await response.Content.ReadFromJsonAsync<IdentifyResult>(cancellationToken: cts.Token);
            return result;
        }
        catch (TaskCanceledException)
        {
            _logger.LogWarning("Identify timeout: LLM henüz yükleniyor olabilir");
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Identify hatası: {Description}", description);
            return null;
        }
    }

    public async Task<ChatResult> ChatAsync(List<ChatMessageDto> messages, string? context = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var request = new ChatRequest
            {
                Messages = messages,
                Context = context,
                MaxTokens = 500
            };

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(120)); // LLM için 2 dakika timeout

            var response = await _httpClient.PostAsJsonAsync("/chat", request, cts.Token);
            
            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync(cts.Token);
                _logger.LogWarning("Chat başarısız: {StatusCode} - {Error}", response.StatusCode, error);
                return new ChatResult { Message = "AI şu anda yanıt veremiyor. Lütfen tekrar deneyin." };
            }

            var result = await response.Content.ReadFromJsonAsync<ChatResult>(cancellationToken: cts.Token);
            return result ?? new ChatResult { Message = "Yanıt alınamadı." };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Chat hatası");
            return new ChatResult { Message = "Bir hata oluştu. Lütfen tekrar deneyin." };
        }
    }

    public async Task<ContentAnswerResult> AskAboutContentAsync(string contentTitle, string contentType, string question, string? description = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var request = new ContentQuestionRequest
            {
                ContentTitle = contentTitle,
                ContentType = contentType,
                Question = question,
                ContentDescription = description
            };

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(120)); // LLM için 2 dakika timeout

            var response = await _httpClient.PostAsJsonAsync("/content-question", request, cts.Token);
            
            if (!response.IsSuccessStatusCode)
            {
                return new ContentAnswerResult { Answer = "Şu anda bu içerik hakkında bilgi sağlanamıyor." };
            }

            var result = await response.Content.ReadFromJsonAsync<ContentAnswerResult>(cancellationToken: cts.Token);
            return result ?? new ContentAnswerResult { Answer = "Yanıt alınamadı." };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Content question hatası: {Title}", contentTitle);
            return new ContentAnswerResult { Answer = "Bir hata oluştu." };
        }
    }

    public async Task<AssistantResult> AskAssistantAsync(string query, string? currentPage = null, object? userContext = null, List<ChatMessage>? chatHistory = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var request = new AssistantRequest
            {
                Query = query,
                CurrentPage = currentPage,
                UserContext = userContext,
                ChatHistory = chatHistory
            };

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(120)); // LLM için 2 dakika timeout

            var response = await _httpClient.PostAsJsonAsync("/assistant", request, cts.Token);
            
            if (!response.IsSuccessStatusCode)
            {
                return new AssistantResult { Message = "Asistan şu anda yanıt veremiyor." };
            }

            var result = await response.Content.ReadFromJsonAsync<AssistantResult>(cancellationToken: cts.Token);
            return result ?? new AssistantResult { Message = "Yanıt alınamadı." };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Assistant hatası: {Query}", query);
            return new AssistantResult { Message = "Bir hata oluştu." };
        }
    }

    public async Task<SummaryResult> GetContentSummaryAsync(string contentTitle, string contentType, bool spoilerFree = true, CancellationToken cancellationToken = default)
    {
        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(120)); // LLM için 2 dakika timeout

            var url = $"/summarize?content_title={Uri.EscapeDataString(contentTitle)}&content_type={Uri.EscapeDataString(contentType)}&spoiler_free={spoilerFree}";
            var response = await _httpClient.PostAsync(url, null, cts.Token);
            
            if (!response.IsSuccessStatusCode)
            {
                return new SummaryResult { Summary = "Özet şu anda alınamıyor." };
            }

            var result = await response.Content.ReadFromJsonAsync<SummaryResult>(cancellationToken: cts.Token);
            return result ?? new SummaryResult { Summary = "Özet alınamadı." };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Summary hatası: {Title}", contentTitle);
            return new SummaryResult { Summary = "Bir hata oluştu." };
        }
    }
}

// DTOs
public class SemanticSearchRequest
{
    [JsonPropertyName("query")]
    public string Query { get; set; } = "";
    
    [JsonPropertyName("limit")]
    public int Limit { get; set; } = 5;
    
    [JsonPropertyName("tur")]
    public string? Tur { get; set; }
}

public class SemanticSearchResponse
{
    [JsonPropertyName("results")]
    public List<SemanticSearchResult> Results { get; set; } = new();
    
    [JsonPropertyName("query")]
    public string Query { get; set; } = "";
    
    [JsonPropertyName("total")]
    public int Total { get; set; }
}

public class SemanticSearchResult
{
    [JsonPropertyName("id")]
    public long Id { get; set; }
    
    [JsonPropertyName("baslik")]
    public string Baslik { get; set; } = "";
    
    [JsonPropertyName("tur")]
    public string Tur { get; set; } = "";
    
    [JsonPropertyName("aciklama")]
    public string Aciklama { get; set; } = "";
    
    [JsonPropertyName("yil")]
    public int? Yil { get; set; }
    
    [JsonPropertyName("posterUrl")]
    public string? PosterUrl { get; set; }
    
    [JsonPropertyName("puan")]
    public double? Puan { get; set; }
    
    [JsonPropertyName("score")]
    public double Score { get; set; }
    
    [JsonPropertyName("neden")]
    public string Neden { get; set; } = "";
}

public class SemanticIndexRequest
{
    [JsonPropertyName("contents")]
    public List<SemanticContent> Contents { get; set; } = new();
}

public class SemanticContent
{
    [JsonPropertyName("id")]
    public long Id { get; set; }
    
    [JsonPropertyName("baslik")]
    public string Baslik { get; set; } = "";
    
    [JsonPropertyName("tur")]
    public string Tur { get; set; } = "";
    
    [JsonPropertyName("aciklama")]
    public string Aciklama { get; set; } = "";
    
    [JsonPropertyName("yil")]
    public int? Yil { get; set; }
    
    [JsonPropertyName("posterUrl")]
    public string? PosterUrl { get; set; }
    
    [JsonPropertyName("puan")]
    public double? Puan { get; set; }
}

// Identify DTOs
public class IdentifyRequest
{
    [JsonPropertyName("description")]
    public string Description { get; set; } = "";
    
    [JsonPropertyName("tur")]
    public string? Tur { get; set; }
}

public class IdentifyResult
{
    [JsonPropertyName("found")]
    public bool Found { get; set; }
    
    [JsonPropertyName("title")]
    public string Title { get; set; } = "";
    
    [JsonPropertyName("title_en")]
    public string? TitleEn { get; set; }
    
    [JsonPropertyName("tur")]
    public string Tur { get; set; } = "film";
    
    [JsonPropertyName("year")]
    public int? Year { get; set; }
    
    [JsonPropertyName("explanation")]
    public string Explanation { get; set; } = "";
    
    [JsonPropertyName("confidence")]
    public double Confidence { get; set; }
    
    [JsonPropertyName("search_query")]
    public string SearchQuery { get; set; } = "";
}

// ===== YENİ: AI Chat DTOs =====
public class ChatMessageDto
{
    [JsonPropertyName("role")]
    public string Role { get; set; } = "user";
    
    [JsonPropertyName("content")]
    public string Content { get; set; } = "";
}

public class ChatRequest
{
    [JsonPropertyName("messages")]
    public List<ChatMessageDto> Messages { get; set; } = new();
    
    [JsonPropertyName("context")]
    public string? Context { get; set; }
    
    [JsonPropertyName("max_tokens")]
    public int MaxTokens { get; set; } = 500;
}

public class ChatResult
{
    [JsonPropertyName("message")]
    public string Message { get; set; } = "";
    
    [JsonPropertyName("suggestions")]
    public List<string>? Suggestions { get; set; }
}

public class ContentQuestionRequest
{
    [JsonPropertyName("content_id")]
    public int? ContentId { get; set; }
    
    [JsonPropertyName("content_title")]
    public string ContentTitle { get; set; } = "";
    
    [JsonPropertyName("content_type")]
    public string ContentType { get; set; } = "";
    
    [JsonPropertyName("content_description")]
    public string? ContentDescription { get; set; }
    
    [JsonPropertyName("question")]
    public string Question { get; set; } = "";
}

public class ContentAnswerResult
{
    [JsonPropertyName("answer")]
    public string Answer { get; set; } = "";
    
    [JsonPropertyName("related_questions")]
    public List<string>? RelatedQuestions { get; set; }
}

public class AssistantRequest
{
    [JsonPropertyName("query")]
    public string Query { get; set; } = "";
    
    [JsonPropertyName("current_page")]
    public string? CurrentPage { get; set; }
    
    [JsonPropertyName("user_context")]
    public object? UserContext { get; set; }
    
    [JsonPropertyName("chat_history")]
    public List<ChatMessage>? ChatHistory { get; set; }
}

public class ChatMessage
{
    [JsonPropertyName("role")]
    public string Role { get; set; } = "";
    
    [JsonPropertyName("content")]
    public string Content { get; set; } = "";
}

public class AssistantResult
{
    [JsonPropertyName("message")]
    public string Message { get; set; } = "";
    
    [JsonPropertyName("action")]
    public string? Action { get; set; }
    
    [JsonPropertyName("action_data")]
    public Dictionary<string, object>? ActionData { get; set; }
    
    [JsonPropertyName("suggestions")]
    public List<string>? Suggestions { get; set; }
}

public class SummaryResult
{
    [JsonPropertyName("title")]
    public string? Title { get; set; }
    
    [JsonPropertyName("type")]
    public string? Type { get; set; }
    
    [JsonPropertyName("summary")]
    public string Summary { get; set; } = "";
    
    [JsonPropertyName("spoiler_free")]
    public bool SpoilerFree { get; set; } = true;
}
