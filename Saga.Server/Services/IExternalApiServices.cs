using Saga.Server.Models;

namespace Saga.Server.Services
{
    public interface ITmdbService
    {
        Task<TmdbFilmDto?> GetFilmByIdAsync(string tmdbId);
        Task<TmdbFilmDto?> GetTvShowByIdAsync(string tmdbId);
        Task<List<TmdbFilmDto>> SearchFilmsAsync(string query, int page = 1);
        Task<List<TmdbFilmDto>> SearchTvShowsAsync(string query, int page = 1);
        Task<List<TmdbFilmDto>> SearchMultiAsync(string query, int page = 1);
        Task<List<TmdbFilmDto>> GetPopularFilmsAsync(int page = 1);
        Task<List<TmdbFilmDto>> GetPopularTvShowsAsync(int page = 1);
        Task<List<TmdbFilmDto>> GetTopRatedFilmsAsync(int page = 1);
        Task<List<TmdbFilmDto>> GetTopRatedTvShowsAsync(int page = 1);
        Task<List<TmdbFilmDto>> GetNowPlayingFilmsAsync(int page = 1);
        Task<List<TmdbFilmDto>> GetOnTheAirTvShowsAsync(int page = 1);
        Task<List<TmdbFilmDto>> GetTrendingAsync(string mediaType = "all", string timeWindow = "week", int page = 1);
        Task<List<TmdbFilmDto>> DiscoverFilmsAsync(int page = 1, string? sortBy = "popularity.desc", int? minYear = null, int? maxYear = null, double? minRating = null, string? withGenres = null);
        Task<List<TmdbFilmDto>> DiscoverTvShowsAsync(int page = 1, string? sortBy = "popularity.desc", int? minYear = null, int? maxYear = null, double? minRating = null, string? withGenres = null);
        Task<Icerik?> ImportFilmAsync(string tmdbId);
        Task<Icerik?> ImportTvShowAsync(string tmdbId);
    }

    public interface IGoogleBooksService
    {
        Task<GoogleBookDto?> GetBookByIdAsync(string googleBooksId);
        Task<GoogleBooksSearchResult> SearchBooksAsync(string query, int startIndex = 0, int maxResults = 20, string? orderBy = null, string? langRestrict = null, string? filter = null);
        Task<Icerik?> ImportBookAsync(string googleBooksId);
        Task<string?> FindDescriptionForBookAsync(string title, string? author);
    }

    public interface IOpenLibraryService
    {
        Task<OpenLibraryBookDto?> GetBookByIsbnAsync(string isbn);
        Task<OpenLibraryBookDto?> GetBookByOlidAsync(string olid);
        Task<OpenLibraryBookDto?> GetBookByWorkKeyAsync(string workKey);
        Task<OpenLibraryBookDto?> FindBookAsync(string title, string? author = null);
        Task<OpenLibrarySearchResult> SearchBooksAsync(string query, int page = 1, int limit = 20);
        Task<Icerik?> ImportBookAsync(string olid);
    }

    // Google Books Arama Sonucu (totalItems ile birlikte)
    public class GoogleBooksSearchResult
    {
        public List<GoogleBookDto> Items { get; set; } = new();
        public int TotalItems { get; set; }
    }

    // TMDB Film/Dizi DTO
    public class TmdbFilmDto
    {
        public string Id { get; set; } = null!;
        public string Baslik { get; set; } = null!;
        public string? Aciklama { get; set; }
        public string? PosterUrl { get; set; }
        public string? ArkaplanUrl { get; set; }
        public string? YayinTarihi { get; set; }
        public double Puan { get; set; }
        public int OySayisi { get; set; }
        public string? OrijinalDil { get; set; }
        public List<int>? TurIds { get; set; }
        public List<string>? Turler { get; set; } // Tür adları
        public string? Yonetmen { get; set; }
        public List<OyuncuDto>? Oyuncular { get; set; }
        public int? Sure { get; set; } // Dakika cinsinden
        public int? SezonSayisi { get; set; } // Diziler için
        public int? BolumSayisi { get; set; } // Diziler için
        public string MediaType { get; set; } = "movie"; // movie veya tv
        
        // SAGA platformundaki ortalama puan (veritabanında kayıtlıysa)
        public decimal? SagaOrtalamaPuan { get; set; }
        public int? SagaIcerikId { get; set; } // Veritabanındaki içerik ID'si
        
        // Fragman ve izleme platformları
        public List<VideoDto>? Videos { get; set; }
        public List<WatchProviderDto>? WatchProviders { get; set; }
    }

    // Video DTO (Fragman bilgisi)
    public class VideoDto
    {
        public string Key { get; set; } = null!; // YouTube video ID
        public string Site { get; set; } = "YouTube"; // Video sitesi
        public string Type { get; set; } = "Trailer"; // Trailer, Teaser, Clip vb.
        public string? Name { get; set; } // Video başlığı
        public bool Official { get; set; } = true; // Resmi fragman mı?
    }

    // Watch Provider DTO (İzleme platformu)
    public class WatchProviderDto
    {
        public int ProviderId { get; set; }
        public string ProviderName { get; set; } = null!; // Netflix, Amazon Prime vb.
        public string? LogoUrl { get; set; } // Platform logo URL
        public string Type { get; set; } = "flatrate"; // flatrate (abone), rent (kiralık), buy (satın al)
        public string? Link { get; set; } // JustWatch linki
    }

    // Oyuncu DTO
    public class OyuncuDto
    {
        public string? HariciId { get; set; } // TMDB person ID
        public string Ad { get; set; } = null!;
        public string? Karakter { get; set; }
        public string? ProfilUrl { get; set; }
        public int Sira { get; set; } // Kredilerde sıralama
    }

    // Google Books DTO
    public class GoogleBookDto
    {
        public string Id { get; set; } = null!;
        public string Baslik { get; set; } = null!;
        public List<string>? Yazarlar { get; set; }
        public string? Aciklama { get; set; }
        public string? YayinTarihi { get; set; }
        public string? PosterUrl { get; set; }
        public string? Dil { get; set; }
        public int? SayfaSayisi { get; set; }
        public List<string>? Kategoriler { get; set; }
        public double? OrtalamaPuan { get; set; }
        public int? OySayisi { get; set; }
        public string? Yayinevi { get; set; }
        public string? ISBN { get; set; }
        public string? OkumaLinki { get; set; }
        public string? Kaynak { get; set; } // google_books | openlibrary
    }

    public class OpenLibrarySearchResult
    {
        public List<OpenLibraryBookDto> Items { get; set; } = new();
        public int TotalItems { get; set; }
    }

    public class OpenLibraryBookDto
    {
        public string Id { get; set; } = null!; // OLID veya Work Key
        public string Baslik { get; set; } = null!;
        public List<string>? Yazarlar { get; set; }
        public string? Aciklama { get; set; }
        public string? YayinTarihi { get; set; }
        public string? PosterUrl { get; set; }
        public string? Dil { get; set; }
        public int? SayfaSayisi { get; set; }
        public List<string>? Kategoriler { get; set; }
        public string? Yayinevi { get; set; }
        public string? ISBN { get; set; }
        public string? OkumaLinki { get; set; }
        public string? WorkKey { get; set; }
    }
}

