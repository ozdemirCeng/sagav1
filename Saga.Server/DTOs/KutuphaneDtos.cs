using System.ComponentModel.DataAnnotations;

namespace Saga.Server.DTOs
{
    // Kütüphane durumu oluşturma/güncelleme
    public class KutuphaneDurumCreateDto
    {
        [Required]
        public long IcerikId { get; set; }

        [Required]
        public string Durum { get; set; } = null!; // izlendi, izlenecek, okundu, okunacak, devam_ediyor

        [Range(0, 100)]
        public decimal Ilerleme { get; set; } = 0;

        public DateOnly? BaslangicTarihi { get; set; }

        public DateOnly? BitisTarihi { get; set; }
    }

    // Kütüphane durumu güncelleme
    public class KutuphaneDurumUpdateDto
    {
        [Required]
        public string Durum { get; set; } = null!;

        [Range(0, 100)]
        public decimal Ilerleme { get; set; }

        public DateOnly? BaslangicTarihi { get; set; }

        public DateOnly? BitisTarihi { get; set; }
    }

    // Kütüphane durumu yanıtı
    public class KutuphaneDurumDto
    {
        public long Id { get; set; }
        public Guid KullaniciId { get; set; }
        public long IcerikId { get; set; }
        public string IcerikBaslik { get; set; } = null!;
        public string IcerikTur { get; set; } = null!;
        public string? PosterUrl { get; set; }
        public string Durum { get; set; } = null!;
        public decimal Ilerleme { get; set; }
        public DateOnly? BaslangicTarihi { get; set; }
        public DateOnly? BitisTarihi { get; set; }
        public DateTime OlusturulmaZamani { get; set; }
        public DateTime GuncellemeZamani { get; set; }
    }

    // Kütüphane listesi için
    public class KutuphaneListDto
    {
        public long IcerikId { get; set; }
        public string Baslik { get; set; } = null!;
        public string Tur { get; set; } = null!;
        public string? PosterUrl { get; set; }
        public decimal OrtalamaPuan { get; set; }
        public string Durum { get; set; } = null!;
        public decimal Ilerleme { get; set; }
        public DateTime GuncellemeZamani { get; set; }
    }

    // Kütüphane istatistikleri
    public class KutuphaneIstatistikDto
    {
        public Guid KullaniciId { get; set; }
        public int ToplamFilm { get; set; }
        public int IzlenenFilm { get; set; }
        public int IzlenecekFilm { get; set; }
        public int DevamEdenFilm { get; set; }
        public int ToplamKitap { get; set; }
        public int OkunanKitap { get; set; }
        public int OkunacakKitap { get; set; }
        public int DevamEdenKitap { get; set; }
    }
}
