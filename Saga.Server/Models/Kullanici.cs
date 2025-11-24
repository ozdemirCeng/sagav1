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

        [Column("olusturulma_zamani")]
        public DateTime OlusturulmaZamani { get; set; }

        [Column("guncelleme_zamani")]
        public DateTime GuncellemeZamani { get; set; }
    }
}