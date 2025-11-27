using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Saga.Server.Models
{
    [Table("kullanicilar")]
    public class Kullanici
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; }

        [Column("kullanici_adi")]
        public string KullaniciAdi { get; set; } = null!;

        [Column("eposta")]
        public string Eposta { get; set; } = null!;

        [Column("goruntuleme_adi")]
        public string? GoruntulemeAdi { get; set; }

        [Column("biyografi")]
        public string? Biyografi { get; set; }

        [Column("avatar_url")]
        public string? AvatarUrl { get; set; }

        [Column("kapak_resmi_url")]
        public string? KapakResmiUrl { get; set; }

        [Column("web_sitesi")]
        public string? WebSitesi { get; set; }

        [Column("konum")]
        public string? Konum { get; set; }

        [Column("dogum_tarihi")]
        public DateTime? DogumTarihi { get; set; }

        [Column("cinsiyet")]
        public string? Cinsiyet { get; set; }

        [Column("rol")]
        public KullaniciRol Rol { get; set; } = KullaniciRol.kullanici;

        [Column("aktif")]
        public bool Aktif { get; set; } = true;

        [Column("silindi")]
        public bool Silindi { get; set; } = false;

        [Column("son_giris_zamani")]
        public DateTime? SonGirisZamani { get; set; }

        [Column("giris_sayisi")]
        public int GirisSayisi { get; set; }

        // İstatistik alanları (cache)
        [Column("takipci_sayisi")]
        public int TakipciSayisi { get; set; } = 0;

        [Column("takip_edilen_sayisi")]
        public int TakipEdilenSayisi { get; set; } = 0;

        [Column("toplam_puan")]
        public int ToplamPuan { get; set; } = 0;

        [Column("toplam_yorum")]
        public int ToplamYorum { get; set; } = 0;

        [Column("toplam_liste")]
        public int ToplamListe { get; set; } = 0;

        [Column("olusturulma_zamani")]
        public DateTime OlusturulmaZamani { get; set; }

        [Column("guncelleme_zamani")]
        public DateTime GuncellemeZamani { get; set; }

        // Navigation properties
        public ICollection<Takip> Takipler { get; set; } = new List<Takip>(); // Takip ettikleri
        public ICollection<Takip> TakipEdenler { get; set; } = new List<Takip>(); // Onu takip edenler
        public ICollection<Puanlama> Puanlamalari { get; set; } = new List<Puanlama>();
        public ICollection<Yorum> Yorumlari { get; set; } = new List<Yorum>();
        public ICollection<Liste> Listeleri { get; set; } = new List<Liste>();
        public KullaniciAyarlari? Ayarlar { get; set; }
    }
}