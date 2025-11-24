using Saga.Server.Models;

namespace Saga.Server.DTOs
{
    // Liste görünümü için hafif DTO
    public class IcerikListDto
    {
        public long Id { get; set; }
        public string Baslik { get; set; } = null!;
        public string Tur { get; set; } = null!;
        public string? PosterUrl { get; set; }
        public decimal OrtalamaPuan { get; set; }
        public int PuanlamaSayisi { get; set; }
        public decimal PopulerlikSkoru { get; set; }
        public DateOnly? YayinTarihi { get; set; }
    }

    // Detay sayfası için tam DTO
    public class IcerikDetailDto
    {
        public long Id { get; set; }
        public string HariciId { get; set; } = null!;
        public string ApiKaynagi { get; set; } = null!;
        public string Tur { get; set; } = null!;
        public string Baslik { get; set; } = null!;
        public string? Aciklama { get; set; }
        public string? PosterUrl { get; set; }
        public DateOnly? YayinTarihi { get; set; }
        public decimal OrtalamaPuan { get; set; }
        public int PuanlamaSayisi { get; set; }
        public int YorumSayisi { get; set; }
        public int ListeyeEklenmeSayisi { get; set; }
        public int GoruntulemeSayisi { get; set; }
        public decimal PopulerlikSkoru { get; set; }
        public DateTime OlusturulmaZamani { get; set; }
        
        // Kullanıcının bu içerikle ilişkisi (varsa)
        public decimal? KullaniciPuani { get; set; }
        public string? KullanicininDurumu { get; set; } // izlendi, izlenecek vs.
    }

    // Arama sonuçları için
    public class IcerikSearchDto
    {
        public long Id { get; set; }
        public string Baslik { get; set; } = null!;
        public string Tur { get; set; } = null!;
        public string? PosterUrl { get; set; }
        public decimal OrtalamaPuan { get; set; }
        public DateOnly? YayinTarihi { get; set; }
        public string? Aciklama { get; set; }
    }

    // Filtreleme için query parametreleri
    public class IcerikFilterDto
    {
        public string? Tur { get; set; } // film, kitap
        public string? Siralama { get; set; } // populerlik, puan, tarih
        public int? MinPuan { get; set; }
        public int? MinYil { get; set; }
        public int? MaxYil { get; set; }
        public int Page { get; set; } = 1;
        public int Limit { get; set; } = 20;
    }
}
