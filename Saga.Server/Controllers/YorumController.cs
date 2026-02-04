using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Saga.Server.Data;
using Saga.Server.DTOs;
using Saga.Server.Models;
using Saga.Server.Services;

namespace Saga.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class YorumController : BaseApiController
    {
        private readonly SagaDbContext _context;
        private readonly ILogger<YorumController> _logger;
        private readonly IBildirimService _bildirimService;

        public YorumController(SagaDbContext context, ILogger<YorumController> logger, IBildirimService bildirimService)
        {
            _context = context;
            _logger = logger;
            _bildirimService = bildirimService;
        }

        // POST: api/yorum
        [HttpPost]
        [Authorize]
        public async Task<ActionResult<YorumResponseDto>> CreateYorum([FromBody] YorumCreateDto dto)
        {
            try
            {
                var kullaniciId = GetCurrentUserId();

                var yorum = new Yorum
                {
                    KullaniciId = kullaniciId,
                    IcerikId = dto.IcerikId,
                    Baslik = dto.Baslik,
                    IcerikMetni = dto.Icerik,
                    Puan = dto.Puan,
                    SpoilerIceriyor = dto.SpoilerIceriyor,
                    OlusturulmaZamani = DateTime.UtcNow,
                    UstYorumId = dto.UstYorumId
                };

                _context.Yorumlar.Add(yorum);
                await _context.SaveChangesAsync();

                // Aktivite kaydı artık PostgreSQL trigger'ı ile otomatik oluşturuluyor (veritabaniyapisi -> aktivite_ekle_yorum)
                // Bu yüzden burada manuel Aktivite eklemiyoruz ki çift kayıt oluşmasın.

                var kullanici = await _context.Kullanicilar.FindAsync(kullaniciId);

                // Yanıt ise üst yorum sahibine bildirim gönder
                if (dto.UstYorumId.HasValue)
                {
                    var ustYorum = await _context.Yorumlar
                        .Include(y => y.Kullanici)
                        .FirstOrDefaultAsync(y => y.Id == dto.UstYorumId);
                    
                    if (ustYorum != null && ustYorum.KullaniciId != kullaniciId)
                    {
                        // 🔔 Kullanıcı ayarlarına göre bildirim oluştur
                        await _bildirimService.BildirimOlusturAsync(new Bildirim
                        {
                            AliciId = ustYorum.KullaniciId,
                            GonderenId = kullaniciId,
                            Tip = "yorum_yanit",
                            Baslik = "Yorumunuza Yanıt",
                            Mesaj = $"{kullanici?.KullaniciAdi ?? "Birisi"} yorumunuza yanıt verdi",
                            IcerikId = dto.IcerikId,
                            YorumId = yorum.Id,
                            LinkUrl = $"/icerik/{dto.IcerikId}",
                            OlusturulmaZamani = DateTime.UtcNow
                        });
                    }
                }

                var response = new YorumResponseDto
                {
                    Id = yorum.Id,
                    IcerikId = yorum.IcerikId,
                    KullaniciId = yorum.KullaniciId,
                    KullaniciAdi = kullanici?.KullaniciAdi ?? "",
                    KullaniciAvatar = kullanici?.AvatarUrl,
                    Baslik = yorum.Baslik,
                    Icerik = yorum.IcerikMetni,
                    Puan = yorum.Puan,
                    SpoilerIceriyor = yorum.SpoilerIceriyor,
                    BegeniSayisi = 0,
                    OlusturulmaZamani = yorum.OlusturulmaZamani,
                    GuncellemeZamani = yorum.GuncellemeZamani,
                    KullaniciBegendiMi = false,
                    UstYorumId = yorum.UstYorumId
                };

                return CreatedAtAction(nameof(GetYorum), new { id = yorum.Id }, response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Yorum oluşturulurken hata: {IcerikId}", dto.IcerikId);
                return StatusCode(500, new { message = "Yorum kaydedilirken bir hata oluştu." });
            }
        }

        // GET: api/yorum/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<YorumResponseDto>> GetYorum(long id)
        {
            var yorum = await _context.Yorumlar
                .Include(y => y.Kullanici)
                .Include(y => y.Begenenler)
                .AsNoTracking()
                .FirstOrDefaultAsync(y => y.Id == id && !y.Silindi);

            if (yorum == null)
            {
                return NotFound(new { message = "Yorum bulunamadı." });
            }

            var kullaniciId = GetCurrentUserIdOrNull();
            var kullanicininBegendigi = kullaniciId.HasValue &&
                yorum.Begenenler.Any(b => b.KullaniciId == kullaniciId.Value);

            var response = new YorumResponseDto
            {
                Id = yorum.Id,
                IcerikId = yorum.IcerikId,
                KullaniciId = yorum.KullaniciId,
                KullaniciAdi = yorum.Kullanici.KullaniciAdi,
                KullaniciAvatar = yorum.Kullanici.AvatarUrl,
                Baslik = yorum.Baslik,
                Icerik = yorum.IcerikMetni,
                Puan = yorum.Puan,
                SpoilerIceriyor = yorum.SpoilerIceriyor,
                BegeniSayisi = yorum.Begenenler.Count,
                OlusturulmaZamani = yorum.OlusturulmaZamani,
                GuncellemeZamani = yorum.GuncellemeZamani,
                KullaniciBegendiMi = kullanicininBegendigi
            };

            return Ok(response);
        }

        // PUT: api/yorum/{id}
        [HttpPut("{id}")]
        [Authorize]
        public async Task<ActionResult<YorumResponseDto>> UpdateYorum(long id, [FromBody] YorumUpdateDto dto)
        {
            try
            {
                var kullaniciId = GetCurrentUserId();

                var yorum = await _context.Yorumlar
                    .Include(y => y.Kullanici)
                    .Include(y => y.Begenenler)
                    .FirstOrDefaultAsync(y => y.Id == id && !y.Silindi);

                if (yorum == null)
                {
                    return NotFound(new { message = "Yorum bulunamadı." });
                }

                // Yetki kontrolü
                if (yorum.KullaniciId != kullaniciId)
                {
                    return Forbid();
                }

                yorum.Baslik = dto.Baslik;
                yorum.IcerikMetni = dto.Icerik;
                yorum.Puan = dto.Puan;
                yorum.SpoilerIceriyor = dto.SpoilerIceriyor;
                yorum.GuncellemeZamani = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                var response = new YorumResponseDto
                {
                    Id = yorum.Id,
                    IcerikId = yorum.IcerikId,
                    KullaniciId = yorum.KullaniciId,
                    KullaniciAdi = yorum.Kullanici.KullaniciAdi,
                    KullaniciAvatar = yorum.Kullanici.AvatarUrl,
                    Baslik = yorum.Baslik,
                    Icerik = yorum.IcerikMetni,
                    Puan = yorum.Puan,
                    SpoilerIceriyor = yorum.SpoilerIceriyor,
                    BegeniSayisi = yorum.Begenenler.Count,
                    OlusturulmaZamani = yorum.OlusturulmaZamani,
                    GuncellemeZamani = yorum.GuncellemeZamani,
                    KullaniciBegendiMi = true
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Yorum güncellenirken hata: {Id}", id);
                return StatusCode(500, new { message = "Yorum güncellenirken bir hata oluştu." });
            }
        }

        // DELETE: api/yorum/{id}
        [HttpDelete("{id}")]
        [Authorize]
        public async Task<IActionResult> DeleteYorum(long id)
        {
            try
            {
                var kullaniciId = GetCurrentUserId();

                var yorum = await _context.Yorumlar
                    .FirstOrDefaultAsync(y => y.Id == id);

                if (yorum == null)
                {
                    return NotFound(new { message = "Yorum bulunamadı." });
                }

                // Yetki kontrolü
                if (yorum.KullaniciId != kullaniciId)
                {
                    return Forbid();
                }

                // Soft delete
                yorum.Silindi = true;
                yorum.GuncellemeZamani = DateTime.UtcNow;
                
                // İlgili aktiviteyi de sil (yorum aktivitesi)
                var yorumAktivitesi = await _context.Aktiviteler
                    .FirstOrDefaultAsync(a => a.YorumId == id && !a.Silindi);
                
                if (yorumAktivitesi != null)
                {
                    yorumAktivitesi.Silindi = true;
                }
                
                await _context.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Yorum silinirken hata: {Id}", id);
                return StatusCode(500, new { message = "Yorum silinirken bir hata oluştu." });
            }
        }

        // GET: api/yorum/icerik/{icerikId}
        [HttpGet("icerik/{icerikId}")]
        public async Task<ActionResult<List<YorumListDto>>> GetIcerikYorumlari(
            long icerikId,
            [FromQuery] int sayfa = 1,
            [FromQuery] int sayfaBoyutu = 20)
        {
            var kullaniciId = GetCurrentUserIdOrNull();

            var query = _context.Yorumlar
                .Include(y => y.Kullanici)
                .Include(y => y.Begenenler)
                .Include(y => y.Yanitlar)
                    .ThenInclude(r => r.Kullanici)
                .Include(y => y.Yanitlar)
                    .ThenInclude(r => r.Begenenler)
                .Where(y => y.IcerikId == icerikId && !y.Silindi && y.UstYorumId == null)
                .OrderByDescending(y => y.OlusturulmaZamani)
                .AsNoTracking();

            var toplam = await query.CountAsync();
            var yorumlar = await query
                .Skip((sayfa - 1) * sayfaBoyutu)
                .Take(sayfaBoyutu)
                .ToListAsync();

            var response = yorumlar.Select(y => new YorumListDto
            {
                Id = y.Id,
                KullaniciId = y.KullaniciId,
                KullaniciAdi = y.Kullanici.KullaniciAdi,
                KullaniciAvatar = y.Kullanici.AvatarUrl,
                Baslik = y.Baslik,
                Icerik = y.IcerikMetni,
                IcerikOzet = y.IcerikMetni.Length > 150 ? y.IcerikMetni.Substring(0, 150) + "..." : y.IcerikMetni,
                Puan = y.Puan,
                SpoilerIceriyor = y.SpoilerIceriyor,
                BegeniSayisi = y.Begenenler.Count,
                KullaniciBegendiMi = kullaniciId.HasValue && y.Begenenler.Any(b => b.KullaniciId == kullaniciId.Value),
                OlusturulmaZamani = y.OlusturulmaZamani,
                UstYorumId = y.UstYorumId,
                Yanitlar = y.Yanitlar
                    .Where(r => !r.Silindi)
                    .OrderBy(r => r.OlusturulmaZamani)
                    .Select(r => new YorumListDto
                    {
                        Id = r.Id,
                        KullaniciId = r.KullaniciId,
                        KullaniciAdi = r.Kullanici.KullaniciAdi,
                        KullaniciAvatar = r.Kullanici.AvatarUrl,
                        Baslik = r.Baslik,
                        Icerik = r.IcerikMetni,
                        IcerikOzet = r.IcerikMetni,
                        Puan = r.Puan,
                        SpoilerIceriyor = r.SpoilerIceriyor,
                        BegeniSayisi = r.Begenenler.Count,
                        KullaniciBegendiMi = kullaniciId.HasValue && r.Begenenler.Any(b => b.KullaniciId == kullaniciId.Value),
                        OlusturulmaZamani = r.OlusturulmaZamani,
                        UstYorumId = r.UstYorumId
                    }).ToList()
            }).ToList();

            Response.Headers.Append("X-Toplam-Sayfa", ((toplam + sayfaBoyutu - 1) / sayfaBoyutu).ToString());
            Response.Headers.Append("X-Toplam-Kayit", toplam.ToString());

            return Ok(response);
        }

        // POST: api/yorum/{id}/begeni
        [HttpPost("{id}/begeni")]
        [Authorize]
        public async Task<IActionResult> ToggleBegeni(long id)
        {
            try
            {
                var kullaniciId = GetCurrentUserId();

                var yorum = await _context.Yorumlar
                    .Include(y => y.Begenenler)
                    .Include(y => y.Kullanici)
                    .FirstOrDefaultAsync(y => y.Id == id && !y.Silindi);

                if (yorum == null)
                {
                    return NotFound(new { message = "Yorum bulunamadı." });
                }

                var mevcutBegeni = yorum.Begenenler
                    .FirstOrDefault(b => b.KullaniciId == kullaniciId);

                if (mevcutBegeni != null)
                {
                    // Beğeniyi kaldır
                    _context.YorumBegenileri.Remove(mevcutBegeni);
                    await _context.SaveChangesAsync();
                    var yeniBegeniSayisi = await _context.YorumBegenileri.CountAsync(b => b.YorumId == id);
                    return Ok(new { message = "Beğeni kaldırıldı", begendi = false, begeniSayisi = yeniBegeniSayisi });
                }
                else
                {
                    // Beğeni ekle
                    var begeni = new YorumBegeni
                    {
                        YorumId = id,
                        KullaniciId = kullaniciId,
                        OlusturulmaZamani = DateTime.UtcNow
                    };
                    _context.YorumBegenileri.Add(begeni);
                    
                    // 🔔 Kullanıcı ayarlarına göre bildirim oluştur (kendi yorumunu beğendiyse hariç)
                    if (yorum.KullaniciId != kullaniciId)
                    {
                        var begenen = await _context.Kullanicilar.FindAsync(kullaniciId);
                        await _bildirimService.BildirimOlusturAsync(new Bildirim
                        {
                            AliciId = yorum.KullaniciId,
                            GonderenId = kullaniciId,
                            Tip = "yorum_begeni",
                            Baslik = "Yorumunuz Beğenildi",
                            Mesaj = $"{begenen?.KullaniciAdi ?? "Birisi"} yorumunuzu beğendi",
                            IcerikId = yorum.IcerikId,
                            YorumId = yorum.Id,
                            LinkUrl = $"/icerik/{yorum.IcerikId}",
                            OlusturulmaZamani = DateTime.UtcNow
                        });
                    }
                    
                    await _context.SaveChangesAsync();
                    var guncelBegeniSayisi = await _context.YorumBegenileri.CountAsync(b => b.YorumId == id);
                    return Ok(new { message = "Yorum beğenildi", begendi = true, begeniSayisi = guncelBegeniSayisi });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Beğeni işlenirken hata: {YorumId}", id);
                return StatusCode(500, new { message = "Beğeni işlenirken bir hata oluştu." });
            }
        }

        // Helper Methods BaseApiController'dan gelmektedir.
        private async Task CreateAktivite(Guid kullaniciId, long yorumId)
        {
            var aktivite = new Aktivite
            {
                KullaniciId = kullaniciId,
                AktiviteTuru = AktiviteTuru.yorum,
                YorumId = yorumId,
                OlusturulmaZamani = DateTime.UtcNow
            };

            _context.Aktiviteler.Add(aktivite);
            await _context.SaveChangesAsync();
        }
    }
}
