using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace Saga.Server.Services
{
    public interface IGroqService
    {
        Task<string?> GenerateTextAsync(string systemPrompt, string userPrompt, CancellationToken cancellationToken = default);
        Task<string?> GenerateYearlySummaryAsync(YearlySummaryData data, CancellationToken cancellationToken = default);
        bool IsConfigured { get; }
    }

    public class YearlySummaryData
    {
        public int ToplamFilm { get; set; }
        public int ToplamDizi { get; set; }
        public int ToplamKitap { get; set; }
        public int ToplamSaatFilm { get; set; }
        public int ToplamSaatDizi { get; set; }
        public int ToplamSayfaKitap { get; set; }
        public List<string> EnSevdigiTurler { get; set; } = new();
        public List<string> EnCokIzledigiFavFilmler { get; set; } = new();
        public List<string> EnCokIzledigiFavDiziler { get; set; } = new();
        public List<string> EnCokOkuduguFavKitaplar { get; set; } = new();
        public int Yil { get; set; } = DateTime.Now.Year;
        public double OrtalamaFilmPuani { get; set; }
        public double OrtalamaDiziPuani { get; set; }
        public double OrtalamaKitapPuani { get; set; }
        public string EnAktifAy { get; set; } = "";
    }

    public class GroqService : IGroqService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<GroqService> _logger;
        private readonly string? _apiKey;
        private readonly string _model;

        public GroqService(HttpClient httpClient, IConfiguration configuration, ILogger<GroqService> logger)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
            _apiKey = _configuration["Groq:ApiKey"];
            _model = _configuration["Groq:Model"] ?? "llama-3.3-70b-versatile";
        }

        public bool IsConfigured => !string.IsNullOrWhiteSpace(_apiKey) && !_apiKey.StartsWith("${");

        public async Task<string?> GenerateTextAsync(string systemPrompt, string userPrompt, CancellationToken cancellationToken = default)
        {
            if (!IsConfigured)
            {
                _logger.LogDebug("Groq API yapılandırılmamış, atlanıyor");
                return null;
            }

            var payload = new
            {
                model = _model,
                messages = new[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = userPrompt }
                },
                max_tokens = 500,
                temperature = 0.7
            };

            try
            {
                var request = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
                request.Content = JsonContent.Create(payload);

                var response = await _httpClient.SendAsync(request, cancellationToken);
                
                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync(cancellationToken);
                    _logger.LogWarning("Groq API isteği başarısız: {StatusCode} - {Error}", response.StatusCode, errorContent);
                    return null;
                }

                var json = await response.Content.ReadAsStringAsync(cancellationToken);
                using var doc = JsonDocument.Parse(json);
                
                var content = doc.RootElement
                    .GetProperty("choices")[0]
                    .GetProperty("message")
                    .GetProperty("content")
                    .GetString();

                return content;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Groq API çağrısı sırasında hata oluştu");
                return null;
            }
        }

        public async Task<string?> GenerateYearlySummaryAsync(YearlySummaryData data, CancellationToken cancellationToken = default)
        {
            var systemPrompt = @"Sen Saga platformunun yaratıcı yapay zekasısın. Kullanıcının yıllık izleme/okuma istatistiklerini analiz edip kişiselleştirilmiş, samimi ve eğlenceli bir yıl özeti yazacaksın.

KURALLAR:
- Türkçe yaz
- Samimi ve eğlenceli bir ton kullan
- İstatistikleri yaratıcı şekilde yorumla
- Kullanıcının tercihlerine göre kişiselleştirilmiş öneriler yap
- Emojiler kullan 🎬📚🎭
- Maksimum 300 kelime
- Cevabı sadece özet metni olarak ver, başka açıklama ekleme";

            var userPrompt = $@"Kullanıcının {data.Yil} yılı istatistikleri:

📊 GENEL İSTATİSTİKLER:
- İzlenen Film: {data.ToplamFilm} adet ({data.ToplamSaatFilm} saat)
- İzlenen Dizi: {data.ToplamDizi} adet ({data.ToplamSaatDizi} saat)
- Okunan Kitap: {data.ToplamKitap} adet ({data.ToplamSayfaKitap} sayfa)

⭐ PUANLAMALAR:
- Ortalama Film Puanı: {data.OrtalamaFilmPuani:F1}/10
- Ortalama Dizi Puanı: {data.OrtalamaDiziPuani:F1}/10
- Ortalama Kitap Puanı: {data.OrtalamaKitapPuani:F1}/10

🎭 FAVORİ TÜRLER: {string.Join(", ", data.EnSevdigiTurler)}

🎬 EN SEVDİĞİ FİLMLER: {string.Join(", ", data.EnCokIzledigiFavFilmler)}
📺 EN SEVDİĞİ DİZİLER: {string.Join(", ", data.EnCokIzledigiFavDiziler)}
📚 EN SEVDİĞİ KİTAPLAR: {string.Join(", ", data.EnCokOkuduguFavKitaplar)}

📅 EN AKTİF AY: {data.EnAktifAy}

Bu verilere dayanarak kullanıcı için kişiselleştirilmiş, eğlenceli bir yıl özeti yaz.";

            return await GenerateTextAsync(systemPrompt, userPrompt, cancellationToken);
        }
    }
}
