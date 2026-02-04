using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Saga.Server.Data;
using Saga.Server.DTOs;
using Saga.Server.Models;
using Saga.Server.Services;
using System.Text.Json;

namespace Saga.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class IcerikController : BaseApiController
    {
        private readonly SagaDbContext _context;
        private readonly ILogger<IcerikController> _logger;
        private readonly IGoogleBooksService _googleBooksService;
        private readonly IOpenLibraryService _openLibraryService;
        private readonly ITmdbService _tmdbService;

        public IcerikController(SagaDbContext context, ILogger<IcerikController> logger, IGoogleBooksService googleBooksService, IOpenLibraryService openLibraryService, ITmdbService tmdbService)
        {
            _context = context;
            _logger = logger;
            _googleBooksService = googleBooksService;
            _openLibraryService = openLibraryService;
            _tmdbService = tmdbService;
        }

        // GET: api/icerik/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<IcerikDetailDto>> GetIcerik(long id)
        {
            var icerik = await _context.Icerikler
                .FirstOrDefaultAsync(i => i.Id == id);

            if (icerik == null)
            {
                return NotFound(new { message = "İçerik bulunamadı." });
            }

            // Kitap türünde ve açıklama boşsa, Google Books API'den çekmeyi dene
            if (icerik.Tur == IcerikTuru.kitap && 
                string.IsNullOrEmpty(icerik.Aciklama) && 
                icerik.ApiKaynagi == ApiKaynak.google_books)
            {
                try
                {
                    string? aciklama = null;
                    
                    // Önce mevcut harici ID ile dene
                    if (!string.IsNullOrEmpty(icerik.HariciId))
                    {
                        var bookDto = await _googleBooksService.GetBookByIdAsync(icerik.HariciId);
                        if (bookDto != null && !string.IsNullOrEmpty(bookDto.Aciklama))
                        {
                            aciklama = bookDto.Aciklama;
                        }
                    }
                    
                    // Harici ID'den açıklama gelmezse, aynı başlık/yazar ile arama yap
                    if (string.IsNullOrEmpty(aciklama))
                    {
                        // Meta veriden yazarı al
                        string? yazar = null;
                        if (!string.IsNullOrEmpty(icerik.MetaVeri))
                        {
                            try
                            {
                                var metaDoc = System.Text.Json.JsonDocument.Parse(icerik.MetaVeri);
                                if (metaDoc.RootElement.TryGetProperty("yazarlar", out var yazarlar) && 
                                    yazarlar.ValueKind == System.Text.Json.JsonValueKind.Array &&
                                    yazarlar.GetArrayLength() > 0)
                                {
                                    yazar = yazarlar[0].GetString();
                                }
                            }
                            catch { }
                        }
                        
                        aciklama = await _googleBooksService.FindDescriptionForBookAsync(icerik.Baslik, yazar);
                    }
                    
                    if (!string.IsNullOrEmpty(aciklama))
                    {
                        icerik.Aciklama = aciklama;
                        await _context.SaveChangesAsync();
                        _logger.LogInformation("📚 Kitap açıklaması API'den güncellendi: {Baslik} (ID: {Id})", icerik.Baslik, icerik.Id);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Kitap açıklaması API'den alınamadı: {Baslik}", icerik.Baslik);
                }
            }

            // Open Library kitaplarında eksik kapak/bağlantı/bilgi varsa geri doldur
            if (icerik.Tur == IcerikTuru.kitap && icerik.ApiKaynagi == ApiKaynak.diger)
            {
                try
                {
                    string? workKey = null;
                    string? openLibraryId = null;
                    bool missingMetaFields = false;

                    if (!string.IsNullOrEmpty(icerik.MetaVeri) && icerik.MetaVeri != "{}")
                    {
                        try
                        {
                            var metaDoc = JsonDocument.Parse(icerik.MetaVeri);
                            var root = metaDoc.RootElement;

                            if (root.TryGetProperty("workKey", out var wk) && wk.ValueKind == JsonValueKind.String)
                            {
                                workKey = wk.GetString();
                            }
                            if (root.TryGetProperty("openLibraryId", out var oid) && oid.ValueKind == JsonValueKind.String)
                            {
                                openLibraryId = oid.GetString();
                            }

                            if (!root.TryGetProperty("okumaLinki", out _)) missingMetaFields = true;
                            if (!root.TryGetProperty("yazarlar", out _)) missingMetaFields = true;
                            if (!root.TryGetProperty("sayfaSayisi", out _)) missingMetaFields = true;
                            if (!root.TryGetProperty("kategoriler", out _)) missingMetaFields = true;
                            if (!root.TryGetProperty("yayinevi", out _)) missingMetaFields = true;
                            if (!root.TryGetProperty("isbn", out _)) missingMetaFields = true;
                        }
                        catch
                        {
                            missingMetaFields = true;
                        }
                    }
                    else
                    {
                        missingMetaFields = true;
                    }

                    var needsOlFetch = string.IsNullOrWhiteSpace(icerik.PosterUrl)
                        || string.IsNullOrWhiteSpace(icerik.Aciklama)
                        || missingMetaFields;

                    if (needsOlFetch)
                    {
                        if (string.IsNullOrWhiteSpace(openLibraryId) && !string.IsNullOrWhiteSpace(icerik.HariciId) && icerik.HariciId.StartsWith("ol:"))
                        {
                            openLibraryId = icerik.HariciId.Substring(3);
                        }

                        OpenLibraryBookDto? book = null;
                        if (!string.IsNullOrWhiteSpace(workKey))
                        {
                            book = await _openLibraryService.GetBookByWorkKeyAsync(workKey!);
                        }
                        if (book == null && !string.IsNullOrWhiteSpace(openLibraryId))
                        {
                            book = await _openLibraryService.GetBookByOlidAsync(openLibraryId!);
                        }

                        if (book != null)
                        {
                            var updated = false;

                            if (string.IsNullOrWhiteSpace(icerik.PosterUrl) && !string.IsNullOrWhiteSpace(book.PosterUrl))
                            {
                                icerik.PosterUrl = book.PosterUrl;
                                updated = true;
                            }
                            if (string.IsNullOrWhiteSpace(icerik.Aciklama) && !string.IsNullOrWhiteSpace(book.Aciklama))
                            {
                                icerik.Aciklama = book.Aciklama;
                                updated = true;
                            }

                            Dictionary<string, object?> metaDict = new();
                            if (!string.IsNullOrWhiteSpace(icerik.MetaVeri) && icerik.MetaVeri != "{}")
                            {
                                metaDict = JsonSerializer.Deserialize<Dictionary<string, object?>>(icerik.MetaVeri) ?? new();
                            }

                            bool IsMissingValue(object? value)
                            {
                                if (value == null) return true;
                                if (value is JsonElement je)
                                {
                                    if (je.ValueKind == JsonValueKind.Null || je.ValueKind == JsonValueKind.Undefined) return true;
                                    if (je.ValueKind == JsonValueKind.String) return string.IsNullOrWhiteSpace(je.GetString());
                                    if (je.ValueKind == JsonValueKind.Array) return !je.EnumerateArray().Any();
                                }
                                return false;
                            }

                            void SetIfMissing(string key, object? value)
                            {
                                if (value == null) return;
                                if (!metaDict.ContainsKey(key) || IsMissingValue(metaDict[key]))
                                {
                                    metaDict[key] = value;
                                    updated = true;
                                }
                            }

                            SetIfMissing("yazarlar", book.Yazarlar);
                            SetIfMissing("sayfaSayisi", book.SayfaSayisi);
                            SetIfMissing("kategoriler", book.Kategoriler);
                            SetIfMissing("yayinevi", book.Yayinevi);
                            SetIfMissing("isbn", book.ISBN);
                            SetIfMissing("okumaLinki", book.OkumaLinki);
                            SetIfMissing("openLibraryId", book.Id);
                            SetIfMissing("workKey", book.WorkKey);

                            if (updated)
                            {
                                icerik.MetaVeri = JsonSerializer.Serialize(metaDict);
                                await _context.SaveChangesAsync();
                                _logger.LogInformation("📚 Open Library verisi güncellendi: {Baslik} (ID: {Id})", icerik.Baslik, icerik.Id);
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Open Library detayları güncellenemedi: {Baslik}", icerik.Baslik);
                }
            }

            var kullaniciId = GetCurrentUserIdOrNull();

            // İstatistikler zaten Icerik tablosunda trigger ile güncelleniyor, tekrar saymaya gerek yok.
            // var yorumSayisi = await _context.Yorumlar.CountAsync(y => y.IcerikId == id && !y.Silindi);
            // var listeyeEklenmeSayisi = await _context.ListeIcerikleri.CountAsync(li => li.IcerikId == id);

            // Oyuncuları tablodan çek
            var oyuncular = await _context.IcerikOyunculari
                .Include(io => io.Oyuncu)
                .Where(io => io.IcerikId == id)
                .OrderBy(io => io.Sira)
                .Select(io => new OyuncuInfoDto
                {
                    Id = io.Oyuncu.Id,
                    HariciId = io.Oyuncu.HariciId,
                    Ad = io.Oyuncu.Ad,
                    Karakter = io.Karakter,
                    ProfilUrl = io.Oyuncu.ProfilUrl,
                    RolTipi = io.RolTipi
                })
                .ToListAsync();

            // Yönetmeni bul (RolTipi = yonetmen)
            var yonetmenler = oyuncular.Where(o => o.RolTipi == "yonetmen").ToList();
            var oyuncuListesi = oyuncular.Where(o => o.RolTipi == "oyuncu").ToList();

            // Kullanıcının puanı ve durumu
            decimal? kullaniciPuani = null;
            string? kullanicininDurumu = null;

            if (kullaniciId.HasValue)
            {
                var puanlama = await _context.Puanlamalar
                    .FirstOrDefaultAsync(p => p.KullaniciId == kullaniciId.Value && p.IcerikId == id && !p.Silindi);
                kullaniciPuani = puanlama?.Puan;

                var kutuphaneDurum = await _context.KutuphaneDurumlari
                    .FirstOrDefaultAsync(k => k.KullaniciId == kullaniciId.Value && k.IcerikId == id && !k.Silindi);
                kullanicininDurumu = kutuphaneDurum?.Durum.ToString();

                // Görüntüleme sayısını artır
                icerik.GoruntulemeSayisi++;
                await _context.SaveChangesAsync();
            }

            var response = new IcerikDetailDto
            {
                Id = icerik.Id,
                HariciId = icerik.HariciId,
                ApiKaynagi = icerik.ApiKaynagi.ToString(),
                Tur = icerik.Tur.ToString(),
                Baslik = icerik.Baslik,
                Aciklama = icerik.Aciklama,
                PosterUrl = icerik.PosterUrl,
                YayinTarihi = icerik.YayinTarihi,
                OrtalamaPuan = icerik.OrtalamaPuan,
                PuanlamaSayisi = icerik.PuanlamaSayisi,
                HariciPuan = icerik.HariciPuan,
                HariciOySayisi = icerik.HariciOySayisi,
                YorumSayisi = icerik.YorumSayisi,
                ListeyeEklenmeSayisi = icerik.ListeyeEklenmeSayisi,
                GoruntulemeSayisi = icerik.GoruntulemeSayisi,
                PopulerlikSkoru = icerik.PopulerlikSkoru,
                OlusturulmaZamani = icerik.OlusturulmaZamani,
                KullaniciPuani = kullaniciPuani,
                KullanicininDurumu = kullanicininDurumu,
                Oyuncular = oyuncuListesi.Any() ? oyuncuListesi : null,
                Yonetmen = yonetmenler.FirstOrDefault()?.Ad
            };

            // Meta veriyi parse et (türler, süre vs. için)
            if (!string.IsNullOrEmpty(icerik.MetaVeri) && icerik.MetaVeri != "{}")
            {
                try
                {
                    var metaDoc = JsonDocument.Parse(icerik.MetaVeri);
                    var root = metaDoc.RootElement;

                    // Eğer tablodan yönetmen bulunamadıysa, meta veriden al
                    if (string.IsNullOrEmpty(response.Yonetmen) && 
                        root.TryGetProperty("yonetmen", out var yonetmen) && yonetmen.ValueKind != JsonValueKind.Null)
                    {
                        response.Yonetmen = yonetmen.GetString();
                    }

                    // Eğer tablodan oyuncu bulunamadıysa, meta veriden al (eski veriler için)
                    if ((response.Oyuncular == null || !response.Oyuncular.Any()) &&
                        root.TryGetProperty("oyuncular", out var oyuncularJson) && oyuncularJson.ValueKind == JsonValueKind.Array)
                    {
                        response.Oyuncular = new List<OyuncuInfoDto>();
                        foreach (var oyuncu in oyuncularJson.EnumerateArray())
                        {
                            response.Oyuncular.Add(new OyuncuInfoDto
                            {
                                Ad = oyuncu.TryGetProperty("ad", out var ad) ? ad.GetString() ?? "" : "",
                                Karakter = oyuncu.TryGetProperty("karakter", out var karakter) ? karakter.GetString() : null,
                                ProfilUrl = oyuncu.TryGetProperty("profilUrl", out var profil) ? profil.GetString() : null
                            });
                        }
                    }

                    if (root.TryGetProperty("turler", out var turler) && turler.ValueKind == JsonValueKind.Array)
                    {
                        response.Turler = new List<string>();
                        foreach (var tur in turler.EnumerateArray())
                        {
                            var turStr = tur.GetString();
                            if (!string.IsNullOrEmpty(turStr))
                            {
                                response.Turler.Add(turStr);
                            }
                        }
                    }

                    if (root.TryGetProperty("sure", out var sure) && sure.ValueKind == JsonValueKind.Number)
                    {
                        response.Sure = sure.GetInt32();
                    }

                    if (root.TryGetProperty("sezonSayisi", out var sezon) && sezon.ValueKind == JsonValueKind.Number)
                    {
                        response.SezonSayisi = sezon.GetInt32();
                    }

                    if (root.TryGetProperty("bolumSayisi", out var bolum) && bolum.ValueKind == JsonValueKind.Number)
                    {
                        response.BolumSayisi = bolum.GetInt32();
                    }

                    // Kitap meta verileri
                    if (root.TryGetProperty("yazarlar", out var yazarlar) && yazarlar.ValueKind == JsonValueKind.Array)
                    {
                        response.Yazarlar = new List<string>();
                        foreach (var yazar in yazarlar.EnumerateArray())
                        {
                            var yazarStr = yazar.GetString();
                            if (!string.IsNullOrEmpty(yazarStr))
                            {
                                response.Yazarlar.Add(yazarStr);
                            }
                        }
                    }

                    if (root.TryGetProperty("sayfaSayisi", out var sayfa) && sayfa.ValueKind == JsonValueKind.Number)
                    {
                        response.SayfaSayisi = sayfa.GetInt32();
                    }

                    if (root.TryGetProperty("yayinevi", out var yayinevi) && yayinevi.ValueKind != JsonValueKind.Null)
                    {
                        response.Yayinevi = yayinevi.GetString();
                    }

                    if (root.TryGetProperty("isbn", out var isbn) && isbn.ValueKind != JsonValueKind.Null)
                    {
                        response.ISBN = isbn.GetString();
                    }

                    if (root.TryGetProperty("kategoriler", out var kategoriler) && kategoriler.ValueKind == JsonValueKind.Array)
                    {
                        response.Kategoriler = new List<string>();
                        foreach (var kategori in kategoriler.EnumerateArray())
                        {
                            var kategoriStr = kategori.GetString();
                            if (!string.IsNullOrEmpty(kategoriStr))
                            {
                                response.Kategoriler.Add(kategoriStr);
                            }
                        }
                    }

                    if (root.TryGetProperty("okumaLinki", out var okumaLinki) && okumaLinki.ValueKind == JsonValueKind.String)
                    {
                        response.OkumaLinki = okumaLinki.GetString();
                    }
                }
                catch (JsonException ex)
                {
                    _logger.LogWarning(ex, "Meta veri parse edilemedi: IcerikId={IcerikId}", id);
                }
            }

            // Tip düzeltmesi: Metadata'ya göre içerik tipini düzelt
            if ((response.SezonSayisi > 0 || response.BolumSayisi > 0) && response.Tur != "Dizi")
            {
                response.Tur = "Dizi";
            }
            else if (response.SayfaSayisi > 0 && response.Tur != "Kitap")
            {
                response.Tur = "Kitap";
            }
            else if (response.Sure > 0 && response.SezonSayisi == null && response.BolumSayisi == null && response.Tur != "Film")
            {
                response.Tur = "Film";
            }

            // Film/Dizi için TMDB'den video ve izleme platformu bilgilerini çek
            if (icerik.ApiKaynagi == ApiKaynak.tmdb && 
                (icerik.Tur == IcerikTuru.film || icerik.Tur == IcerikTuru.dizi))
            {
                try
                {
                    TmdbFilmDto? tmdbData = null;
                    
                    if (icerik.Tur == IcerikTuru.film)
                    {
                        tmdbData = await _tmdbService.GetFilmByIdAsync(icerik.HariciId);
                    }
                    else if (icerik.Tur == IcerikTuru.dizi)
                    {
                        tmdbData = await _tmdbService.GetTvShowByIdAsync(icerik.HariciId);
                    }
                    
                    if (tmdbData != null)
                    {
                        // Video bilgilerini dönüştür
                        if (tmdbData.Videos != null && tmdbData.Videos.Any())
                        {
                            response.Videos = tmdbData.Videos.Select(v => new VideoInfoDto
                            {
                                Key = v.Key,
                                Site = v.Site,
                                Type = v.Type,
                                Name = v.Name,
                                Official = v.Official
                            }).ToList();
                        }
                        
                        // İzleme platformu bilgilerini dönüştür
                        if (tmdbData.WatchProviders != null && tmdbData.WatchProviders.Any())
                        {
                            response.WatchProviders = tmdbData.WatchProviders.Select(p => new WatchProviderInfoDto
                            {
                                ProviderId = p.ProviderId,
                                ProviderName = p.ProviderName,
                                LogoUrl = p.LogoUrl,
                                Type = p.Type,
                                Link = p.Link
                            }).ToList();
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "TMDB video/provider verileri alınırken hata: IcerikId={IcerikId}", id);
                }
            }

            // Kitap için Open Library'den özet ve okuma linki al
            if (icerik.Tur == IcerikTuru.kitap)
            {
                try
                {
                    OpenLibraryBookDto? olBook = null;

                    if (!string.IsNullOrWhiteSpace(response.ISBN))
                    {
                        olBook = await _openLibraryService.GetBookByIsbnAsync(response.ISBN);
                    }

                    if (olBook == null)
                    {
                        var author = response.Yazarlar?.FirstOrDefault();
                        olBook = await _openLibraryService.FindBookAsync(response.Baslik, author);
                    }

                    if (olBook != null)
                    {
                        if (string.IsNullOrWhiteSpace(response.Aciklama) && !string.IsNullOrWhiteSpace(olBook.Aciklama))
                        {
                            response.Aciklama = olBook.Aciklama;
                        }

                        if ((response.Kategoriler == null || !response.Kategoriler.Any()) && olBook.Kategoriler != null)
                        {
                            response.Kategoriler = olBook.Kategoriler;
                        }

                        if (!response.SayfaSayisi.HasValue && olBook.SayfaSayisi.HasValue)
                        {
                            response.SayfaSayisi = olBook.SayfaSayisi;
                        }

                        if (string.IsNullOrWhiteSpace(response.Yayinevi) && !string.IsNullOrWhiteSpace(olBook.Yayinevi))
                        {
                            response.Yayinevi = olBook.Yayinevi;
                        }

                        if (string.IsNullOrWhiteSpace(response.ISBN) && !string.IsNullOrWhiteSpace(olBook.ISBN))
                        {
                            response.ISBN = olBook.ISBN;
                        }

                        if (string.IsNullOrWhiteSpace(response.OkumaLinki) && !string.IsNullOrWhiteSpace(olBook.OkumaLinki))
                        {
                            response.OkumaLinki = olBook.OkumaLinki;
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Open Library verileri alınırken hata: IcerikId={IcerikId}", id);
                }
            }

            return Ok(response);
        }

        // GET: api/icerik/ara?q={query}
        // PostgreSQL Full-Text Search ile gelişmiş arama
        [HttpGet("ara")]
        [EnableRateLimiting("search")]
        public async Task<ActionResult<List<IcerikSearchDto>>> SearchIcerik(
            [FromQuery] string q,
            [FromQuery] string? tur = null,
            [FromQuery] int sayfa = 1,
            [FromQuery] int limit = 20)
        {
            if (string.IsNullOrWhiteSpace(q) || q.Length < 2)
            {
                return BadRequest(new { message = "Arama terimi en az 2 karakter olmalıdır." });
            }

            try
            {
                // PostgreSQL Full-Text Search kullan
                var searchQuery = @"
                    SELECT i.* 
                    FROM icerikler i
                    WHERE i.arama_vektoru @@ plainto_tsquery('turkish', {0})
                    ORDER BY ts_rank(i.arama_vektoru, plainto_tsquery('turkish', {0})) DESC
                    LIMIT {1} OFFSET {2}";

                var countQuery = @"
                    SELECT COUNT(*)
                    FROM icerikler i
                    WHERE i.arama_vektoru @@ plainto_tsquery('turkish', {0})";

                var offset = (sayfa - 1) * limit;

                var icerikler = await _context.Icerikler
                    .FromSqlRaw(searchQuery, q, limit, offset)
                    .AsNoTracking()
                    .ToListAsync();

                // Tür filtresi (PostgreSQL'den geldikten sonra)
                if (!string.IsNullOrEmpty(tur) && Enum.TryParse<IcerikTuru>(tur, true, out var turEnum))
                {
                    icerikler = icerikler.Where(i => i.Tur == turEnum).ToList();
                }

                var toplam = await _context.Icerikler
                    .FromSqlRaw(countQuery, q)
                    .CountAsync();

                var response = icerikler.Select(i => new IcerikSearchDto
                {
                    Id = i.Id,
                    Baslik = i.Baslik,
                    Tur = i.Tur.ToString(),
                    PosterUrl = i.PosterUrl,
                    OrtalamaPuan = i.OrtalamaPuan,
                    HariciPuan = i.HariciPuan,
                    YayinTarihi = i.YayinTarihi,
                    Aciklama = i.Aciklama != null && i.Aciklama.Length > 200
                        ? i.Aciklama.Substring(0, 200) + "..."
                        : i.Aciklama
                }).ToList();

                Response.Headers.Append("X-Toplam-Sayfa", ((toplam + limit - 1) / limit).ToString());
                Response.Headers.Append("X-Toplam-Kayit", toplam.ToString());

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Full-text search hatası, fallback'e geçiliyor");

                // Fallback: Normal LIKE sorgusu
                var query = _context.Icerikler
                    .Where(i => i.Baslik.Contains(q) || (i.Aciklama != null && i.Aciklama.Contains(q)))
                    .AsNoTracking();

                if (!string.IsNullOrEmpty(tur) && Enum.TryParse<IcerikTuru>(tur, true, out var turEnum))
                {
                    query = query.Where(i => i.Tur == turEnum);
                }

                var toplam = await query.CountAsync();
                var icerikler = await query
                    .OrderByDescending(i => i.PopulerlikSkoru)
                    .Skip((sayfa - 1) * limit)
                    .Take(limit)
                    .ToListAsync();

                var response = icerikler.Select(i => new IcerikSearchDto
                {
                    Id = i.Id,
                    Baslik = i.Baslik,
                    Tur = i.Tur.ToString(),
                    PosterUrl = i.PosterUrl,
                    OrtalamaPuan = i.OrtalamaPuan,
                    HariciPuan = i.HariciPuan,
                    YayinTarihi = i.YayinTarihi,
                    Aciklama = i.Aciklama != null && i.Aciklama.Length > 200
                        ? i.Aciklama.Substring(0, 200) + "..."
                        : i.Aciklama
                }).ToList();

                Response.Headers.Append("X-Toplam-Sayfa", ((toplam + limit - 1) / limit).ToString());
                Response.Headers.Append("X-Toplam-Kayit", toplam.ToString());

                return Ok(response);
            }
        }

        // GET: api/icerik/filtrele
        // Proje İsteri 2.1.3: Gelişmiş Filtreleme (Tür, Yıl, Puan)
        [HttpGet("filtrele")]
        public async Task<ActionResult<List<IcerikListDto>>> FiltreliIcerikler(
            [FromQuery] string? tur = null,
            [FromQuery] int? yil = null,
            [FromQuery] decimal? minPuan = null,
            [FromQuery] decimal? maxPuan = null,
            [FromQuery] int sayfa = 1,
            [FromQuery] int limit = 50)
        {
            var query = _context.Icerikler.AsNoTracking();

            // Tür filtresi
            if (!string.IsNullOrEmpty(tur) && Enum.TryParse<IcerikTuru>(tur, true, out var turEnum))
            {
                query = query.Where(i => i.Tur == turEnum);
            }

            // Yıl filtresi
            if (yil.HasValue)
            {
                query = query.Where(i => i.YayinTarihi.HasValue && i.YayinTarihi.Value.Year == yil.Value);
            }

            // Puan filtresi
            if (minPuan.HasValue)
            {
                query = query.Where(i => i.OrtalamaPuan >= minPuan.Value);
            }

            if (maxPuan.HasValue)
            {
                query = query.Where(i => i.OrtalamaPuan <= maxPuan.Value);
            }

            var toplam = await query.CountAsync();
            var icerikler = await query
                .OrderByDescending(i => i.PopulerlikSkoru)
                .Skip((sayfa - 1) * limit)
                .Take(limit)
                .ToListAsync();

            var response = icerikler.Select(CreateIcerikListDtoWithMeta).ToList();

            Response.Headers.Append("X-Toplam-Sayfa", ((toplam + limit - 1) / limit).ToString());
            Response.Headers.Append("X-Toplam-Kayit", toplam.ToString());

            return Ok(response);
        }

        // GET: api/icerik/en-yuksek-puanlilar
        // Proje İsteri 2.1.3: En Yüksek Puanlılar Vitrini
        [HttpGet("en-yuksek-puanlilar")]
        [ResponseCache(Duration = 300, VaryByQueryKeys = new[] { "tur", "limit" })]
        public async Task<ActionResult<List<IcerikListDto>>> GetEnYuksekPuanlilar(
            [FromQuery] string? tur = null,
            [FromQuery] int limit = 20)
        {
            var query = _context.Icerikler
                .Where(i => i.PuanlamaSayisi >= 5)  // En az 5 puan almış olmalı
                .AsNoTracking();

            // Tür filtresi
            if (!string.IsNullOrEmpty(tur) && Enum.TryParse<IcerikTuru>(tur, true, out var turEnum))
            {
                query = query.Where(i => i.Tur == turEnum);
            }

            var icerikler = await query
                .OrderByDescending(i => i.OrtalamaPuan)
                .ThenByDescending(i => i.PuanlamaSayisi)
                .Take(limit)
                .ToListAsync();

            var response = icerikler.Select(CreateIcerikListDtoWithMeta).ToList();

            return Ok(response);
        }

        // GET: api/icerik/populer
        [HttpGet("populer")]
        [ResponseCache(Duration = 300, VaryByQueryKeys = new[] { "tur", "limit" })]
        public async Task<ActionResult<List<IcerikListDto>>> GetPopulerIcerikler(
            [FromQuery] string? tur = null,
            [FromQuery] int limit = 20)
        {
            var query = _context.Icerikler.AsNoTracking();

            // Tür filtresi
            if (!string.IsNullOrEmpty(tur) && Enum.TryParse<IcerikTuru>(tur, true, out var turEnum))
            {
                query = query.Where(i => i.Tur == turEnum);
            }

            var icerikler = await query
                .OrderByDescending(i => i.PopulerlikSkoru)
                .Take(limit)
                .ToListAsync();

            var response = icerikler.Select(CreateIcerikListDtoWithMeta).ToList();

            return Ok(response);
        }

        // GET: api/icerik/yeni
        [HttpGet("yeni")]
        [ResponseCache(Duration = 120, VaryByQueryKeys = new[] { "tur", "limit" })]
        public async Task<ActionResult<List<IcerikListDto>>> GetYeniIcerikler(
            [FromQuery] string? tur = null,
            [FromQuery] int limit = 20)
        {
            var query = _context.Icerikler.AsNoTracking();

            // Tür filtresi
            if (!string.IsNullOrEmpty(tur) && Enum.TryParse<IcerikTuru>(tur, true, out var turEnum))
            {
                query = query.Where(i => i.Tur == turEnum);
            }

            var icerikler = await query
                .OrderByDescending(i => i.YayinTarihi ?? DateOnly.MinValue)
                .ThenByDescending(i => i.OlusturulmaZamani)
                .Take(limit)
                .ToListAsync();

            var response = icerikler.Select(CreateIcerikListDtoWithMeta).ToList();

            return Ok(response);
        }

        // GET: api/icerik/onerilenler
        [HttpGet("onerilenler")]
        [Authorize]
        public async Task<ActionResult<List<IcerikListDto>>> GetOnerilenler([FromQuery] int limit = 20)
        {
            try
            {
                var kullaniciId = GetCurrentUserId();

                // Kullanıcının puanladığı içeriklerin türlerini al
                var kullaniciPuanlamalari = await _context.Puanlamalar
                    .Include(p => p.Icerik)
                    .Where(p => p.KullaniciId == kullaniciId && !p.Silindi)
                    .AsNoTracking()
                    .ToListAsync();

                if (!kullaniciPuanlamalari.Any())
                {
                    // Puanlama yoksa, popüler içerikleri döndür
                    return await GetPopulerIcerikler(null, limit);
                }

                // Kullanıcının ortalama puanından yüksek verdiği içerikler
                var ortPuan = kullaniciPuanlamalari.Average(p => p.Puan);
                var begenilenTurler = kullaniciPuanlamalari
                    .Where(p => p.Puan >= ortPuan)
                    .Select(p => p.Icerik.Tur)
                    .Distinct()
                    .ToList();

                // Kullanıcının zaten puanladığı içerik ID'leri
                var puanlananIcerikIds = kullaniciPuanlamalari.Select(p => p.IcerikId).ToList();

                // Beğenilen türlerden, henüz puanlanmamış, yüksek puanlı içerikler
                var oneriler = await _context.Icerikler
                    .Where(i => begenilenTurler.Contains(i.Tur) &&
                                !puanlananIcerikIds.Contains(i.Id) &&
                                i.PuanlamaSayisi >= 5 &&
                                i.OrtalamaPuan >= 7.0m)
                    .OrderByDescending(i => i.PopulerlikSkoru)
                    .Take(limit)
                    .AsNoTracking()
                    .ToListAsync();

                var response = oneriler.Select(CreateIcerikListDtoWithMeta).ToList();

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Öneri sistemi hatası");
                return StatusCode(500, new { message = "Öneriler yüklenirken bir hata oluştu." });
            }
        }

        // POST: api/icerik (Manual ekleme - admin/moderator için)
        [HttpPost]
        [Authorize(Roles = "yonetici,moderator")]
        public async Task<ActionResult<IcerikDetailDto>> CreateIcerik([FromBody] IcerikCreateDto dto)
        {
            try
            {
                // ApiKaynak ve IcerikTuru enum'a çevir
                if (!Enum.TryParse<ApiKaynak>(dto.ApiKaynagi, true, out var apiKaynak))
                {
                    return BadRequest(new { message = "Geçersiz API kaynağı." });
                }

                if (!Enum.TryParse<IcerikTuru>(dto.Tur, true, out var tur))
                {
                    return BadRequest(new { message = "Geçersiz içerik türü." });
                }

                var icerik = new Icerik
                {
                    HariciId = dto.HariciId,
                    ApiKaynagi = apiKaynak,
                    Tur = tur,
                    Baslik = dto.Baslik,
                    Aciklama = dto.Aciklama,
                    PosterUrl = dto.PosterUrl,
                    YayinTarihi = dto.YayinTarihi,
                    OlusturulmaZamani = DateTime.UtcNow
                };

                _context.Icerikler.Add(icerik);
                await _context.SaveChangesAsync();

                var response = new IcerikDetailDto
                {
                    Id = icerik.Id,
                    HariciId = icerik.HariciId,
                    ApiKaynagi = icerik.ApiKaynagi.ToString(),
                    Tur = icerik.Tur.ToString(),
                    Baslik = icerik.Baslik,
                    Aciklama = icerik.Aciklama,
                    PosterUrl = icerik.PosterUrl,
                    YayinTarihi = icerik.YayinTarihi,
                    OrtalamaPuan = 0,
                    PuanlamaSayisi = 0,
                    YorumSayisi = 0,
                    ListeyeEklenmeSayisi = 0,
                    GoruntulemeSayisi = 0,
                    PopulerlikSkoru = 0,
                    OlusturulmaZamani = icerik.OlusturulmaZamani
                };

                return CreatedAtAction(nameof(GetIcerik), new { id = icerik.Id }, response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "İçerik oluşturulurken hata");
                return StatusCode(500, new { message = "İçerik kaydedilirken bir hata oluştu." });
            }
        }

        // GET: api/icerik/{id}/benzer
        // Akıllı Benzer İçerik Algoritması
        [HttpGet("{id}/benzer")]
        public async Task<ActionResult<IEnumerable<IcerikListDto>>> GetBenzerIcerikler(long id, [FromQuery] int limit = 6)
        {
            try
            {
                var icerik = await _context.Icerikler
                    .AsNoTracking()
                    .FirstOrDefaultAsync(i => i.Id == id);

                if (icerik == null)
                {
                    return NotFound(new { message = "İçerik bulunamadı." });
                }

                // Meta veriyi parse et (türler, yazarlar, kategoriler, yönetmen)
                static (List<string> Turler, List<string> Yazarlar, List<string> Kategoriler, string? Yonetmen) ParseMeta(string? meta)
                {
                    var turler = new List<string>();
                    var yazarlar = new List<string>();
                    var kategoriler = new List<string>();
                    string? yonetmen = null;

                    if (string.IsNullOrWhiteSpace(meta) || meta == "{}")
                    {
                        return (turler, yazarlar, kategoriler, yonetmen);
                    }

                    try
                    {
                        using var metaDoc = JsonDocument.Parse(meta);
                        var root = metaDoc.RootElement;

                        if (root.TryGetProperty("turler", out var turlerJson) && turlerJson.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var t in turlerJson.EnumerateArray())
                            {
                                var turStr = t.GetString();
                                if (!string.IsNullOrEmpty(turStr))
                                    turler.Add(turStr.ToLowerInvariant());
                            }
                        }

                        if (root.TryGetProperty("yazarlar", out var yazarlarJson) && yazarlarJson.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var y in yazarlarJson.EnumerateArray())
                            {
                                var yazarStr = y.GetString();
                                if (!string.IsNullOrEmpty(yazarStr))
                                    yazarlar.Add(yazarStr.ToLowerInvariant());
                            }
                        }

                        if (root.TryGetProperty("kategoriler", out var kategorilerJson) && kategorilerJson.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var k in kategorilerJson.EnumerateArray())
                            {
                                var katStr = k.GetString();
                                if (!string.IsNullOrEmpty(katStr))
                                    kategoriler.Add(katStr.ToLowerInvariant());
                            }
                        }

                        if (root.TryGetProperty("yonetmen", out var yonetmenJson) && yonetmenJson.ValueKind == JsonValueKind.String)
                        {
                            yonetmen = yonetmenJson.GetString();
                        }
                    }
                    catch { }

                    return (turler, yazarlar, kategoriler, yonetmen);
                }

                var metaTarget = ParseMeta(icerik.MetaVeri);
                var turler = metaTarget.Turler;
                var yazarlar = metaTarget.Yazarlar;
                var kategoriler = metaTarget.Kategoriler;
                var yonetmen = metaTarget.Yonetmen;

                // Yayın yılını al
                var yayinYili = icerik.YayinTarihi?.Year;

                // Tüm aday içerikleri çek (aynı ana tür, kendisi hariç)
                var adaylar = await _context.Icerikler
                    .AsNoTracking()
                    .Where(i => i.Id != id && i.Tur == icerik.Tur && !string.IsNullOrEmpty(i.PosterUrl))
                    .Select(i => new
                    {
                        Icerik = i,
                        MetaVeri = i.MetaVeri
                    })
                    .Take(500) // Performans için limit
                    .ToListAsync();

                // Oyuncu verilerini hazırla (film/dizi için)
                var hedefOyuncuIds = new List<long>();
                var adayOyuncuMap = new Dictionary<long, HashSet<long>>();

                if (icerik.Tur == IcerikTuru.film || icerik.Tur == IcerikTuru.dizi)
                {
                    hedefOyuncuIds = await _context.IcerikOyunculari
                        .AsNoTracking()
                        .Where(io => io.IcerikId == id && io.RolTipi == "oyuncu")
                        .OrderBy(io => io.Sira)
                        .Select(io => io.OyuncuId)
                        .Take(8)
                        .ToListAsync();

                    var adayIds = adaylar.Select(a => a.Icerik.Id).ToList();
                    if (hedefOyuncuIds.Count > 0 && adayIds.Count > 0)
                    {
                        var oyuncuRows = await _context.IcerikOyunculari
                            .AsNoTracking()
                            .Where(io => adayIds.Contains(io.IcerikId) && io.RolTipi == "oyuncu" && io.Sira <= 8)
                            .Select(io => new { io.IcerikId, io.OyuncuId })
                            .ToListAsync();

                        adayOyuncuMap = oyuncuRows
                            .GroupBy(x => x.IcerikId)
                            .ToDictionary(
                                g => g.Key,
                                g => new HashSet<long>(g.Select(x => x.OyuncuId))
                            );
                    }
                }

                // Benzerlik skoru hesapla
                var skorluAdaylar = adaylar.Select(a =>
                {
                    double skor = 0;
                    var adayMeta = ParseMeta(a.MetaVeri);

                    // 1) Tür/Kategori/Yazar benzerliği
                    if (icerik.Tur == IcerikTuru.kitap)
                    {
                        if (kategoriler.Any() && adayMeta.Kategoriler.Any())
                        {
                            var ortak = kategoriler.Intersect(adayMeta.Kategoriler).Count();
                            var toplam = kategoriler.Union(adayMeta.Kategoriler).Count();
                            skor += toplam > 0 ? (ortak / (double)toplam) * 40.0 : 0;
                        }

                        if (yazarlar.Any() && adayMeta.Yazarlar.Any())
                        {
                            var ortak = yazarlar.Intersect(adayMeta.Yazarlar).Count();
                            var toplam = yazarlar.Union(adayMeta.Yazarlar).Count();
                            skor += toplam > 0 ? (ortak / (double)toplam) * 25.0 : 0;
                        }
                    }
                    else
                    {
                        if (turler.Any() && adayMeta.Turler.Any())
                        {
                            var ortak = turler.Intersect(adayMeta.Turler).Count();
                            var toplam = turler.Union(adayMeta.Turler).Count();
                            skor += toplam > 0 ? (ortak / (double)toplam) * 40.0 : 0;
                        }
                    }

                    // 2) Yönetmen/Creator benzerliği
                    if (!string.IsNullOrWhiteSpace(yonetmen) &&
                        !string.IsNullOrWhiteSpace(adayMeta.Yonetmen) &&
                        string.Equals(yonetmen, adayMeta.Yonetmen, StringComparison.OrdinalIgnoreCase))
                    {
                        skor += 10.0;
                    }

                    // 3) Oyuncu benzerliği (film/dizi)
                    if (hedefOyuncuIds.Count > 0 && adayOyuncuMap.TryGetValue(a.Icerik.Id, out var adayOyuncular))
                    {
                        var ortak = hedefOyuncuIds.Intersect(adayOyuncular).Count();
                        skor += (ortak / (double)Math.Max(hedefOyuncuIds.Count, 1)) * 25.0;
                    }

                    // 4) Puan benzerliği
                    double? hedefPuan = icerik.OrtalamaPuan > 0 ? (double)icerik.OrtalamaPuan
                        : (icerik.HariciPuan > 0 ? (double)icerik.HariciPuan : null);
                    double? adayPuan = a.Icerik.OrtalamaPuan > 0 ? (double)a.Icerik.OrtalamaPuan
                        : (a.Icerik.HariciPuan > 0 ? (double)a.Icerik.HariciPuan : null);

                    if (hedefPuan.HasValue && adayPuan.HasValue)
                    {
                        var puanFarki = Math.Abs(hedefPuan.Value - adayPuan.Value);
                        skor += Math.Max(0, 10 - puanFarki * 2);
                    }

                    // 5) Yayın yılı yakınlığı
                    if (yayinYili.HasValue && a.Icerik.YayinTarihi.HasValue)
                    {
                        var yilFarki = Math.Abs(yayinYili.Value - a.Icerik.YayinTarihi.Value.Year);
                        skor += Math.Max(0, 10 - yilFarki);
                    }

                    // 6) Popülerlik bonusu
                    var popSkor = (double)a.Icerik.PopulerlikSkoru;
                    skor += Math.Min(5, popSkor / 100.0);

                    // 7) Aynı API kaynağı bonusu
                    if (a.Icerik.ApiKaynagi == icerik.ApiKaynagi)
                    {
                        skor += 5.0;
                    }

                    return new { a.Icerik, Skor = skor };
                })
                .OrderByDescending(x => x.Skor)
                .ToList();

                var secilenler = skorluAdaylar
                    .Where(x => x.Skor > 0)
                    .Take(limit)
                    .Select(x => x.Icerik)
                    .ToList();

                if (secilenler.Count < limit)
                {
                    var mevcutIds = secilenler.Select(x => x.Id).ToHashSet();
                    var eksik = limit - secilenler.Count;

                    var fallback = adaylar
                        .Select(a => a.Icerik)
                        .Where(i => !mevcutIds.Contains(i.Id))
                        .OrderByDescending(i => i.PopulerlikSkoru)
                        .ThenByDescending(i => i.HariciPuan)
                        .Take(eksik)
                        .ToList();

                    secilenler.AddRange(fallback);
                }

                var result = secilenler.Select(CreateIcerikListDtoWithMeta);

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Benzer içerikler alınırken hata: {Id}", id);
                return StatusCode(500, new { message = "Benzer içerikler yüklenirken hata oluştu." });
            }
        }

        // Helper Methods BaseApiController üzerinden gelmektedir.
        
        // Meta veriden süre, sezon, bölüm ve sayfa bilgilerini parse et
        private static IcerikListDto CreateIcerikListDtoWithMeta(Icerik icerik)
        {
            var dto = new IcerikListDto
            {
                Id = icerik.Id,
                Baslik = icerik.Baslik,
                Tur = icerik.Tur.ToString(),
                Aciklama = icerik.Aciklama,
                PosterUrl = icerik.PosterUrl,
                OrtalamaPuan = icerik.OrtalamaPuan,
                PuanlamaSayisi = icerik.PuanlamaSayisi,
                HariciPuan = icerik.HariciPuan,
                HariciOySayisi = icerik.HariciOySayisi,
                PopulerlikSkoru = icerik.PopulerlikSkoru,
                YayinTarihi = icerik.YayinTarihi
            };

            // Meta veriden ek bilgileri parse et
            if (!string.IsNullOrEmpty(icerik.MetaVeri) && icerik.MetaVeri != "{}")
            {
                try
                {
                    var metaDoc = JsonDocument.Parse(icerik.MetaVeri);
                    var root = metaDoc.RootElement;

                    if (root.TryGetProperty("sure", out var sure) && sure.ValueKind == JsonValueKind.Number)
                    {
                        dto.Sure = sure.GetInt32();
                    }

                    if (root.TryGetProperty("sezonSayisi", out var sezon) && sezon.ValueKind == JsonValueKind.Number)
                    {
                        dto.SezonSayisi = sezon.GetInt32();
                    }

                    if (root.TryGetProperty("bolumSayisi", out var bolum) && bolum.ValueKind == JsonValueKind.Number)
                    {
                        dto.BolumSayisi = bolum.GetInt32();
                    }

                    if (root.TryGetProperty("sayfaSayisi", out var sayfa) && sayfa.ValueKind == JsonValueKind.Number)
                    {
                        dto.SayfaSayisi = sayfa.GetInt32();
                    }
                }
                catch
                {
                    // Meta veri parse hatası, devam et
                }
            }

            // Tip düzeltmesi: Eğer sezon veya bölüm sayısı varsa, bu bir dizi
            if ((dto.SezonSayisi > 0 || dto.BolumSayisi > 0) && dto.Tur != "Dizi")
            {
                dto.Tur = "Dizi";
            }
            // Eğer sayfa sayısı varsa, bu bir kitap
            else if (dto.SayfaSayisi > 0 && dto.Tur != "Kitap")
            {
                dto.Tur = "Kitap";
            }
            // Eğer film süresi varsa ve sezon/bölüm yoksa, bu bir film
            else if (dto.Sure > 0 && dto.SezonSayisi == null && dto.BolumSayisi == null && dto.Tur != "Film")
            {
                dto.Tur = "Film";
            }

            return dto;
        }
    }

    // Manual içerik ekleme için DTO (IcerikDtos.cs'e eklenmeli)
    public class IcerikCreateDto
    {
        public string HariciId { get; set; } = null!;
        public string ApiKaynagi { get; set; } = null!; // tmdb, google_books, diger
        public string Tur { get; set; } = null!; // film, kitap
        public string Baslik { get; set; } = null!;
        public string? Aciklama { get; set; }
        public string? PosterUrl { get; set; }
        public DateOnly? YayinTarihi { get; set; }
    }
}
