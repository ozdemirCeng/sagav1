using Saga.Server.Data;
using Saga.Server.Models;
using System.Net.Http.Json;
using System.Text.Json;

namespace Saga.Server.Services
{
    public class TmdbService : ITmdbService
    {
        private readonly HttpClient _httpClient;
        private readonly SagaDbContext _context;
        private readonly ILogger<TmdbService> _logger;
        private readonly string _apiKey;
        private readonly string _bearerToken;
        private const string BaseUrl = "https://api.themoviedb.org/3";
        private const string ImageBaseUrl = "https://image.tmdb.org/t/p/w500";

        public TmdbService(
            HttpClient httpClient,
            SagaDbContext context,
            ILogger<TmdbService> logger,
            IConfiguration configuration)
        {
            _httpClient = httpClient;
            _context = context;
            _logger = logger;
            _apiKey = configuration["TMDB:ApiKey"] ?? throw new InvalidOperationException("TMDB API Key bulunamadı!");
            _bearerToken = configuration["TMDB:BearerToken"] ?? "";
            
            // Bearer token varsa Authorization header ekle
            if (!string.IsNullOrEmpty(_bearerToken))
            {
                _httpClient.DefaultRequestHeaders.Authorization = 
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _bearerToken);
            }
        }

        public async Task<TmdbFilmDto?> GetFilmByIdAsync(string tmdbId)
        {
            try
            {
                var url = !string.IsNullOrEmpty(_bearerToken)
                    ? $"{BaseUrl}/movie/{tmdbId}?language=tr-TR"
                    : $"{BaseUrl}/movie/{tmdbId}?api_key={_apiKey}&language=tr-TR";
                var response = await _httpClient.GetAsync(url);
                
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("TMDB API hatası: {StatusCode} - Film ID: {TmdbId}", response.StatusCode, tmdbId);
                    return null;
                }

                var content = await response.Content.ReadAsStringAsync();
                var movieData = JsonSerializer.Deserialize<JsonElement>(content);

                return new TmdbFilmDto
                {
                    Id = movieData.GetProperty("id").GetInt32().ToString(),
                    Baslik = movieData.TryGetProperty("title", out var title) ? title.GetString() ?? "" : "",
                    Aciklama = movieData.TryGetProperty("overview", out var overview) ? overview.GetString() : null,
                    PosterUrl = movieData.TryGetProperty("poster_path", out var poster) && !poster.ValueEquals("null")
                        ? ImageBaseUrl + poster.GetString()
                        : null,
                    ArkaplanUrl = movieData.TryGetProperty("backdrop_path", out var backdrop) && !backdrop.ValueEquals("null")
                        ? "https://image.tmdb.org/t/p/original" + backdrop.GetString()
                        : null,
                    YayinTarihi = movieData.TryGetProperty("release_date", out var date) ? date.GetString() : null,
                    Puan = movieData.TryGetProperty("vote_average", out var avg) ? avg.GetDouble() : 0,
                    OySayisi = movieData.TryGetProperty("vote_count", out var count) ? count.GetInt32() : 0,
                    OrijinalDil = movieData.TryGetProperty("original_language", out var lang) ? lang.GetString() : null
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TMDB film bilgisi alınırken hata: {TmdbId}", tmdbId);
                return null;
            }
        }

