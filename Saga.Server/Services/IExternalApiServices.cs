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
        public string Title { get; set; } = null!;
        public string? Overview { get; set; }
        public string? PosterPath { get; set; }
        public string? BackdropPath { get; set; }
        public string? ReleaseDate { get; set; }
        public double VoteAverage { get; set; }
        public int VoteCount { get; set; }
        public string? OriginalLanguage { get; set; }
        public List<int>? GenreIds { get; set; }
    }

    // Google Books DTO
    public class GoogleBookDto
    {
        public string Id { get; set; } = null!;
        public string Title { get; set; } = null!;
        public List<string>? Authors { get; set; }
        public string? Description { get; set; }
        public string? PublishedDate { get; set; }
        public string? Thumbnail { get; set; }
        public string? Language { get; set; }
        public int? PageCount { get; set; }
        public List<string>? Categories { get; set; }
        public double? AverageRating { get; set; }
        public int? RatingsCount { get; set; }
    }
}
