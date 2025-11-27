using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Saga.Server.Data;
using Saga.Server.DTOs;
using Saga.Server.Models;

namespace Saga.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AyarlarController : BaseApiController
    {
        private readonly SagaDbContext _context;
        private readonly ILogger<AyarlarController> _logger;

        public AyarlarController(SagaDbContext context, ILogger<AyarlarController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // GET: api/ayarlar
        // Kullanıcı ayarlarını getir
        [HttpGet]
        [Authorize]
        public async Task<ActionResult<KullaniciAyarlariDto>> GetAyarlar()
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                
                var ayarlar = await _context.KullaniciAyarlari
                    .FirstOrDefaultAsync(a => a.KullaniciId == currentUserId);
                
                // Ayar yoksa default değerlerle oluştur
                if (ayarlar == null)
                {
                    ayarlar = new KullaniciAyarlari
                    {
                        KullaniciId = currentUserId,
                        OlusturulmaZamani = DateTime.UtcNow,
                        GuncellemeZamani = DateTime.UtcNow
                    };
                    _context.KullaniciAyarlari.Add(ayarlar);
                    await _context.SaveChangesAsync();
                }
                
                return Ok(new KullaniciAyarlariDto
                {
                    BildirimYeniTakipci = ayarlar.BildirimYeniTakipci,
                    BildirimYorumlar = ayarlar.BildirimYorumlar,
                    BildirimBegeniler = ayarlar.BildirimBegeniler,
                    BildirimOneriler = ayarlar.BildirimOneriler,
                    BildirimEmail = ayarlar.BildirimEmail,
                    ProfilGizli = ayarlar.ProfilGizli,
                    AktiviteGizli = ayarlar.AktiviteGizli,
                    Tema = ayarlar.Tema,
                    Dil = ayarlar.Dil
                });
            }
            catch (UnauthorizedAccessException)
            {
                return Unauthorized(new { message = "Giriş yapmanız gerekiyor" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ayarlar alınırken hata");
                return StatusCode(500, new { message = "Ayarlar alınırken bir hata oluştu." });
            }
        }

        // PUT: api/ayarlar
        // Kullanıcı ayarlarını güncelle
        [HttpPut]
        [Authorize]
        public async Task<ActionResult<KullaniciAyarlariDto>> UpdateAyarlar([FromBody] KullaniciAyarlariGuncelleDto dto)
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                
                var ayarlar = await _context.KullaniciAyarlari
                    .FirstOrDefaultAsync(a => a.KullaniciId == currentUserId);
                
                if (ayarlar == null)
                {
                    ayarlar = new KullaniciAyarlari
                    {
                        KullaniciId = currentUserId,
                        OlusturulmaZamani = DateTime.UtcNow
                    };
                    _context.KullaniciAyarlari.Add(ayarlar);
                }
                
                // Sadece gönderilen alanları güncelle
                if (dto.BildirimYeniTakipci.HasValue)
                    ayarlar.BildirimYeniTakipci = dto.BildirimYeniTakipci.Value;
                if (dto.BildirimYorumlar.HasValue)
                    ayarlar.BildirimYorumlar = dto.BildirimYorumlar.Value;
                if (dto.BildirimBegeniler.HasValue)
                    ayarlar.BildirimBegeniler = dto.BildirimBegeniler.Value;
                if (dto.BildirimOneriler.HasValue)
                    ayarlar.BildirimOneriler = dto.BildirimOneriler.Value;
                if (dto.BildirimEmail.HasValue)
                    ayarlar.BildirimEmail = dto.BildirimEmail.Value;
                if (dto.ProfilGizli.HasValue)
                    ayarlar.ProfilGizli = dto.ProfilGizli.Value;
                if (dto.AktiviteGizli.HasValue)
                    ayarlar.AktiviteGizli = dto.AktiviteGizli.Value;
                if (!string.IsNullOrEmpty(dto.Tema))
                    ayarlar.Tema = dto.Tema;
                if (!string.IsNullOrEmpty(dto.Dil))
                    ayarlar.Dil = dto.Dil;
                
                ayarlar.GuncellemeZamani = DateTime.UtcNow;
                
                await _context.SaveChangesAsync();
                
                return Ok(new KullaniciAyarlariDto
                {
                    BildirimYeniTakipci = ayarlar.BildirimYeniTakipci,
                    BildirimYorumlar = ayarlar.BildirimYorumlar,
                    BildirimBegeniler = ayarlar.BildirimBegeniler,
                    BildirimOneriler = ayarlar.BildirimOneriler,
                    BildirimEmail = ayarlar.BildirimEmail,
                    ProfilGizli = ayarlar.ProfilGizli,
                    AktiviteGizli = ayarlar.AktiviteGizli,
                    Tema = ayarlar.Tema,
                    Dil = ayarlar.Dil
                });
            }
            catch (UnauthorizedAccessException)
            {
                return Unauthorized(new { message = "Giriş yapmanız gerekiyor" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ayarlar güncellenirken hata");
                return StatusCode(500, new { message = "Ayarlar güncellenirken bir hata oluştu." });
            }
        }

        // PUT: api/ayarlar/bildirimler
        // Bildirim ayarlarını toplu güncelle
        [HttpPut("bildirimler")]
        [Authorize]
        public async Task<ActionResult> UpdateBildirimAyarlari([FromBody] KullaniciAyarlariGuncelleDto dto)
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                
                var ayarlar = await _context.KullaniciAyarlari
                    .FirstOrDefaultAsync(a => a.KullaniciId == currentUserId);
                
                if (ayarlar == null)
                {
                    ayarlar = new KullaniciAyarlari
                    {
                        KullaniciId = currentUserId,
                        OlusturulmaZamani = DateTime.UtcNow
                    };
                    _context.KullaniciAyarlari.Add(ayarlar);
                }
                
                if (dto.BildirimYeniTakipci.HasValue)
                    ayarlar.BildirimYeniTakipci = dto.BildirimYeniTakipci.Value;
                if (dto.BildirimYorumlar.HasValue)
                    ayarlar.BildirimYorumlar = dto.BildirimYorumlar.Value;
                if (dto.BildirimBegeniler.HasValue)
                    ayarlar.BildirimBegeniler = dto.BildirimBegeniler.Value;
                if (dto.BildirimOneriler.HasValue)
                    ayarlar.BildirimOneriler = dto.BildirimOneriler.Value;
                if (dto.BildirimEmail.HasValue)
                    ayarlar.BildirimEmail = dto.BildirimEmail.Value;
                
                ayarlar.GuncellemeZamani = DateTime.UtcNow;
                
                await _context.SaveChangesAsync();
                
                return Ok(new { message = "Bildirim ayarları güncellendi" });
            }
            catch (UnauthorizedAccessException)
            {
                return Unauthorized(new { message = "Giriş yapmanız gerekiyor" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Bildirim ayarları güncellenirken hata");
                return StatusCode(500, new { message = "Bildirim ayarları güncellenirken bir hata oluştu." });
            }
        }

        // PUT: api/ayarlar/gizlilik
        // Gizlilik ayarlarını toplu güncelle
        [HttpPut("gizlilik")]
        [Authorize]
        public async Task<ActionResult> UpdateGizlilikAyarlari([FromBody] KullaniciAyarlariGuncelleDto dto)
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                
                var ayarlar = await _context.KullaniciAyarlari
                    .FirstOrDefaultAsync(a => a.KullaniciId == currentUserId);
                
                if (ayarlar == null)
                {
                    ayarlar = new KullaniciAyarlari
                    {
                        KullaniciId = currentUserId,
                        OlusturulmaZamani = DateTime.UtcNow
                    };
                    _context.KullaniciAyarlari.Add(ayarlar);
                }
                
                if (dto.ProfilGizli.HasValue)
                    ayarlar.ProfilGizli = dto.ProfilGizli.Value;
                if (dto.AktiviteGizli.HasValue)
                    ayarlar.AktiviteGizli = dto.AktiviteGizli.Value;
                
                ayarlar.GuncellemeZamani = DateTime.UtcNow;
                
                await _context.SaveChangesAsync();
                
                return Ok(new { message = "Gizlilik ayarları güncellendi" });
            }
            catch (UnauthorizedAccessException)
            {
                return Unauthorized(new { message = "Giriş yapmanız gerekiyor" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Gizlilik ayarları güncellenirken hata");
                return StatusCode(500, new { message = "Gizlilik ayarları güncellenirken bir hata oluştu." });
            }
        }
    }
}
