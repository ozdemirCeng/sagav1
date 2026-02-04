using System.Net.Http.Json;
using System.Text.Json;
using Saga.Server.Models;

namespace Saga.Server.Services
{
    public interface ILocalAiService
    {
        Task<string?> GenerateAnswerAsync(string query, List<AiCandidate> candidates, CancellationToken cancellationToken = default);
        Task<string?> GenerateTextAsync(string systemPrompt, string userPrompt, CancellationToken cancellationToken = default);
    }

    public class LocalAiService : ILocalAiService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<LocalAiService> _logger;

        public LocalAiService(HttpClient httpClient, IConfiguration configuration, ILogger<LocalAiService> logger)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<string?> GenerateAnswerAsync(string query, List<AiCandidate> candidates, CancellationToken cancellationToken = default)
        {
            var baseUrl = _configuration["LocalAi:BaseUrl"];
            var model = _configuration["LocalAi:Model"] ?? "phi-3-mini";
            var temperature = double.TryParse(_configuration["LocalAi:Temperature"], out var tempVal) ? tempVal : 0.2;
            var maxTokens = int.TryParse(_configuration["LocalAi:MaxTokens"], out var maxVal) ? maxVal : 300;

            if (string.IsNullOrWhiteSpace(baseUrl))
            {
                return null;
            }

            _httpClient.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");

            var systemPrompt = "Sen Saga platformunun yerel yapay zekasısın. Kullanıcı bir film/kitap/dizi anlatımı yapar. Aşağıda verilen aday listesi DIŞINA çıkma. En uygun tek sonucu seç ve kısa, net bir Türkçe cevap ver. Eğer adaylar yetersizse 'Bulamadım' de.";
            var candidateJson = JsonSerializer.Serialize(candidates.Select(c => new
            {
                id = c.Id,
                baslik = c.Baslik,
                tur = c.Tur.ToString(),
                yayinTarihi = c.YayinTarihi?.ToString("yyyy-MM-dd"),
                aciklama = c.Aciklama
            }));

            var userPrompt = $"Kullanıcı sorusu: {query}\nAdaylar: {candidateJson}";

            var payload = new
            {
                model,
                temperature,
                max_tokens = maxTokens,
                messages = new[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = userPrompt }
                }
            };

            try
            {
                var response = await _httpClient.PostAsJsonAsync("v1/chat/completions", payload, cancellationToken);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Local AI isteği başarısız: {StatusCode}", response.StatusCode);
                    return null;
                }

                var json = await response.Content.ReadAsStringAsync(cancellationToken);
                using var doc = JsonDocument.Parse(json);
                var content = doc.RootElement
                    .GetProperty("choices")[0]
                    .GetProperty("message")
                    .GetProperty("content")
                    .GetString();

                return string.IsNullOrWhiteSpace(content) ? null : content.Trim();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Local AI çağrısı başarısız");
                return null;
            }
        }

        public async Task<string?> GenerateTextAsync(string systemPrompt, string userPrompt, CancellationToken cancellationToken = default)
        {
            var baseUrl = _configuration["LocalAi:BaseUrl"];
            var model = _configuration["LocalAi:Model"] ?? "phi-3-mini";
            var temperature = double.TryParse(_configuration["LocalAi:Temperature"], out var tempVal) ? tempVal : 0.2;
            var maxTokens = int.TryParse(_configuration["LocalAi:MaxTokens"], out var maxVal) ? maxVal : 400;

            if (string.IsNullOrWhiteSpace(baseUrl))
            {
                return null;
            }

            _httpClient.BaseAddress = new Uri(baseUrl.TrimEnd('/') + "/");

            var payload = new
            {
                model,
                temperature,
                max_tokens = maxTokens,
                messages = new[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = userPrompt }
                }
            };

            try
            {
                var response = await _httpClient.PostAsJsonAsync("v1/chat/completions", payload, cancellationToken);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Local AI metin isteği başarısız: {StatusCode}", response.StatusCode);
                    return null;
                }

                var json = await response.Content.ReadAsStringAsync(cancellationToken);
                using var doc = JsonDocument.Parse(json);
                var content = doc.RootElement
                    .GetProperty("choices")[0]
                    .GetProperty("message")
                    .GetProperty("content")
                    .GetString();

                return string.IsNullOrWhiteSpace(content) ? null : content.Trim();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Local AI metin çağrısı başarısız");
                return null;
            }
        }
    }

    public class AiCandidate
    {
        public long Id { get; set; }
        public string Baslik { get; set; } = "";
        public IcerikTuru Tur { get; set; }
        public DateOnly? YayinTarihi { get; set; }
        public string? Aciklama { get; set; }
        public string? PosterUrl { get; set; }
    }
}
