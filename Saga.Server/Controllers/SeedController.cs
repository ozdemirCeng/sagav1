using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json.Linq;
using Saga.Server.Data;   // Namespace'ine dikkat et (Data klasöründe Context olmalı)
using Saga.Server.Models; // Modellerin burada

namespace Saga.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SeedController : ControllerBase
    {
        private readonly SagaDbContext _context; // Context ismin SagaDbContext olmalı
        private readonly IConfiguration _config;
        private readonly HttpClient _httpClient;

        public SeedController(SagaDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
            _httpClient = new HttpClient();
            // TMDb bazen User-Agent olmadan cevap vermez, takılma sebebi bu olabilir:
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "Saga-StudentProject");
        }

        [HttpPost("movies")]
        public async Task<IActionResult> SeedMovies()
        {
            Console.WriteLine("🚀 [1] Seed işlemi tetiklendi...");

            try
            {
                // ADIM 1: VERİTABANI KONTROLÜ
                Console.WriteLine("⏳ [2] Veritabanı bağlantısı test ediliyor...");
                if (!await _context.Database.CanConnectAsync())
                {
                    Console.WriteLine("❌ [HATA] Veritabanına bağlanılamadı!");
                    return StatusCode(500, "Veritabanı bağlantısı yok.");
                }
                Console.WriteLine("✅ [3] Veritabanı bağlantısı BAŞARILI.");

                // ADIM 2: TMDB İSTEĞİ
                string apiKey = "eec2662a9ba4e82f840e3bdb7bbc4e48"; // Test key
                string url = $"https://api.themoviedb.org/3/movie/popular?api_key={apiKey}&language=tr-TR&page=1";

                Console.WriteLine($"⏳ [4] TMDb API'ye istek atılıyor... ({url})");

                // Timeout koyalım ki sonsuza kadar beklemesin (10 saniye)
                _httpClient.Timeout = TimeSpan.FromSeconds(10);
                var response = await _httpClient.GetAsync(url);

                if (!response.IsSuccessStatusCode)
                {
                    Console.WriteLine($"❌ [HATA] TMDb cevap vermedi. Kod: {response.StatusCode}");
                    return BadRequest($"TMDb Hatası: {response.StatusCode}");
                }
                Console.WriteLine("✅ [5] TMDb'den cevap geldi.");

                // ADIM 3: VERİYİ İŞLEME
                var jsonString = await response.Content.ReadAsStringAsync();
                var json = JObject.Parse(jsonString);
                var results = json["results"];
                Console.WriteLine($"✅ [6] {results?.Count() ?? 0} adet film verisi ayrıştırıldı.");

                int eklenen = 0;
                if (results != null)
                {
                    foreach (var item in results)
                    {
                        string hariciId = item["id"]?.ToString() ?? "0";

                        // Var mı kontrolü
                        bool varMi = await _context.Icerikler.AnyAsync(x => x.HariciId == hariciId);
                        if (!varMi)
                        {
                            var film = new Icerik
                            {
                                HariciId = hariciId,
                                ApiKaynagi = ApiKaynak.tmdb,
                                Tur = IcerikTuru.film,
                                Baslik = item["title"]?.ToString() ?? "Adsız",
                                Aciklama = item["overview"]?.ToString(),
                                PosterUrl = item["poster_path"] != null
                                    ? $"https://image.tmdb.org/t/p/w500{item["poster_path"]}"
                                    : null,
                                OrtalamaPuan = (decimal)(item["vote_average"]?.ToObject<double>() ?? 0),
                                MetaVeri = item.ToString(),
                                OlusturulmaZamani = DateTime.UtcNow
                            };
                            _context.Icerikler.Add(film);
                            eklenen++;
                        }
                    }
                }
                Console.WriteLine($"📦 [7] {eklenen} yeni film hafızaya alındı.");

                // ADIM 4: KAYIT
                Console.WriteLine("⏳ [8] Veritabanına kaydediliyor (SaveChanges)...");
                await _context.SaveChangesAsync();
                Console.WriteLine("✅✅✅ [9] İŞLEM TAMAMLANDI! ✅✅✅");

                return Ok(new { message = $"{eklenen} film başarıyla eklendi." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"🔥🔥🔥 [KRİTİK HATA]: {ex.Message}");
                if (ex.InnerException != null) Console.WriteLine($"[DETAY]: {ex.InnerException.Message}");
                return StatusCode(500, ex.Message);
            }
        }
    }
}