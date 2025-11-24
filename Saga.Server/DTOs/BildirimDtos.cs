using Saga.Server.Models;

namespace Saga.Server.DTOs
{
    public class BildirimKullaniciDto
    {
        public Guid Id { get; set; }
        public string KullaniciAdi { get; set; } = string.Empty;
        public string? AvatarUrl { get; set; }
    }

    public class BildirimDto
    {
        public long Id { get; set; }
        public string Tip { get; set; } = string.Empty;
        public string? Baslik { get; set; }
        public string? Mesaj { get; set; }
        public string? LinkUrl { get; set; }
        public bool Okundu { get; set; }
        public DateTime OlusturulmaZamani { get; set; }
        public BildirimKullaniciDto? Gonderen { get; set; }
    }

    public class BildirimListResponseDto
    {
        public List<BildirimDto> Bildirimler { get; set; } = new();
        public int ToplamSayisi { get; set; }
        public int Sayfa { get; set; }
        public int ToplamSayfa { get; set; }
    }

    public class OkunmamisBildirimlerResponseDto
    {
        public List<BildirimDto> Bildirimler { get; set; } = new();
        public int OkunmamisSayisi { get; set; }
    }

    public class OkunmamisSayisiDto
    {
        public int OkunmamisSayisi { get; set; }
    }

    public class BildirimIslemSonucDto
    {
        public string Message { get; set; } = string.Empty;
    }

    public class TestBildirimDto
    {
        public Guid AliciId { get; set; }
        public string? Tip { get; set; }
        public string Baslik { get; set; } = string.Empty;
        public string Mesaj { get; set; } = string.Empty;
        public string? LinkUrl { get; set; }
    }
}
