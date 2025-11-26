using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Saga.Server.Services;
using Saga.Server.DTOs;

namespace Saga.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ExternalApiController : ControllerBase
    {
        private readonly ITmdbService _tmdbService;
        private readonly IGoogleBooksService _googleBooksService;
        private readonly ILogger<ExternalApiController> _logger;

        public ExternalApiController(
            ITmdbService tmdbService,
            IGoogleBooksService googleBooksService,
            ILogger<ExternalApiController> logger)
        {
            _tmdbService = tmdbService;
            _googleBooksService = googleBooksService;
            _logger = logger;
        }

        // GET: api/externalapi/tmdb/search?q={query}
        [HttpGet("tmdb/search")]
        [AllowAnonymous]
        public async Task<ActionResult<List<TmdbFilmDto>>> SearchTmdbFilms([FromQuery] string q, [FromQuery] int sayfa = 1)
        {
            if (string.IsNullOrWhiteSpace(q))
            {
                return BadRequest(new { message = "Arama terimi boş olamaz." });
            }

            var results = await _tmdbService.SearchFilmsAsync(q, sayfa);
            return Ok(results);
        }

        // GET: api/externalapi/tmdb/{id}
        [HttpGet("tmdb/{id}")]
        [AllowAnonymous]
        public async Task<ActionResult<TmdbFilmDto>> GetTmdbFilm(string id)
        {
            var film = await _tmdbService.GetFilmByIdAsync(id);
            if (film == null)
            {
                return NotFound(new { message = "Film bulunamadı." });
            }

            return Ok(film);
        }

        // GET: api/externalapi/tmdb/popular
        [HttpGet("tmdb/popular")]
        [AllowAnonymous]
        public async Task<ActionResult<List<TmdbFilmDto>>> GetPopularTmdbFilms([FromQuery] int sayfa = 1)
        {
            var films = await _tmdbService.GetPopularFilmsAsync(sayfa);
            return Ok(films);
        }

        // GET: api/externalapi/tmdb/top-rated
        [HttpGet("tmdb/top-rated")]
        [AllowAnonymous]
        public async Task<ActionResult<List<TmdbFilmDto>>> GetTopRatedTmdbFilms([FromQuery] int sayfa = 1)
        {
            var films = await _tmdbService.GetTopRatedFilmsAsync(sayfa);
            return Ok(films);
        }

        // POST: api/externalapi/tmdb/import/{tmdbId}
        [HttpPost("tmdb/import/{tmdbId}")]
        [Authorize] // Giriş yapmış tüm kullanıcılar içerik ekleyebilir
        public async Task<ActionResult<IcerikDetailDto>> ImportTmdbFilm(string tmdbId)
        {
            try
            {
                var icerik = await _tmdbService.ImportFilmAsync(tmdbId);
                if (icerik == null)
                {
                    return BadRequest(new { message = "Film import edilemedi." });
                }

                var response = new IcerikDetailDto
                {
                    Id = icerik.Id,
                    HariciId = icerik.HariciId,
                    ApiKaynagi = icerik.ApiKaynagi.ToString(),
                    Tur = icerik.Tur.ToString(),
                    Baslik = icerik.Baslik,
                    Aciklama = icerik.Aciklama,
                    PosterUrl = icerik.PosterUrl,
                    YayinTarihi = icerik.YayinTarihi,
                    OrtalamaPuan = icerik.OrtalamaPuan,
                    PuanlamaSayisi = icerik.PuanlamaSayisi,
                    YorumSayisi = 0,
                    ListeyeEklenmeSayisi = 0,
                    GoruntulemeSayisi = icerik.GoruntulemeSayisi,
                    PopulerlikSkoru = icerik.PopulerlikSkoru,
                    OlusturulmaZamani = icerik.OlusturulmaZamani
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TMDB film import hatası: {TmdbId}", tmdbId);
                return StatusCode(500, new { message = "Film import edilirken bir hata oluştu." });
            }
        }

        // GET: api/externalapi/books/search?q={query}
        [HttpGet("books/search")]
        [AllowAnonymous]
        public async Task<ActionResult<List<GoogleBookDto>>> SearchGoogleBooks(
            [FromQuery] string q, 
            [FromQuery] int baslangic = 0,
            [FromQuery] int limit = 20)
        {
            if (string.IsNullOrWhiteSpace(q))
            {
                return BadRequest(new { message = "Arama terimi boş olamaz." });
            }

            var results = await _googleBooksService.SearchBooksAsync(q, baslangic, limit);
            return Ok(results);
        }

        // GET: api/externalapi/books/{id}
        [HttpGet("books/{id}")]
        [AllowAnonymous]
        public async Task<ActionResult<GoogleBookDto>> GetGoogleBook(string id)
        {
            var book = await _googleBooksService.GetBookByIdAsync(id);
            if (book == null)
            {
                return NotFound(new { message = "Kitap bulunamadı." });
            }

            return Ok(book);
        }

        // POST: api/externalapi/books/import/{googleBooksId}
        [HttpPost("books/import/{googleBooksId}")]
        [Authorize] // Giriş yapmış tüm kullanıcılar içerik ekleyebilir
        public async Task<ActionResult<IcerikDetailDto>> ImportGoogleBook(string googleBooksId)
        {
            try
            {
                var icerik = await _googleBooksService.ImportBookAsync(googleBooksId);
                if (icerik == null)
                {
                    return BadRequest(new { message = "Kitap import edilemedi." });
                }

                var response = new IcerikDetailDto
                {
                    Id = icerik.Id,
                    HariciId = icerik.HariciId,
                    ApiKaynagi = icerik.ApiKaynagi.ToString(),
                    Tur = icerik.Tur.ToString(),
                    Baslik = icerik.Baslik,
                    Aciklama = icerik.Aciklama,
                    PosterUrl = icerik.PosterUrl,
                    YayinTarihi = icerik.YayinTarihi,
                    OrtalamaPuan = icerik.OrtalamaPuan,
                    PuanlamaSayisi = icerik.PuanlamaSayisi,
                    YorumSayisi = 0,
                    ListeyeEklenmeSayisi = 0,
                    GoruntulemeSayisi = icerik.GoruntulemeSayisi,
                    PopulerlikSkoru = icerik.PopulerlikSkoru,
                    OlusturulmaZamani = icerik.OlusturulmaZamani
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Google Books import hatası: {GoogleBooksId}", googleBooksId);
                return StatusCode(500, new { message = "Kitap import edilirken bir hata oluştu." });
            }
        }

        // POST: api/externalapi/tmdb/bulk-import
        [HttpPost("tmdb/bulk-import")]
        [Authorize(Roles = "yonetici,moderator")]
        public async Task<ActionResult> BulkImportTmdbFilms([FromBody] List<string> tmdbIds)
        {
            var imported = 0;
            var failed = 0;

            foreach (var tmdbId in tmdbIds)
            {
                try
                {
                    var result = await _tmdbService.ImportFilmAsync(tmdbId);
                    if (result != null)
                    {
                        imported++;
                    }
                    else
                    {
                        failed++;
                    }
                }
                catch
                {
                    failed++;
                }

                // Rate limiting için küçük bekleme
                await Task.Delay(100);
            }

            return Ok(new
            {
                message = "Toplu import tamamlandı",
                toplam = tmdbIds.Count,
                basarili = imported,
                basarisiz = failed
            });
        }

        // POST: api/externalapi/books/bulk-import
        [HttpPost("books/bulk-import")]
        [Authorize(Roles = "yonetici,moderator")]
        public async Task<ActionResult> BulkImportGoogleBooks([FromBody] List<string> googleBooksIds)
        {
            var imported = 0;
            var failed = 0;

            foreach (var bookId in googleBooksIds)
            {
                try
                {
                    var result = await _googleBooksService.ImportBookAsync(bookId);
                    if (result != null)
                    {
                        imported++;
                    }
                    else
                    {
                        failed++;
                    }
                }
                catch
                {
                    failed++;
                }

                // Rate limiting için küçük bekleme
                await Task.Delay(100);
            }

            return Ok(new
            {
                message = "Toplu import tamamlandı",
                toplam = googleBooksIds.Count,
                basarili = imported,
                basarisiz = failed
            });
        }
    }
}
