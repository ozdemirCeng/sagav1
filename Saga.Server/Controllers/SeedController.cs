using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json.Linq;
using Saga.Server.Data;   // Namespace'ine dikkat et (Data klasöründe Context olmalı)
using Saga.Server.Models; // Modellerin burada
using Saga.Server.Services;
using System.Text.Json;

namespace Saga.Server.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize] // 🔒 GÜVENLİK: Seed işlemleri sadece authenticated kullanıcılar için
    public class SeedController : ControllerBase
    {
        private readonly SagaDbContext _context; // Context ismin SagaDbContext olmalı
        private readonly IConfiguration _config;
        private readonly HttpClient _httpClient;
        private readonly ITmdbService _tmdbService;
        private readonly IGoogleBooksService _googleBooksService;

        public SeedController(SagaDbContext context, IConfiguration config, ITmdbService tmdbService, IGoogleBooksService googleBooksService)
        {
            _context = context;
            _config = config;
            _httpClient = new HttpClient();
            _tmdbService = tmdbService;
            _googleBooksService = googleBooksService;
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

                // ADIM 2: TMDB İSTEĞİ - TmdbService kullanarak
                Console.WriteLine("⏳ [4] TMDb API'den popüler filmler çekiliyor...");
                var results = await _tmdbService.GetPopularFilmsAsync(1);
                
                if (results == null || !results.Any())
                {
                    Console.WriteLine("❌ [HATA] TMDb'den veri alınamadı.");
                    return BadRequest("TMDb'den veri alınamadı.");
                }
                Console.WriteLine($"✅ [5] TMDb'den {results.Count} adet film verisi alındı.");

                // ADIM 3: VERİYİ İŞLEME
                Console.WriteLine($"✅ [6] {results.Count} adet film verisi ayrıştırıldı.");

                int eklenen = 0;
                foreach (var filmDto in results)
                {
                    string hariciId = filmDto.Id;

                    // Var mı kontrolü
                    bool varMi = await _context.Icerikler.AnyAsync(x => x.HariciId == hariciId);
                    if (!varMi)
                    {
                        var film = new Icerik
                        {
                            HariciId = hariciId,
                            ApiKaynagi = ApiKaynak.tmdb,
                            Tur = IcerikTuru.film,
                            Baslik = filmDto.Baslik ?? "Adsız",
                            Aciklama = filmDto.Aciklama,
                            PosterUrl = filmDto.PosterUrl,
                            OrtalamaPuan = (decimal)filmDto.Puan,
                            MetaVeri = "{}",
                            OlusturulmaZamani = DateTime.UtcNow
                        };
                        _context.Icerikler.Add(film);
                        eklenen++;
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

        /// <summary>
        /// Mevcut içeriklerin meta verilerini günceller (oyuncular, yönetmen, türler vb.)
        /// </summary>
        [HttpPost("update-metadata")]
        public async Task<IActionResult> UpdateMetadata([FromQuery] int limit = 50)
        {
            Console.WriteLine("🔄 [1] Meta veri güncelleme başlatıldı...");
            
            try
            {
                int guncellenen = 0;
                int hatali = 0;

                // TMDB filmlerini güncelle
                var tmdbFilmler = await _context.Icerikler
                    .Where(i => i.ApiKaynagi == ApiKaynak.tmdb && i.Tur == IcerikTuru.film && !i.HariciId.StartsWith("tv:"))
                    .Take(limit)
                    .ToListAsync();

                Console.WriteLine($"📹 [2] {tmdbFilmler.Count} adet film bulundu.");

                foreach (var film in tmdbFilmler)
                {
                    try
                    {
                        var filmDto = await _tmdbService.GetFilmByIdAsync(film.HariciId);
                        if (filmDto != null)
                        {
                            var metaVeri = new
                            {
                                yonetmen = filmDto.Yonetmen,
                                oyuncular = filmDto.Oyuncular?.Select(o => new { ad = o.Ad, karakter = o.Karakter, profilUrl = o.ProfilUrl }),
                                turler = filmDto.Turler,
                                sure = filmDto.Sure,
                                mediaType = filmDto.MediaType
                            };
                            film.MetaVeri = JsonSerializer.Serialize(metaVeri);
                            guncellenen++;
                            Console.WriteLine($"✅ Film güncellendi: {film.Baslik}");
                        }
                        // Rate limiting - TMDB için bekle
                        await Task.Delay(250);
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"⚠️ Film güncellenemedi ({film.Baslik}): {ex.Message}");
                        hatali++;
                    }
                }

                // TMDB dizilerini güncelle
                var tmdbDiziler = await _context.Icerikler
                    .Where(i => i.ApiKaynagi == ApiKaynak.tmdb && i.HariciId.StartsWith("tv:"))
                    .Take(limit)
                    .ToListAsync();

                Console.WriteLine($"📺 [3] {tmdbDiziler.Count} adet dizi bulundu.");

                foreach (var dizi in tmdbDiziler)
                {
                    try
                    {
                        var tmdbId = dizi.HariciId.Replace("tv:", "");
                        var diziDto = await _tmdbService.GetTvShowByIdAsync(tmdbId);
                        if (diziDto != null)
                        {
                            var metaVeri = new
                            {
                                yonetmen = diziDto.Yonetmen,
                                oyuncular = diziDto.Oyuncular?.Select(o => new { ad = o.Ad, karakter = o.Karakter, profilUrl = o.ProfilUrl }),
                                turler = diziDto.Turler,
                                sezonSayisi = diziDto.SezonSayisi,
                                bolumSayisi = diziDto.BolumSayisi,
                                mediaType = diziDto.MediaType
                            };
                            dizi.MetaVeri = JsonSerializer.Serialize(metaVeri);
                            guncellenen++;
                            Console.WriteLine($"✅ Dizi güncellendi: {dizi.Baslik}");
                        }
                        await Task.Delay(250);
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"⚠️ Dizi güncellenemedi ({dizi.Baslik}): {ex.Message}");
                        hatali++;
                    }
                }

                // Google Books kitaplarını güncelle
                var kitaplar = await _context.Icerikler
                    .Where(i => i.ApiKaynagi == ApiKaynak.google_books && i.Tur == IcerikTuru.kitap)
                    .Take(limit)
                    .ToListAsync();

                Console.WriteLine($"📚 [4] {kitaplar.Count} adet kitap bulundu.");

                foreach (var kitap in kitaplar)
                {
                    try
                    {
                        var kitapDto = await _googleBooksService.GetBookByIdAsync(kitap.HariciId);
                        if (kitapDto != null)
                        {
                            var metaVeri = new
                            {
                                yazarlar = kitapDto.Yazarlar,
                                sayfaSayisi = kitapDto.SayfaSayisi,
                                yayinevi = kitapDto.Yayinevi,
                                isbn = kitapDto.ISBN,
                                kategoriler = kitapDto.Kategoriler
                            };
                            kitap.MetaVeri = JsonSerializer.Serialize(metaVeri);
                            guncellenen++;
                            Console.WriteLine($"✅ Kitap güncellendi: {kitap.Baslik}");
                        }
                        await Task.Delay(100);
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"⚠️ Kitap güncellenemedi ({kitap.Baslik}): {ex.Message}");
                        hatali++;
                    }
                }

                await _context.SaveChangesAsync();

                Console.WriteLine($"✅✅✅ Meta veri güncelleme tamamlandı! Güncellenen: {guncellenen}, Hatalı: {hatali}");

                return Ok(new { 
                    message = "Meta veri güncelleme tamamlandı",
                    guncellenen,
                    hatali,
                    filmSayisi = tmdbFilmler.Count,
                    diziSayisi = tmdbDiziler.Count,
                    kitapSayisi = kitaplar.Count
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"🔥 Meta veri güncelleme hatası: {ex.Message}");
                return StatusCode(500, ex.Message);
            }
        }

        // POST: api/seed/fix-tur
        // HariciId'si "tv:" ile başlayan içeriklerin türünü "dizi" olarak düzelt
        [HttpPost("fix-tur")]
        public async Task<IActionResult> FixContentTypes()
        {
            Console.WriteLine("🔧 İçerik türleri düzeltiliyor...");

            try
            {
                // tv: ile başlayan ama film olarak işaretli içerikleri bul
                var yanlisIcerikler = await _context.Icerikler
                    .Where(i => i.HariciId.StartsWith("tv:") && i.Tur == IcerikTuru.film)
                    .ToListAsync();

                Console.WriteLine($"📌 {yanlisIcerikler.Count} adet yanlış türlü içerik bulundu.");

                foreach (var icerik in yanlisIcerikler)
                {
                    Console.WriteLine($"  - {icerik.Baslik} ({icerik.HariciId}): film -> dizi");
                    icerik.Tur = IcerikTuru.dizi;
                }

                await _context.SaveChangesAsync();

                Console.WriteLine($"✅ {yanlisIcerikler.Count} içerik düzeltildi.");

                return Ok(new
                {
                    message = "İçerik türleri düzeltildi",
                    duzeltilen = yanlisIcerikler.Count,
                    icerikler = yanlisIcerikler.Select(i => new { i.Id, i.Baslik, i.HariciId }).ToList()
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"🔥 Tür düzeltme hatası: {ex.Message}");
                return StatusCode(500, ex.Message);
            }
        }
    }
}