        public async Task<List<TmdbFilmDto>> SearchFilmsAsync(string query, int page = 1)
        {
            try
            {
                var encodedQuery = Uri.EscapeDataString(query);
                var url = !string.IsNullOrEmpty(_bearerToken)
                    ? $"{BaseUrl}/search/movie?language=tr-TR&query={encodedQuery}&page={page}"
                    : $"{BaseUrl}/search/movie?api_key={_apiKey}&language=tr-TR&query={encodedQuery}&page={page}";
                var response = await _httpClient.GetAsync(url);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("TMDB arama hatası: {StatusCode}", response.StatusCode);
                    return new List<TmdbFilmDto>();
                }

                var content = await response.Content.ReadAsStringAsync();
                var searchData = JsonSerializer.Deserialize<JsonElement>(content);

                var results = new List<TmdbFilmDto>();

                if (searchData.TryGetProperty("results", out var resultsArray))
                {
                    foreach (var movie in resultsArray.EnumerateArray())
                    {
                        results.Add(new TmdbFilmDto
                        {
                            Id = movie.GetProperty("id").GetInt32().ToString(),
                            Baslik = movie.TryGetProperty("title", out var title) ? title.GetString() ?? "" : "",
                            Aciklama = movie.TryGetProperty("overview", out var overview) ? overview.GetString() : null,
                            PosterUrl = movie.TryGetProperty("poster_path", out var poster) && !poster.ValueEquals("null")
                                ? ImageBaseUrl + poster.GetString()
                                : null,
                            YayinTarihi = movie.TryGetProperty("release_date", out var date) ? date.GetString() : null,
                            Puan = movie.TryGetProperty("vote_average", out var avg) ? avg.GetDouble() : 0,
                            OySayisi = movie.TryGetProperty("vote_count", out var count) ? count.GetInt32() : 0
                        });
                    }
                }

                return results;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TMDB film araması sırasında hata: {Query}", query);
                return new List<TmdbFilmDto>();
            }
        }

        public async Task<List<TmdbFilmDto>> GetPopularFilmsAsync(int page = 1)
        {
            try
            {
                var url = !string.IsNullOrEmpty(_bearerToken)
                    ? $"{BaseUrl}/movie/popular?language=tr-TR&page={page}"
                    : $"{BaseUrl}/movie/popular?api_key={_apiKey}&language=tr-TR&page={page}";
                var response = await _httpClient.GetAsync(url);

                if (!response.IsSuccessStatusCode)
                {
                    return new List<TmdbFilmDto>();
                }

                var content = await response.Content.ReadAsStringAsync();
                var data = JsonSerializer.Deserialize<JsonElement>(content);

                return ParseMovieResults(data);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TMDB popüler filmler alınırken hata");
                return new List<TmdbFilmDto>();
            }
        }

        public async Task<List<TmdbFilmDto>> GetTopRatedFilmsAsync(int page = 1)
        {
            try
            {
                var url = !string.IsNullOrEmpty(_bearerToken)
                    ? $"{BaseUrl}/movie/top_rated?language=tr-TR&page={page}"
                    : $"{BaseUrl}/movie/top_rated?api_key={_apiKey}&language=tr-TR&page={page}";
                var response = await _httpClient.GetAsync(url);

                if (!response.IsSuccessStatusCode)
                {
                    return new List<TmdbFilmDto>();
                }

                var content = await response.Content.ReadAsStringAsync();
                var data = JsonSerializer.Deserialize<JsonElement>(content);

                return ParseMovieResults(data);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TMDB en iyi filmler alınırken hata");
                return new List<TmdbFilmDto>();
            }
        }

        public async Task<Icerik?> ImportFilmAsync(string tmdbId)
        {
            try
            {
                // Önce veritabanında var mı kontrol et
                var mevcutIcerik = _context.Icerikler
                    .FirstOrDefault(i => i.HariciId == tmdbId && i.ApiKaynagi == ApiKaynak.tmdb);

                if (mevcutIcerik != null)
                {
                    _logger.LogInformation("Film zaten mevcut: {TmdbId}", tmdbId);
                    return mevcutIcerik;
                }

                // TMDB'den bilgileri al
                var filmDto = await GetFilmByIdAsync(tmdbId);
                if (filmDto == null)
                {
                    return null;
                }

                // Veritabanına kaydet
                var icerik = new Icerik
                {
                    HariciId = tmdbId,
                    ApiKaynagi = ApiKaynak.tmdb,
                    Tur = IcerikTuru.film,
                    Baslik = filmDto.Baslik,
                    Aciklama = filmDto.Aciklama,
                    PosterUrl = filmDto.PosterUrl,
                    YayinTarihi = ParseDateOnly(filmDto.YayinTarihi),
                    OlusturulmaZamani = DateTime.UtcNow
                };

                _context.Icerikler.Add(icerik);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Film başarıyla import edildi: {Title} (TMDB ID: {TmdbId})", icerik.Baslik, tmdbId);
                return icerik;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Film import edilirken hata: {TmdbId}", tmdbId);
                return null;
            }
        }

        private List<TmdbFilmDto> ParseMovieResults(JsonElement data)
        {
            var results = new List<TmdbFilmDto>();

            if (data.TryGetProperty("results", out var resultsArray))
            {
                foreach (var movie in resultsArray.EnumerateArray())
                {
                    results.Add(new TmdbFilmDto
                    {
                        Id = movie.GetProperty("id").GetInt32().ToString(),
                        Baslik = movie.TryGetProperty("title", out var title) ? title.GetString() ?? "" : "",
                        Aciklama = movie.TryGetProperty("overview", out var overview) ? overview.GetString() : null,
                        PosterUrl = movie.TryGetProperty("poster_path", out var poster) && !poster.ValueEquals("null")
                            ? ImageBaseUrl + poster.GetString()
                            : null,
                        YayinTarihi = movie.TryGetProperty("release_date", out var date) ? date.GetString() : null,
                        Puan = movie.TryGetProperty("vote_average", out var avg) ? avg.GetDouble() : 0,
                        OySayisi = movie.TryGetProperty("vote_count", out var count) ? count.GetInt32() : 0
                    });
                }
            }

            return results;
        }

        private DateOnly? ParseDateOnly(string? dateString)
        {
            if (string.IsNullOrWhiteSpace(dateString))
                return null;

            if (DateOnly.TryParse(dateString, out var date))
                return date;

            return null;
        }
    }
}
