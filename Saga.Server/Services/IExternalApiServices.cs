using Saga.Server.Models;

namespace Saga.Server.Services
{
    public interface ITmdbService
    {
        Task<TmdbFilmDto?> GetFilmByIdAsync(string tmdbId);
        Task<List<TmdbFilmDto>> SearchFilmsAsync(string query, int page = 1);
        Task<List<TmdbFilmDto>> GetPopularFilmsAsync(int page = 1);
        Task<List<TmdbFilmDto>> GetTopRatedFilmsAsync(int page = 1);
        Task<Icerik?> ImportFilmAsync(string tmdbId);
    }

    public interface IGoogleBooksService
    {
        Task<GoogleBookDto?> GetBookByIdAsync(string googleBooksId);
        Task<List<GoogleBookDto>> SearchBooksAsync(string query, int startIndex = 0, int maxResults = 20);
        Task<Icerik?> ImportBookAsync(string googleBooksId);
    }

    // TMDB Film DTO
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
    }
}
