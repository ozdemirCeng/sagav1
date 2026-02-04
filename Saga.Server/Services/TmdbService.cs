using Microsoft.EntityFrameworkCore;
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

        private string BuildUrl(string endpoint)
        {
            return !string.IsNullOrEmpty(_bearerToken)
                ? $"{BaseUrl}{endpoint}{(endpoint.Contains("?") ? "&" : "?")}language=tr-TR"
                : $"{BaseUrl}{endpoint}{(endpoint.Contains("?") ? "&" : "?")}api_key={_apiKey}&language=tr-TR";
        }

        public async Task<TmdbFilmDto?> GetFilmByIdAsync(string tmdbId)
        {
            try
            {
                // movie: prefix'ini temizle (veritabanında movie:12345 formatında olabilir)
                var cleanId = tmdbId.StartsWith("movie:") ? tmdbId.Substring(6) : tmdbId;
                
                // Film detayı + credits + videos + watch providers bilgisini tek istekle al
                var url = BuildUrl($"/movie/{cleanId}?append_to_response=credits,videos,watch/providers&include_video_language=tr,en,null");
                var response = await _httpClient.GetAsync(url);
                
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("TMDB API hatası: {StatusCode} - Film ID: {TmdbId}", response.StatusCode, tmdbId);
                    return null;
                }

                var content = await response.Content.ReadAsStringAsync();
                var movieData = JsonSerializer.Deserialize<JsonElement>(content);

                return ParseSingleMovieWithCredits(movieData, "movie");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TMDB film bilgisi alınırken hata: {TmdbId}", tmdbId);
                return null;
            }
        }

        public async Task<TmdbFilmDto?> GetTvShowByIdAsync(string tmdbId)
        {
            try
            {
                // tv: prefix'ini temizle (veritabanında tv:12345 formatında olabilir)
                var cleanId = tmdbId.StartsWith("tv:") ? tmdbId.Substring(3) : tmdbId;
                
                // Dizi detayı + credits + videos + watch providers bilgisini tek istekle al
                var url = BuildUrl($"/tv/{cleanId}?append_to_response=credits,videos,watch/providers&include_video_language=tr,en,null");
                var response = await _httpClient.GetAsync(url);
                
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("TMDB API hatası: {StatusCode} - TV ID: {TmdbId}", response.StatusCode, tmdbId);
                    return null;
                }

                var content = await response.Content.ReadAsStringAsync();
                var tvData = JsonSerializer.Deserialize<JsonElement>(content);

                return ParseSingleTvShowWithCredits(tvData);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TMDB dizi bilgisi alınırken hata: {TmdbId}", tmdbId);
                return null;
            }
        }

        public async Task<List<TmdbFilmDto>> SearchFilmsAsync(string query, int page = 1)
        {
            try
            {
                var encodedQuery = Uri.EscapeDataString(query);
                var url = BuildUrl($"/search/movie?query={encodedQuery}&page={page}");
                var response = await _httpClient.GetAsync(url);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("TMDB arama hatası: {StatusCode}", response.StatusCode);
                    return new List<TmdbFilmDto>();
                }

                var content = await response.Content.ReadAsStringAsync();
                var searchData = JsonSerializer.Deserialize<JsonElement>(content);

                return ParseMovieResults(searchData, "movie");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TMDB film araması sırasında hata: {Query}", query);
                return new List<TmdbFilmDto>();
            }
        }

        public async Task<List<TmdbFilmDto>> SearchTvShowsAsync(string query, int page = 1)
        {
            try
            {
                var encodedQuery = Uri.EscapeDataString(query);
                var url = BuildUrl($"/search/tv?query={encodedQuery}&page={page}");
                var response = await _httpClient.GetAsync(url);

                if (!response.IsSuccessStatusCode)
                {
                    return new List<TmdbFilmDto>();
                }

                var content = await response.Content.ReadAsStringAsync();
                var searchData = JsonSerializer.Deserialize<JsonElement>(content);

                return ParseTvResults(searchData);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TMDB dizi araması sırasında hata: {Query}", query);
                return new List<TmdbFilmDto>();
            }
        }

        public async Task<List<TmdbFilmDto>> SearchMultiAsync(string query, int page = 1)
        {
            try
            {
                var encodedQuery = Uri.EscapeDataString(query);
                var url = BuildUrl($"/search/multi?query={encodedQuery}&page={page}");
                var response = await _httpClient.GetAsync(url);

                if (!response.IsSuccessStatusCode)
                {
                    return new List<TmdbFilmDto>();
                }

                var content = await response.Content.ReadAsStringAsync();
                var searchData = JsonSerializer.Deserialize<JsonElement>(content);

                return ParseMultiResults(searchData);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TMDB multi araması sırasında hata: {Query}", query);
                return new List<TmdbFilmDto>();
            }
        }

        public async Task<List<TmdbFilmDto>> GetPopularFilmsAsync(int page = 1)
        {
            try
            {
                var url = BuildUrl($"/movie/popular?page={page}");
                var response = await _httpClient.GetAsync(url);

                if (!response.IsSuccessStatusCode)
                {
                    return new List<TmdbFilmDto>();
                }

                var content = await response.Content.ReadAsStringAsync();
                var data = JsonSerializer.Deserialize<JsonElement>(content);

                return ParseMovieResults(data, "movie");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TMDB popüler filmler alınırken hata");
                return new List<TmdbFilmDto>();
            }
        }

        public async Task<List<TmdbFilmDto>> GetPopularTvShowsAsync(int page = 1)
        {
            try
            {
                var url = BuildUrl($"/tv/popular?page={page}");
                var response = await _httpClient.GetAsync(url);

                if (!response.IsSuccessStatusCode)
                {
                    return new List<TmdbFilmDto>();
                }

                var content = await response.Content.ReadAsStringAsync();
                var data = JsonSerializer.Deserialize<JsonElement>(content);

                return ParseTvResults(data);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TMDB popüler diziler alınırken hata");
                return new List<TmdbFilmDto>();
            }
        }

        public async Task<List<TmdbFilmDto>> GetTopRatedFilmsAsync(int page = 1)
        {
            try
            {
                var url = BuildUrl($"/movie/top_rated?page={page}");
                var response = await _httpClient.GetAsync(url);

                if (!response.IsSuccessStatusCode)
                {
                    return new List<TmdbFilmDto>();
                }

                var content = await response.Content.ReadAsStringAsync();
                var data = JsonSerializer.Deserialize<JsonElement>(content);

                return ParseMovieResults(data, "movie");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TMDB en iyi filmler alınırken hata");
                return new List<TmdbFilmDto>();
            }
        }

        public async Task<List<TmdbFilmDto>> GetTopRatedTvShowsAsync(int page = 1)
        {
            try
            {
                var url = BuildUrl($"/tv/top_rated?page={page}");
                var response = await _httpClient.GetAsync(url);

                if (!response.IsSuccessStatusCode)
                {
                    return new List<TmdbFilmDto>();
                }

                var content = await response.Content.ReadAsStringAsync();
                var data = JsonSerializer.Deserialize<JsonElement>(content);

                return ParseTvResults(data);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TMDB en iyi diziler alınırken hata");
                return new List<TmdbFilmDto>();
            }
        }

        public async Task<List<TmdbFilmDto>> GetNowPlayingFilmsAsync(int page = 1)
        {
            try
            {
                var url = BuildUrl($"/movie/now_playing?page={page}");
                var response = await _httpClient.GetAsync(url);

                if (!response.IsSuccessStatusCode)
                {
                    return new List<TmdbFilmDto>();
                }

                var content = await response.Content.ReadAsStringAsync();
                var data = JsonSerializer.Deserialize<JsonElement>(content);

                return ParseMovieResults(data, "movie");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TMDB vizyondaki filmler alınırken hata");
                return new List<TmdbFilmDto>();
            }
        }

        public async Task<List<TmdbFilmDto>> GetOnTheAirTvShowsAsync(int page = 1)
        {
            try
            {
                var url = BuildUrl($"/tv/on_the_air?page={page}");
                var response = await _httpClient.GetAsync(url);

                if (!response.IsSuccessStatusCode)
                {
                    return new List<TmdbFilmDto>();
                }

                var content = await response.Content.ReadAsStringAsync();
                var data = JsonSerializer.Deserialize<JsonElement>(content);

                return ParseTvResults(data);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TMDB yayındaki diziler alınırken hata");
                return new List<TmdbFilmDto>();
            }
        }

        public async Task<List<TmdbFilmDto>> GetTrendingAsync(string mediaType = "all", string timeWindow = "week", int page = 1)
        {
            try
            {
                var url = BuildUrl($"/trending/{mediaType}/{timeWindow}?page={page}");
                var response = await _httpClient.GetAsync(url);

                if (!response.IsSuccessStatusCode)
                {
                    return new List<TmdbFilmDto>();
                }

                var content = await response.Content.ReadAsStringAsync();
                var data = JsonSerializer.Deserialize<JsonElement>(content);

                return ParseMultiResults(data);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TMDB trending alınırken hata");
                return new List<TmdbFilmDto>();
            }
        }

        public async Task<List<TmdbFilmDto>> DiscoverFilmsAsync(int page = 1, string? sortBy = "popularity.desc", int? minYear = null, int? maxYear = null, double? minRating = null, string? withGenres = null)
        {
            try
            {
                var queryParams = new List<string>
                {
                    $"page={page}",
                    $"sort_by={sortBy ?? "popularity.desc"}",
                    "include_adult=false",
                    "include_video=false"
                };

                if (minYear.HasValue) 
                    queryParams.Add($"primary_release_date.gte={minYear}-01-01");
                
                if (maxYear.HasValue) 
                    queryParams.Add($"primary_release_date.lte={maxYear}-12-31");
                
                if (minRating.HasValue) 
                    queryParams.Add($"vote_average.gte={minRating}");
                
                if (!string.IsNullOrEmpty(withGenres)) 
                    queryParams.Add($"with_genres={withGenres}");

                var queryString = string.Join("&", queryParams);
                var url = BuildUrl($"/discover/movie?{queryString}");
                
                // BuildUrl zaten ? veya & ekliyor, ama discover gibi karmaşık query'lerde 
                // BuildUrl'in mantığına dikkat etmek gerek.
                // Mevcut BuildUrl: endpoint + (? or &) + api_key...
                // Bizim endpoint zaten ? içeriyor: "/discover/movie?page=1..."
                // BuildUrl bunu algılayıp "&api_key=..." ekleyecek. Doğru çalışır.

                var response = await _httpClient.GetAsync(url);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("TMDB discover movie hatası: {StatusCode}", response.StatusCode);
                    return new List<TmdbFilmDto>();
                }

                var content = await response.Content.ReadAsStringAsync();
                var data = JsonSerializer.Deserialize<JsonElement>(content);

                return ParseMovieResults(data, "movie");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TMDB film keşfet hatası");
                return new List<TmdbFilmDto>();
            }
        }

        public async Task<List<TmdbFilmDto>> DiscoverTvShowsAsync(int page = 1, string? sortBy = "popularity.desc", int? minYear = null, int? maxYear = null, double? minRating = null, string? withGenres = null)
        {
            try
            {
                var queryParams = new List<string>
                {
                    $"page={page}",
                    $"sort_by={sortBy ?? "popularity.desc"}",
                    "include_adult=false",
                    "include_null_first_air_dates=false"
                };

                if (minYear.HasValue) 
                    queryParams.Add($"first_air_date.gte={minYear}-01-01");
                
                if (maxYear.HasValue) 
                    queryParams.Add($"first_air_date.lte={maxYear}-12-31");
                
                if (minRating.HasValue) 
                    queryParams.Add($"vote_average.gte={minRating}");
                
                if (!string.IsNullOrEmpty(withGenres)) 
                    queryParams.Add($"with_genres={withGenres}");

                var queryString = string.Join("&", queryParams);
                var url = BuildUrl($"/discover/tv?{queryString}");

                var response = await _httpClient.GetAsync(url);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("TMDB discover tv hatası: {StatusCode}", response.StatusCode);
                    return new List<TmdbFilmDto>();
                }

                var content = await response.Content.ReadAsStringAsync();
                var data = JsonSerializer.Deserialize<JsonElement>(content);

                return ParseTvResults(data);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TMDB dizi keşfet hatası");
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

                // Meta veriyi JSON olarak hazırla
                var metaVeri = new
                {
                    yonetmen = filmDto.Yonetmen,
                    turler = filmDto.Turler,
                    sure = filmDto.Sure,
                    mediaType = filmDto.MediaType
                };

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
                    HariciPuan = (decimal)filmDto.Puan,
                    HariciOySayisi = filmDto.OySayisi,
                    MetaVeri = JsonSerializer.Serialize(metaVeri),
                    OlusturulmaZamani = DateTime.UtcNow
                };

                _context.Icerikler.Add(icerik);
                await _context.SaveChangesAsync();

                // Oyuncuları ayrı tabloya kaydet
                if (filmDto.Oyuncular != null && filmDto.Oyuncular.Count > 0)
                {
                    await SaveActorsAsync(icerik.Id, filmDto.Oyuncular, filmDto.Yonetmen);
                }

                _logger.LogInformation("Film başarıyla import edildi: {Title} (TMDB ID: {TmdbId})", icerik.Baslik, tmdbId);
                return icerik;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Film import edilirken hata: {TmdbId}", tmdbId);
                return null;
            }
        }

        public async Task<Icerik?> ImportTvShowAsync(string tmdbId)
        {
            try
            {
                // Önce veritabanında var mı kontrol et - tv: prefix ile kaydet
                var hariciId = $"tv:{tmdbId}";
                var mevcutIcerik = _context.Icerikler
                    .FirstOrDefault(i => i.HariciId == hariciId && i.ApiKaynagi == ApiKaynak.tmdb);

                if (mevcutIcerik != null)
                {
                    _logger.LogInformation("Dizi zaten mevcut: {TmdbId}", tmdbId);
                    return mevcutIcerik;
                }

                // TMDB'den bilgileri al
                var tvDto = await GetTvShowByIdAsync(tmdbId);
                if (tvDto == null)
                {
                    return null;
                }

                // Meta veriyi JSON olarak hazırla
                var metaVeri = new
                {
                    yonetmen = tvDto.Yonetmen,
                    turler = tvDto.Turler,
                    sezonSayisi = tvDto.SezonSayisi,
                    bolumSayisi = tvDto.BolumSayisi,
                    mediaType = tvDto.MediaType
                };

                // Veritabanına kaydet
                var icerik = new Icerik
                {
                    HariciId = hariciId,
                    ApiKaynagi = ApiKaynak.tmdb,
                    Tur = IcerikTuru.dizi, // Diziler için dizi türü
                    Baslik = tvDto.Baslik,
                    Aciklama = tvDto.Aciklama,
                    PosterUrl = tvDto.PosterUrl,
                    YayinTarihi = ParseDateOnly(tvDto.YayinTarihi),
                    HariciPuan = (decimal)tvDto.Puan,
                    HariciOySayisi = tvDto.OySayisi,
                    MetaVeri = JsonSerializer.Serialize(metaVeri),
                    OlusturulmaZamani = DateTime.UtcNow
                };

                _context.Icerikler.Add(icerik);
                await _context.SaveChangesAsync();

                // Oyuncuları ayrı tabloya kaydet
                if (tvDto.Oyuncular != null && tvDto.Oyuncular.Count > 0)
                {
                    await SaveActorsAsync(icerik.Id, tvDto.Oyuncular, tvDto.Yonetmen);
                }

                _logger.LogInformation("Dizi başarıyla import edildi: {Title} (TMDB ID: {TmdbId})", icerik.Baslik, tmdbId);
                return icerik;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Dizi import edilirken hata: {TmdbId}", tmdbId);
                return null;
            }
        }

        private TmdbFilmDto? ParseSingleMovie(JsonElement movieData, string mediaType)
        {
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
                OrijinalDil = movieData.TryGetProperty("original_language", out var lang) ? lang.GetString() : null,
                MediaType = mediaType
            };
        }

        private TmdbFilmDto? ParseSingleMovieWithCredits(JsonElement movieData, string mediaType)
        {
            var dto = new TmdbFilmDto
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
                OrijinalDil = movieData.TryGetProperty("original_language", out var lang) ? lang.GetString() : null,
                Sure = movieData.TryGetProperty("runtime", out var runtime) ? runtime.GetInt32() : null,
                MediaType = mediaType
            };

            // Türleri parse et
            if (movieData.TryGetProperty("genres", out var genres))
            {
                dto.Turler = new List<string>();
                foreach (var genre in genres.EnumerateArray())
                {
                    if (genre.TryGetProperty("name", out var genreName))
                    {
                        dto.Turler.Add(genreName.GetString() ?? "");
                    }
                }
            }

            // Credits bilgilerini parse et
            if (movieData.TryGetProperty("credits", out var credits))
            {
                // Oyuncular (ilk 15)
                if (credits.TryGetProperty("cast", out var cast))
                {
                    dto.Oyuncular = new List<OyuncuDto>();
                    int actorCount = 0;
                    foreach (var actor in cast.EnumerateArray())
                    {
                        if (actorCount >= 15) break;
                        dto.Oyuncular.Add(new OyuncuDto
                        {
                            HariciId = actor.TryGetProperty("id", out var actorId) ? actorId.GetInt32().ToString() : null,
                            Ad = actor.TryGetProperty("name", out var actorName) ? actorName.GetString() ?? "" : "",
                            Karakter = actor.TryGetProperty("character", out var character) ? character.GetString() : null,
                            ProfilUrl = actor.TryGetProperty("profile_path", out var profile) && !profile.ValueEquals("null")
                                ? "https://image.tmdb.org/t/p/w185" + profile.GetString()
                                : null,
                            Sira = actorCount
                        });
                        actorCount++;
                    }
                }

                // Yönetmen
                if (credits.TryGetProperty("crew", out var crew))
                {
                    foreach (var member in crew.EnumerateArray())
                    {
                        if (member.TryGetProperty("job", out var job) && job.GetString() == "Director")
                        {
                            dto.Yonetmen = member.TryGetProperty("name", out var dirName) ? dirName.GetString() : null;
                            break;
                        }
                    }
                }
            }

            // Videos (Fragmanlar) - YouTube fragmanlarını parse et
            if (movieData.TryGetProperty("videos", out var videos) && 
                videos.TryGetProperty("results", out var videoResults))
            {
                dto.Videos = new List<VideoDto>();
                foreach (var video in videoResults.EnumerateArray())
                {
                    var site = video.TryGetProperty("site", out var siteVal) ? siteVal.GetString() : null;
                    var type = video.TryGetProperty("type", out var typeVal) ? typeVal.GetString() : null;
                    
                    // Sadece YouTube videolarını ve Trailer/Teaser türlerini al
                    if (site?.ToLower() == "youtube" && 
                        (type == "Trailer" || type == "Teaser"))
                    {
                        dto.Videos.Add(new VideoDto
                        {
                            Key = video.TryGetProperty("key", out var keyVal) ? keyVal.GetString() ?? "" : "",
                            Site = site ?? "YouTube",
                            Type = type ?? "Trailer",
                            Name = video.TryGetProperty("name", out var nameVal) ? nameVal.GetString() : null,
                            Official = video.TryGetProperty("official", out var officialVal) && officialVal.GetBoolean()
                        });
                    }
                }
                
                // Resmi fragmanları öne al
                dto.Videos = dto.Videos
                    .OrderByDescending(v => v.Official)
                    .ThenBy(v => v.Type == "Trailer" ? 0 : 1)
                    .ToList();
            }

            // Watch Providers (İzleme Platformları) - Türkiye için
            if (movieData.TryGetProperty("watch/providers", out var watchProviders) &&
                watchProviders.TryGetProperty("results", out var providerResults))
            {
                dto.WatchProviders = new List<WatchProviderDto>();
                
                // Türkiye (TR) verileri yoksa global (US) verileri al
                JsonElement regionData;
                if (providerResults.TryGetProperty("TR", out regionData) ||
                    providerResults.TryGetProperty("US", out regionData))
                {
                    // Abonelik ile izlenebilir (Netflix, Disney+ vb.)
                    if (regionData.TryGetProperty("flatrate", out var flatrate))
                    {
                        foreach (var provider in flatrate.EnumerateArray())
                        {
                            dto.WatchProviders.Add(new WatchProviderDto
                            {
                                ProviderId = provider.TryGetProperty("provider_id", out var pid) ? pid.GetInt32() : 0,
                                ProviderName = provider.TryGetProperty("provider_name", out var pname) ? pname.GetString() ?? "" : "",
                                LogoUrl = provider.TryGetProperty("logo_path", out var logo) && !logo.ValueEquals("null")
                                    ? $"https://image.tmdb.org/t/p/original{logo.GetString()}"
                                    : null,
                                Type = "flatrate"
                            });
                        }
                    }
                    
                    // Kiralık
                    if (regionData.TryGetProperty("rent", out var rent))
                    {
                        foreach (var provider in rent.EnumerateArray())
                        {
                            // Zaten eklenmişse atla
                            var providerId = provider.TryGetProperty("provider_id", out var pid) ? pid.GetInt32() : 0;
                            if (dto.WatchProviders.Any(p => p.ProviderId == providerId)) continue;
                            
                            dto.WatchProviders.Add(new WatchProviderDto
                            {
                                ProviderId = providerId,
                                ProviderName = provider.TryGetProperty("provider_name", out var pname) ? pname.GetString() ?? "" : "",
                                LogoUrl = provider.TryGetProperty("logo_path", out var logo) && !logo.ValueEquals("null")
                                    ? $"https://image.tmdb.org/t/p/original{logo.GetString()}"
                                    : null,
                                Type = "rent"
                            });
                        }
                    }
                }
            }

            return dto;
        }

        private TmdbFilmDto? ParseSingleTvShow(JsonElement tvData)
        {
            return new TmdbFilmDto
            {
                Id = tvData.GetProperty("id").GetInt32().ToString(),
                Baslik = tvData.TryGetProperty("name", out var name) ? name.GetString() ?? "" : "",
                Aciklama = tvData.TryGetProperty("overview", out var overview) ? overview.GetString() : null,
                PosterUrl = tvData.TryGetProperty("poster_path", out var poster) && !poster.ValueEquals("null")
                    ? ImageBaseUrl + poster.GetString()
                    : null,
                ArkaplanUrl = tvData.TryGetProperty("backdrop_path", out var backdrop) && !backdrop.ValueEquals("null")
                    ? "https://image.tmdb.org/t/p/original" + backdrop.GetString()
                    : null,
                YayinTarihi = tvData.TryGetProperty("first_air_date", out var date) ? date.GetString() : null,
                Puan = tvData.TryGetProperty("vote_average", out var avg) ? avg.GetDouble() : 0,
                OySayisi = tvData.TryGetProperty("vote_count", out var count) ? count.GetInt32() : 0,
                OrijinalDil = tvData.TryGetProperty("original_language", out var lang) ? lang.GetString() : null,
                MediaType = "tv"
            };
        }

        private TmdbFilmDto? ParseSingleTvShowWithCredits(JsonElement tvData)
        {
            var dto = new TmdbFilmDto
            {
                Id = tvData.GetProperty("id").GetInt32().ToString(),
                Baslik = tvData.TryGetProperty("name", out var name) ? name.GetString() ?? "" : "",
                Aciklama = tvData.TryGetProperty("overview", out var overview) ? overview.GetString() : null,
                PosterUrl = tvData.TryGetProperty("poster_path", out var poster) && !poster.ValueEquals("null")
                    ? ImageBaseUrl + poster.GetString()
                    : null,
                ArkaplanUrl = tvData.TryGetProperty("backdrop_path", out var backdrop) && !backdrop.ValueEquals("null")
                    ? "https://image.tmdb.org/t/p/original" + backdrop.GetString()
                    : null,
                YayinTarihi = tvData.TryGetProperty("first_air_date", out var date) ? date.GetString() : null,
                Puan = tvData.TryGetProperty("vote_average", out var avg) ? avg.GetDouble() : 0,
                OySayisi = tvData.TryGetProperty("vote_count", out var count) ? count.GetInt32() : 0,
                OrijinalDil = tvData.TryGetProperty("original_language", out var lang) ? lang.GetString() : null,
                SezonSayisi = tvData.TryGetProperty("number_of_seasons", out var seasons) ? seasons.GetInt32() : null,
                BolumSayisi = tvData.TryGetProperty("number_of_episodes", out var episodes) ? episodes.GetInt32() : null,
                MediaType = "tv"
            };

            // Türleri parse et
            if (tvData.TryGetProperty("genres", out var genres))
            {
                dto.Turler = new List<string>();
                foreach (var genre in genres.EnumerateArray())
                {
                    if (genre.TryGetProperty("name", out var genreName))
                    {
                        dto.Turler.Add(genreName.GetString() ?? "");
                    }
                }
            }

            // Credits bilgilerini parse et
            if (tvData.TryGetProperty("credits", out var credits))
            {
                // Oyuncular (ilk 15)
                if (credits.TryGetProperty("cast", out var cast))
                {
                    dto.Oyuncular = new List<OyuncuDto>();
                    int actorCount = 0;
                    foreach (var actor in cast.EnumerateArray())
                    {
                        if (actorCount >= 15) break;
                        dto.Oyuncular.Add(new OyuncuDto
                        {
                            HariciId = actor.TryGetProperty("id", out var actorId) ? actorId.GetInt32().ToString() : null,
                            Ad = actor.TryGetProperty("name", out var actorName) ? actorName.GetString() ?? "" : "",
                            Karakter = actor.TryGetProperty("character", out var character) ? character.GetString() : null,
                            ProfilUrl = actor.TryGetProperty("profile_path", out var profile) && !profile.ValueEquals("null")
                                ? "https://image.tmdb.org/t/p/w185" + profile.GetString()
                                : null,
                            Sira = actorCount
                        });
                        actorCount++;
                    }
                }

                // Yönetmen/Creator - dizilerde "created_by" alanı kullanılır
                if (tvData.TryGetProperty("created_by", out var createdBy))
                {
                    foreach (var creator in createdBy.EnumerateArray())
                    {
                        dto.Yonetmen = creator.TryGetProperty("name", out var creatorName) ? creatorName.GetString() : null;
                        break; // İlk yaratıcıyı al
                    }
                }
            }

            // Videos (Fragmanlar) - YouTube fragmanlarını parse et
            if (tvData.TryGetProperty("videos", out var videos) && 
                videos.TryGetProperty("results", out var videoResults))
            {
                dto.Videos = new List<VideoDto>();
                foreach (var video in videoResults.EnumerateArray())
                {
                    var site = video.TryGetProperty("site", out var siteVal) ? siteVal.GetString() : null;
                    var type = video.TryGetProperty("type", out var typeVal) ? typeVal.GetString() : null;
                    
                    // Sadece YouTube videolarını ve Trailer/Teaser türlerini al
                    if (site?.ToLower() == "youtube" && 
                        (type == "Trailer" || type == "Teaser"))
                    {
                        dto.Videos.Add(new VideoDto
                        {
                            Key = video.TryGetProperty("key", out var keyVal) ? keyVal.GetString() ?? "" : "",
                            Site = site ?? "YouTube",
                            Type = type ?? "Trailer",
                            Name = video.TryGetProperty("name", out var nameVal) ? nameVal.GetString() : null,
                            Official = video.TryGetProperty("official", out var officialVal) && officialVal.GetBoolean()
                        });
                    }
                }

                // Eğer Trailer/Teaser yoksa, YouTube videolarından herhangi birini al
                if (dto.Videos.Count == 0)
                {
                    foreach (var video in videoResults.EnumerateArray())
                    {
                        var site = video.TryGetProperty("site", out var siteVal) ? siteVal.GetString() : null;
                        if (site?.ToLower() != "youtube") continue;

                        dto.Videos.Add(new VideoDto
                        {
                            Key = video.TryGetProperty("key", out var keyVal) ? keyVal.GetString() ?? "" : "",
                            Site = site ?? "YouTube",
                            Type = video.TryGetProperty("type", out var typeVal) ? typeVal.GetString() ?? "Video" : "Video",
                            Name = video.TryGetProperty("name", out var nameVal) ? nameVal.GetString() : null,
                            Official = video.TryGetProperty("official", out var officialVal) && officialVal.GetBoolean()
                        });
                    }
                }
                
                // Resmi fragmanları öne al
                dto.Videos = dto.Videos
                    .OrderByDescending(v => v.Official)
                    .ThenBy(v => v.Type == "Trailer" ? 0 : 1)
                    .ToList();
            }

            // Watch Providers (İzleme Platformları) - Türkiye için
            if (tvData.TryGetProperty("watch/providers", out var watchProviders) &&
                watchProviders.TryGetProperty("results", out var providerResults))
            {
                dto.WatchProviders = new List<WatchProviderDto>();
                
                // Türkiye (TR) verileri yoksa global (US) verileri al
                JsonElement regionData;
                if (providerResults.TryGetProperty("TR", out regionData) ||
                    providerResults.TryGetProperty("US", out regionData))
                {
                    // Abonelik ile izlenebilir (Netflix, Disney+ vb.)
                    if (regionData.TryGetProperty("flatrate", out var flatrate))
                    {
                        foreach (var provider in flatrate.EnumerateArray())
                        {
                            dto.WatchProviders.Add(new WatchProviderDto
                            {
                                ProviderId = provider.TryGetProperty("provider_id", out var pid) ? pid.GetInt32() : 0,
                                ProviderName = provider.TryGetProperty("provider_name", out var pname) ? pname.GetString() ?? "" : "",
                                LogoUrl = provider.TryGetProperty("logo_path", out var logo) && !logo.ValueEquals("null")
                                    ? $"https://image.tmdb.org/t/p/original{logo.GetString()}"
                                    : null,
                                Type = "flatrate"
                            });
                        }
                    }
                    
                    // Kiralık
                    if (regionData.TryGetProperty("rent", out var rent))
                    {
                        foreach (var provider in rent.EnumerateArray())
                        {
                            var providerId = provider.TryGetProperty("provider_id", out var pid) ? pid.GetInt32() : 0;
                            if (dto.WatchProviders.Any(p => p.ProviderId == providerId)) continue;
                            
                            dto.WatchProviders.Add(new WatchProviderDto
                            {
                                ProviderId = providerId,
                                ProviderName = provider.TryGetProperty("provider_name", out var pname) ? pname.GetString() ?? "" : "",
                                LogoUrl = provider.TryGetProperty("logo_path", out var logo) && !logo.ValueEquals("null")
                                    ? $"https://image.tmdb.org/t/p/original{logo.GetString()}"
                                    : null,
                                Type = "rent"
                            });
                        }
                    }
                }
            }

            return dto;
        }

        private List<TmdbFilmDto> ParseMovieResults(JsonElement data, string mediaType)
        {
            var results = new List<TmdbFilmDto>();

            if (data.TryGetProperty("results", out var resultsArray))
            {
                foreach (var movie in resultsArray.EnumerateArray())
                {
                    // Genre IDs parse
                    List<int>? genreIds = null;
                    if (movie.TryGetProperty("genre_ids", out var genreIdsArray))
                    {
                        genreIds = genreIdsArray.EnumerateArray().Select(g => g.GetInt32()).ToList();
                    }

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
                        OySayisi = movie.TryGetProperty("vote_count", out var count) ? count.GetInt32() : 0,
                        TurIds = genreIds,
                        MediaType = mediaType
                    });
                }
            }

            return results;
        }

        private List<TmdbFilmDto> ParseTvResults(JsonElement data)
        {
            var results = new List<TmdbFilmDto>();

            if (data.TryGetProperty("results", out var resultsArray))
            {
                foreach (var tv in resultsArray.EnumerateArray())
                {
                    // Genre IDs parse
                    List<int>? genreIds = null;
                    if (tv.TryGetProperty("genre_ids", out var genreIdsArray))
                    {
                        genreIds = genreIdsArray.EnumerateArray().Select(g => g.GetInt32()).ToList();
                    }

                    results.Add(new TmdbFilmDto
                    {
                        Id = tv.GetProperty("id").GetInt32().ToString(),
                        Baslik = tv.TryGetProperty("name", out var name) ? name.GetString() ?? "" : "",
                        Aciklama = tv.TryGetProperty("overview", out var overview) ? overview.GetString() : null,
                        PosterUrl = tv.TryGetProperty("poster_path", out var poster) && !poster.ValueEquals("null")
                            ? ImageBaseUrl + poster.GetString()
                            : null,
                        YayinTarihi = tv.TryGetProperty("first_air_date", out var date) ? date.GetString() : null,
                        Puan = tv.TryGetProperty("vote_average", out var avg) ? avg.GetDouble() : 0,
                        OySayisi = tv.TryGetProperty("vote_count", out var count) ? count.GetInt32() : 0,
                        TurIds = genreIds,
                        MediaType = "tv"
                    });
                }
            }

            return results;
        }

        private List<TmdbFilmDto> ParseMultiResults(JsonElement data)
        {
            var results = new List<TmdbFilmDto>();

            if (data.TryGetProperty("results", out var resultsArray))
            {
                foreach (var item in resultsArray.EnumerateArray())
                {
                    var mediaType = item.TryGetProperty("media_type", out var mt) ? mt.GetString() : "movie";
                    
                    // Kişileri atla
                    if (mediaType == "person") continue;

                    var isMovie = mediaType == "movie";

                    // Genre IDs parse
                    List<int>? genreIds = null;
                    if (item.TryGetProperty("genre_ids", out var genreIdsArray))
                    {
                        genreIds = genreIdsArray.EnumerateArray().Select(g => g.GetInt32()).ToList();
                    }
                    
                    results.Add(new TmdbFilmDto
                    {
                        Id = item.GetProperty("id").GetInt32().ToString(),
                        Baslik = isMovie 
                            ? (item.TryGetProperty("title", out var title) ? title.GetString() ?? "" : "")
                            : (item.TryGetProperty("name", out var name) ? name.GetString() ?? "" : ""),
                        Aciklama = item.TryGetProperty("overview", out var overview) ? overview.GetString() : null,
                        PosterUrl = item.TryGetProperty("poster_path", out var poster) && !poster.ValueEquals("null")
                            ? ImageBaseUrl + poster.GetString()
                            : null,
                        YayinTarihi = isMovie 
                            ? (item.TryGetProperty("release_date", out var releaseDate) ? releaseDate.GetString() : null)
                            : (item.TryGetProperty("first_air_date", out var airDate) ? airDate.GetString() : null),
                        Puan = item.TryGetProperty("vote_average", out var avg) ? avg.GetDouble() : 0,
                        OySayisi = item.TryGetProperty("vote_count", out var count) ? count.GetInt32() : 0,
                        TurIds = genreIds,
                        MediaType = mediaType ?? "movie"
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

        /// <summary>
        /// Oyuncuları ve yönetmeni ayrı tablolara kaydeder
        /// </summary>
        private async Task SaveActorsAsync(long icerikId, List<OyuncuDto> oyuncular, string? yonetmen)
        {
            try
            {
                foreach (var oyuncuDto in oyuncular)
                {
                    if (string.IsNullOrEmpty(oyuncuDto.HariciId) || oyuncuDto.HariciId == "0") continue;

                    // Oyuncu zaten var mı kontrol et (HariciId ile)
                    var mevcutOyuncu = await _context.Oyuncular
                        .FirstOrDefaultAsync(o => o.HariciId == oyuncuDto.HariciId);

                    Oyuncu oyuncu;
                    if (mevcutOyuncu != null)
                    {
                        oyuncu = mevcutOyuncu;
                    }
                    else
                    {
                        // Yeni oyuncu oluştur
                        oyuncu = new Oyuncu
                        {
                            HariciId = oyuncuDto.HariciId,
                            Ad = oyuncuDto.Ad,
                            ProfilUrl = oyuncuDto.ProfilUrl
                        };
                        _context.Oyuncular.Add(oyuncu);
                        await _context.SaveChangesAsync();
                    }

                    // İçerik-oyuncu ilişkisi zaten var mı kontrol et
                    var mevcutIliski = await _context.IcerikOyunculari
                        .FirstOrDefaultAsync(io => io.IcerikId == icerikId && io.OyuncuId == oyuncu.Id);

                    if (mevcutIliski == null)
                    {
                        // İlişki oluştur
                        var icerikOyuncu = new IcerikOyuncu
                        {
                            IcerikId = icerikId,
                            OyuncuId = oyuncu.Id,
                            Karakter = oyuncuDto.Karakter,
                            Sira = oyuncuDto.Sira,
                            RolTipi = "oyuncu"
                        };
                        _context.IcerikOyunculari.Add(icerikOyuncu);
                    }
                }

                // Yönetmeni de kaydet (eğer varsa)
                if (!string.IsNullOrWhiteSpace(yonetmen))
                {
                    // Yönetmen için basit bir oyuncu kaydı oluştur (HariciId = null, sadece isim)
                    var mevcutYonetmen = await _context.Oyuncular
                        .FirstOrDefaultAsync(o => o.Ad == yonetmen && o.HariciId == null);

                    Oyuncu yonetmenOyuncu;
                    if (mevcutYonetmen != null)
                    {
                        yonetmenOyuncu = mevcutYonetmen;
                    }
                    else
                    {
                        yonetmenOyuncu = new Oyuncu
                        {
                            HariciId = null,
                            Ad = yonetmen,
                            ProfilUrl = null
                        };
                        _context.Oyuncular.Add(yonetmenOyuncu);
                        await _context.SaveChangesAsync();
                    }

                    // İlişki var mı kontrol et
                    var mevcutYonetmenIliski = await _context.IcerikOyunculari
                        .FirstOrDefaultAsync(io => io.IcerikId == icerikId && io.OyuncuId == yonetmenOyuncu.Id);

                    if (mevcutYonetmenIliski == null)
                    {
                        var icerikYonetmen = new IcerikOyuncu
                        {
                            IcerikId = icerikId,
                            OyuncuId = yonetmenOyuncu.Id,
                            Karakter = null,
                            Sira = 0,
                            RolTipi = "yonetmen"
                        };
                        _context.IcerikOyunculari.Add(icerikYonetmen);
                    }
                }

                await _context.SaveChangesAsync();
                _logger.LogInformation("İçerik {IcerikId} için {Count} oyuncu kaydedildi", icerikId, oyuncular.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Oyuncular kaydedilirken hata: İçerik {IcerikId}", icerikId);
            }
        }
    }
}
