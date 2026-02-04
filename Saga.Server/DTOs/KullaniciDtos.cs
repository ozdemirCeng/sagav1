using System.ComponentModel.DataAnnotations;

namespace Saga.Server.DTOs
{
    // Kullanıcı profil görünümü
    public class ProfilDto
    {
        public Guid Id { get; set; }
        public string KullaniciAdi { get; set; } = null!;
        public string Eposta { get; set; } = null!;
        public string? GoruntulemeAdi { get; set; }
        public string? Biyografi { get; set; }
        public string? AvatarUrl { get; set; }
        public string Rol { get; set; } = null!;
        public DateTime OlusturulmaZamani { get; set; }
        
        // İstatistikler
        public int ToplamPuanlama { get; set; }
        public int ToplamYorum { get; set; }
        public int ToplamListe { get; set; }
        public int TakipEdenSayisi { get; set; }
        public int TakipEdilenSayisi { get; set; }
        
        // Mevcut kullanıcı bu kullanıcıyı takip ediyor mu?
        public bool TakipEdiyorMu { get; set; }
        
        // 🔒 Gizlilik: Profil gizli mi?
        public bool ProfilGizli { get; set; }
    }

    // Profil güncelleme
    public class ProfilUpdateDto
    {
        [MaxLength(100)]
        public string? GoruntulemeAdi { get; set; }

        [MaxLength(500)]
        public string? Biyografi { get; set; }

        [Url(ErrorMessage = "Geçerli bir URL giriniz.")]
        [MaxLength(500)]
        public string? AvatarUrl { get; set; }
    }

    // Kullanıcı listesi için hafif DTO
    public class KullaniciListDto
    {
        public Guid Id { get; set; }
        public string KullaniciAdi { get; set; } = null!;
        public string? GoruntulemeAdi { get; set; }
        public string? AvatarUrl { get; set; }
        public int TakipEdenSayisi { get; set; }
        public int ToplamPuanlama { get; set; }
    }

    // Takip yanıtı
    public class TakipDto
    {
        public Guid TakipEdenId { get; set; }
        public string TakipEdenKullaniciAdi { get; set; } = null!;
        public string? TakipEdenAvatar { get; set; }
        public Guid TakipEdilenId { get; set; }
        public string TakipEdilenKullaniciAdi { get; set; } = null!;
        public string? TakipEdilenAvatar { get; set; }
        public DateTime OlusturulmaZamani { get; set; }
    }

    // Kullanıcı istatistikleri
    public class KullaniciIstatistikDto
    {
        public Guid KullaniciId { get; set; }
        public int ToplamIzlenenFilm { get; set; }
        public int ToplamOkunanKitap { get; set; }
        public int ToplamPuanlama { get; set; }
        public int ToplamYorum { get; set; }
        public int ToplamListe { get; set; }
        public int TakipEdenSayisi { get; set; }
        public int TakipEdilenSayisi { get; set; }
        public decimal OrtalamaPuan { get; set; }
    }

    // Akıllı Öneri Sistemi için DTO
    // Benzer içerik türleriyle ilgilenen kullanıcı önerileri
    public class OnerilenKullaniciDto
    {
        public Guid Id { get; set; }
        public string KullaniciAdi { get; set; } = null!;
        public string? GoruntulemeAdi { get; set; }
        public string? AvatarUrl { get; set; }
        public int TakipEdenSayisi { get; set; }
        public int ToplamPuanlama { get; set; }
        public int OrtakIcerikSayisi { get; set; }
        public string OneriNedeni { get; set; } = null!; // "5 ortak içerik", "Film ilgisi", "Kitap ilgisi" vb.
    }
}
