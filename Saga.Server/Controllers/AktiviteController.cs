using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Saga.Server.Data;
using Saga.Server.DTOs;
using Saga.Server.Models;
using System.Text.Json;

namespace Saga.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AktiviteController : ControllerBase
    {
        private readonly SagaDbContext _context;
        private readonly ILogger<AktiviteController> _logger;

        public AktiviteController(SagaDbContext context, ILogger<AktiviteController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // GET: api/aktivite/feed
        // Proje İsteri 2.1.2: Takip edilen kullanıcıların aktivite feed'i (timeline)
        [HttpGet("feed")]
        [Authorize]
        public async Task<ActionResult<List<AktiviteFeedDto>>> GetFeed(
            [FromQuery] string? aktiviteTuru = null,
            [FromQuery] int sayfa = 1,
            [FromQuery] int limit = 15)  // Proje isterine göre 10-15
        {
            try
            {
                var currentUserId = GetCurrentUserId();

                // Takip edilen kullanıcıların ID'lerini al
                var takipEdilenIds = await _context.Takipler
                    .Where(t => t.TakipEdenId == currentUserId)
                    .Select(t => t.TakipEdilenId)
                    .ToListAsync();

                // Kendi ID'sini de ekle (kendi aktivitelerini de görsün)
                takipEdilenIds.Add(currentUserId);

                var query = _context.Aktiviteler
                    .Include(a => a.Kullanici)
                    .Include(a => a.Icerik)
                    .Include(a => a.Puanlama)
                    .Include(a => a.Yorum)
                    .Include(a => a.Liste)
                    .Where(a => !a.Silindi && takipEdilenIds.Contains(a.KullaniciId))
                    .AsNoTracking();

                // Aktivite türü filtresi
                if (!string.IsNullOrEmpty(aktiviteTuru) && Enum.TryParse<AktiviteTuru>(aktiviteTuru, true, out var tur))
                {
                    query = query.Where(a => a.AktiviteTuru == tur);
                }

                // Pagination
                var toplam = await query.CountAsync();
                var aktiviteler = await query
                    .OrderByDescending(a => a.OlusturulmaZamani)
                    .Skip((sayfa - 1) * limit)
                    .Take(limit)
                    .ToListAsync();

                var feedItems = new List<AktiviteFeedDto>();

                foreach (var aktivite in aktiviteler)
                {
                    var feedItem = new AktiviteFeedDto
                    {
                        Id = aktivite.Id,
                        KullaniciId = aktivite.KullaniciId,
                        KullaniciAdi = aktivite.Kullanici.KullaniciAdi,
                        KullaniciAvatar = aktivite.Kullanici.AvatarUrl,
                        AktiviteTuru = aktivite.AktiviteTuru.ToString(),
                        OlusturulmaZamani = aktivite.OlusturulmaZamani,
                        Veri = await BuildAktiviteVeri(aktivite)
                    };

                    feedItems.Add(feedItem);
                }

                Response.Headers.Append("X-Toplam-Sayfa", ((toplam + limit - 1) / limit).ToString());
                Response.Headers.Append("X-Toplam-Kayit", toplam.ToString());
                Response.Headers.Append("X-Mevcut-Sayfa", sayfa.ToString());

                return Ok(feedItems);
            }
            catch (UnauthorizedAccessException)
            {
                return Unauthorized(new { message = "Giriş yapmanız gerekiyor" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Feed yüklenirken hata");
                return StatusCode(500, new { message = "Feed yüklenirken bir hata oluştu." });
            }
        }

        // GET: api/aktivite/genel
        // Tüm kullanıcıların aktiviteleri (keşfet/explore sayfası için)
        [HttpGet("genel")]
        public async Task<ActionResult<List<AktiviteFeedDto>>> GetGenelFeed(
            [FromQuery] string? aktiviteTuru = null,
            [FromQuery] int sayfa = 1,
            [FromQuery] int limit = 20)
        {
            try
            {
                var query = _context.Aktiviteler
                    .Include(a => a.Kullanici)
                    .Include(a => a.Icerik)
                    .Include(a => a.Puanlama)
                    .Include(a => a.Yorum)
                    .Include(a => a.Liste)
                    .Where(a => !a.Silindi)
                    .AsNoTracking();

                // Aktivite türü filtresi
                if (!string.IsNullOrEmpty(aktiviteTuru) && Enum.TryParse<AktiviteTuru>(aktiviteTuru, true, out var tur))
                {
                    query = query.Where(a => a.AktiviteTuru == tur);
                }

                // Pagination
                var toplam = await query.CountAsync();
                var aktiviteler = await query
                    .OrderByDescending(a => a.OlusturulmaZamani)
                    .Skip((sayfa - 1) * limit)
                    .Take(limit)
                    .ToListAsync();

                var feedItems = new List<AktiviteFeedDto>();

                foreach (var aktivite in aktiviteler)
                {
                    var feedItem = new AktiviteFeedDto
                    {
                        Id = aktivite.Id,
                        KullaniciId = aktivite.KullaniciId,
                        KullaniciAdi = aktivite.Kullanici.KullaniciAdi,
                        KullaniciAvatar = aktivite.Kullanici.AvatarUrl,
                        AktiviteTuru = aktivite.AktiviteTuru.ToString(),
                        OlusturulmaZamani = aktivite.OlusturulmaZamani,
                        Veri = await BuildAktiviteVeri(aktivite)
                    };

                    feedItems.Add(feedItem);
                }

                Response.Headers.Append("X-Toplam-Sayfa", ((toplam + limit - 1) / limit).ToString());
                Response.Headers.Append("X-Toplam-Kayit", toplam.ToString());

                return Ok(feedItems);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Feed yüklenirken hata");
                return StatusCode(500, new { message = "Feed yüklenirken bir hata oluştu." });
            }
        }

        // GET: api/aktivite/kullanici/{kullaniciId}
        [HttpGet("kullanici/{kullaniciId}")]
        public async Task<ActionResult<List<AktiviteFeedDto>>> GetKullaniciAktiviteleri(
            Guid kullaniciId,
            [FromQuery] int sayfa = 1,
            [FromQuery] int limit = 20)
        {
            var aktiviteler = await _context.Aktiviteler
                .Include(a => a.Kullanici)
                .Include(a => a.Icerik)
                .Include(a => a.Puanlama)
                .Include(a => a.Yorum)
                .Include(a => a.Liste)
                .Where(a => a.KullaniciId == kullaniciId && !a.Silindi)
                .OrderByDescending(a => a.OlusturulmaZamani)
                .Skip((sayfa - 1) * limit)
                .Take(limit)
                .AsNoTracking()
                .ToListAsync();

            var feedItems = new List<AktiviteFeedDto>();

            foreach (var aktivite in aktiviteler)
            {
                var feedItem = new AktiviteFeedDto
                {
                    Id = aktivite.Id,
                    KullaniciId = aktivite.KullaniciId,
                    KullaniciAdi = aktivite.Kullanici.KullaniciAdi,
                    KullaniciAvatar = aktivite.Kullanici.AvatarUrl,
                    AktiviteTuru = aktivite.AktiviteTuru.ToString(),
                    OlusturulmaZamani = aktivite.OlusturulmaZamani,
                    Veri = await BuildAktiviteVeri(aktivite)
                };

                feedItems.Add(feedItem);
            }

            return Ok(feedItems);
        }

        // GET: api/aktivite/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<AktiviteResponseDto>> GetAktivite(long id)
        {
            var aktivite = await _context.Aktiviteler
                .AsNoTracking()
                .FirstOrDefaultAsync(a => a.Id == id && !a.Silindi);

            if (aktivite == null)
            {
                return NotFound(new { message = "Aktivite bulunamadı." });
            }

            var response = new AktiviteResponseDto
            {
                Id = aktivite.Id,
                KullaniciId = aktivite.KullaniciId,
                AktiviteTuru = aktivite.AktiviteTuru.ToString(),
                IcerikId = aktivite.IcerikId,
                PuanlamaId = aktivite.PuanlamaId,
                YorumId = aktivite.YorumId,
                ListeId = aktivite.ListeId,
                Veri = aktivite.Veri,
                OlusturulmaZamani = aktivite.OlusturulmaZamani
            };

            return Ok(response);
        }

        // Helper Methods
        private Guid GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value 
                              ?? User.FindFirst("sub")?.Value;
            
            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            {
                throw new UnauthorizedAccessException("Kullanıcı ID'si bulunamadı");
            }
            return userId;
        }

        private Guid? GetCurrentUserIdOrNull()
        {
            var userIdClaim = User.FindFirst("sub")?.Value;
            if (Guid.TryParse(userIdClaim, out var userId))
            {
                return userId;
            }
            return null;
        }

        private async Task<AktiviteVeriDto?> BuildAktiviteVeri(Aktivite aktivite)
        {
            var veri = new AktiviteVeriDto();

            switch (aktivite.AktiviteTuru)
            {
                case AktiviteTuru.puanlama:
                    if (aktivite.Puanlama != null)
                    {
                        var icerik = await _context.Icerikler.FindAsync(aktivite.Puanlama.IcerikId);
                        veri.Baslik = icerik?.Baslik;
                        veri.PosterUrl = icerik?.PosterUrl;
                        veri.Tur = icerik?.Tur.ToString();
                        veri.Puan = aktivite.Puanlama.Puan;
                    }
                    break;

                case AktiviteTuru.yorum:
                    if (aktivite.Yorum != null)
                    {
                        var icerik = await _context.Icerikler.FindAsync(aktivite.Yorum.IcerikId);
                        veri.Baslik = icerik?.Baslik;
                        veri.PosterUrl = icerik?.PosterUrl;
                        veri.Tur = icerik?.Tur.ToString();
                        veri.YorumOzet = aktivite.Yorum.IcerikMetni.Length > 100
                            ? aktivite.Yorum.IcerikMetni.Substring(0, 100) + "..."
                            : aktivite.Yorum.IcerikMetni;
                    }
                    break;

                case AktiviteTuru.listeye_ekleme:
                    if (aktivite.Liste != null && aktivite.Icerik != null)
                    {
                        veri.ListeAdi = aktivite.Liste.Ad;
                        veri.Baslik = aktivite.Icerik.Baslik;
                        veri.PosterUrl = aktivite.Icerik.PosterUrl;
                        veri.Tur = aktivite.Icerik.Tur.ToString();
                    }
                    break;

                case AktiviteTuru.takip:
                    // Veri JSONB'den parse et
                    try
                    {
                        var jsonData = JsonSerializer.Deserialize<Dictionary<string, object>>(aktivite.Veri);
                        if (jsonData != null && jsonData.ContainsKey("takipEdilenId"))
                        {
                            var takipEdilenIdStr = jsonData["takipEdilenId"].ToString();
                            if (Guid.TryParse(takipEdilenIdStr, out var takipEdilenId))
                            {
                                var takipEdilen = await _context.Kullanicilar.FindAsync(takipEdilenId);
                                veri.TakipEdilenKullaniciAdi = takipEdilen?.KullaniciAdi;
                                veri.TakipEdilenAvatar = takipEdilen?.AvatarUrl;
                            }
                        }
                    }
                    catch { }
                    break;

                case AktiviteTuru.durum_guncelleme:
                    if (aktivite.Icerik != null)
                    {
                        veri.Baslik = aktivite.Icerik.Baslik;
                        veri.PosterUrl = aktivite.Icerik.PosterUrl;
                        veri.Tur = aktivite.Icerik.Tur.ToString();

                        // Veri JSONB'den durum bilgisini al
                        try
                        {
                            var jsonData = JsonSerializer.Deserialize<Dictionary<string, object>>(aktivite.Veri);
                            if (jsonData != null && jsonData.ContainsKey("durum"))
                            {
                                veri.Durum = jsonData["durum"].ToString();
                            }
                        }
                        catch { }
                    }
                    break;
            }

            return veri;
        }
    }
}
