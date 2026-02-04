using Microsoft.EntityFrameworkCore;
using Saga.Server.Data;
using Saga.Server.Models;

namespace Saga.Server.Services
{
    /// <summary>
    /// Bildirim oluşturma ve gönderme servisi.
    /// Kullanıcı bildirim tercihlerini kontrol eder.
    /// </summary>
    public interface IBildirimService
    {
        Task<bool> BildirimOlusturAsync(Bildirim bildirim);
    }

    public class BildirimService : IBildirimService
    {
        private readonly SagaDbContext _context;
        private readonly ILogger<BildirimService> _logger;

        public BildirimService(SagaDbContext context, ILogger<BildirimService> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// Kullanıcı ayarlarını kontrol ederek bildirim oluşturur.
        /// Eğer kullanıcı bu tip bildirimleri kapatmışsa bildirim oluşturulmaz.
        /// </summary>
        public async Task<bool> BildirimOlusturAsync(Bildirim bildirim)
        {
            try
            {
                // Alıcının ayarlarını kontrol et
                var ayarlar = await _context.KullaniciAyarlari
                    .AsNoTracking()
                    .FirstOrDefaultAsync(a => a.KullaniciId == bildirim.AliciId);

                // Ayarlar yoksa varsayılan olarak bildirimlere izin ver
                if (ayarlar == null)
                {
                    _context.Bildirimler.Add(bildirim);
                    await _context.SaveChangesAsync();
                    return true;
                }

                // Bildirim tipine göre kontrol et
                bool bildirimIzinliMi = bildirim.Tip switch
                {
                    // Takipçi bildirimleri
                    "takip" or "yeni_takipci" => ayarlar.BildirimYeniTakipci,
                    
                    // Yorum bildirimleri
                    "yorum" or "yorum_yanit" or "yorum_begeni" => ayarlar.BildirimYorumlar,
                    
                    // Beğeni bildirimleri
                    "begeni" or "icerik_begeni" or "aktivite_begeni" => ayarlar.BildirimBegeniler,
                    
                    // Öneri bildirimleri
                    "oneri" or "icerik_onerisi" => ayarlar.BildirimOneriler,
                    
                    // Diğer bildirimler her zaman izinli
                    _ => true
                };

                if (!bildirimIzinliMi)
                {
                    _logger.LogDebug(
                        "Bildirim oluşturulmadı: Kullanıcı {KullaniciId} '{Tip}' tipinde bildirimleri kapatmış",
                        bildirim.AliciId, bildirim.Tip);
                    return false;
                }

                _context.Bildirimler.Add(bildirim);
                await _context.SaveChangesAsync();
                
                _logger.LogDebug(
                    "Bildirim oluşturuldu: {Tip} -> {AliciId}",
                    bildirim.Tip, bildirim.AliciId);
                
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Bildirim oluşturulurken hata: {Tip}", bildirim.Tip);
                return false;
            }
        }
    }
}
