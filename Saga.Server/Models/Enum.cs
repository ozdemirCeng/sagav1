namespace Saga.Server.Models
{
    // Veritabanındaki isimlerle birebir aynı (küçük harf) olmalı
    public enum ApiKaynak
    {
        tmdb,
        google_books,
        diger
    }

    public enum IcerikTuru
    {
        film,
        kitap
    }

    public enum KullaniciRol
    {
        yonetici,
        kullanici
    }

    public enum AktiviteTuru
    {
        puanlama,
        yorum,
        liste_olusturma,
        icerik_ekleme,
        takip
    }

    public enum ListeTuru
    {
        sistem,
        ozel
    }

    public enum KutuphaneDurum
    {
        izlendi,
        izleniyor,
        izlenecek,
        okundu,
        okunuyor,
        okunacak,
        birakildi
    }
}