namespace Saga.Server.DTOs
{
    // Kullanıcı ayarları görüntüleme
    public class KullaniciAyarlariDto
    {
        public bool BildirimYeniTakipci { get; set; } = true;
        public bool BildirimYorumlar { get; set; } = true;
        public bool BildirimBegeniler { get; set; } = true;
        public bool BildirimOneriler { get; set; } = false;
        public bool BildirimEmail { get; set; } = false;
        public bool ProfilGizli { get; set; } = false;
        public bool AktiviteGizli { get; set; } = false;
        public string Tema { get; set; } = "sistem";
        public string Dil { get; set; } = "tr";
    }
    
    // Ayar güncelleme
    public class KullaniciAyarlariGuncelleDto
    {
        public bool? BildirimYeniTakipci { get; set; }
        public bool? BildirimYorumlar { get; set; }
        public bool? BildirimBegeniler { get; set; }
        public bool? BildirimOneriler { get; set; }
        public bool? BildirimEmail { get; set; }
        public bool? ProfilGizli { get; set; }
        public bool? AktiviteGizli { get; set; }
        public string? Tema { get; set; }
        public string? Dil { get; set; }
    }
    
    // Güvenlik ayarları güncelleme
    public class GuvenlikAyarlariDto
    {
        public string? MevcutSifre { get; set; }
        public string? YeniSifre { get; set; }
        public string? YeniSifreTekrar { get; set; }
    }
    
    // Hesap silme
    public class HesapSilDto
    {
        public string Sifre { get; set; } = null!;
        public string Onay { get; set; } = null!; // "SİL" yazmalı
    }
}
