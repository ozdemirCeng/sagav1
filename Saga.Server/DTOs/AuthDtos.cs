namespace Saga.Server.DTOs
{
    public class RegisterDto
    {
        public string KullaniciAdi { get; set; } = string.Empty;
        public string Eposta { get; set; } = string.Empty;
        public string Sifre { get; set; } = string.Empty; // Supabase kullanacağımız için bu dummy olabilir
    }

    public class LoginDto
    {
        public string Eposta { get; set; } = string.Empty;
        public string Sifre { get; set; } = string.Empty;
    }
}