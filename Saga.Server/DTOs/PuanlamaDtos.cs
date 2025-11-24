using System.ComponentModel.DataAnnotations;

namespace Saga.Server.DTOs
{
    // Yeni puanlama oluşturma
    public class PuanlamaCreateDto
    {
        [Required]
        public long IcerikId { get; set; }

        [Required]
        [Range(1.0, 10.0, ErrorMessage = "Puan 1.0 ile 10.0 arasında olmalıdır")]
        public decimal Puan { get; set; }
    }

    // Puanlama güncelleme
    public class PuanlamaUpdateDto
    {
        [Required]
        [Range(1.0, 10.0, ErrorMessage = "Puan 1.0 ile 10.0 arasında olmalıdır")]
        public decimal Puan { get; set; }
    }

    // Puanlama yanıtı
    public class PuanlamaResponseDto
    {
        public long Id { get; set; }
        public Guid KullaniciId { get; set; }
        public string KullaniciAdi { get; set; } = null!;
        public long IcerikId { get; set; }
        public string IcerikBaslik { get; set; } = null!;
        public decimal Puan { get; set; }
        public DateTime OlusturulmaZamani { get; set; }
        public DateTime? GuncellemeZamani { get; set; }
    }

    // İçerik için puanlama istatistikleri
    public class PuanlamaIstatistikDto
    {
        public long IcerikId { get; set; }
        public decimal OrtalamaPuan { get; set; }
        public int ToplamPuanlama { get; set; }
        public int Puan10Sayisi { get; set; }
        public int Puan9Sayisi { get; set; }
        public int Puan8Sayisi { get; set; }
        public int Puan7Sayisi { get; set; }
        public int Puan6Sayisi { get; set; }
        public int Puan5Sayisi { get; set; }
        public int Puan4Sayisi { get; set; }
        public int Puan3Sayisi { get; set; }
        public int Puan2Sayisi { get; set; }
        public int Puan1Sayisi { get; set; }
    }
}
