using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Saga.Server.Data;
using Saga.Server.Models;
using Saga.Server.Services;
using System.Text.Json;

namespace Saga.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [EnableRateLimiting("ai")]
    public class AiController : BaseApiController
    {
        private readonly SagaDbContext _context;
        private readonly ILocalAiService _localAiService;
        private readonly ISemanticSearchService _semanticSearchService;
        private readonly ITmdbService _tmdbService;
        private readonly IGroqService _groqService;
        private readonly ILogger<AiController> _logger;

        public AiController(
            SagaDbContext context, 
            ILocalAiService localAiService, 
            ISemanticSearchService semanticSearchService,
            ITmdbService tmdbService,
            IGroqService groqService,
            ILogger<AiController> logger)
        {
            _context = context;
            _localAiService = localAiService;
            _semanticSearchService = semanticSearchService;
            _tmdbService = tmdbService;
            _groqService = groqService;
            _logger = logger;
        }

        [HttpPost("ask")]
        [AllowAnonymous]
        public async Task<ActionResult<AiAskResponse>> Ask([FromBody] AiAskRequest request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.Query))
            {
                return BadRequest(new { message = "Soru boş olamaz." });
            }

            var query = request.Query.Trim();
            var turFilter = ParseTurFilter(request.Tur);

            List<Icerik> icerikler;
            try
            {
                var ftsQuery = @"
                    SELECT i.*
                    FROM icerikler i
                    WHERE i.silindi = false AND i.arama_vektoru @@ plainto_tsquery('turkish', {0})
                    ORDER BY ts_rank(i.arama_vektoru, plainto_tsquery('turkish', {0})) DESC
                    LIMIT {1}";

                icerikler = await _context.Icerikler
                    .FromSqlRaw(ftsQuery, query, 20)
                    .AsNoTracking()
                    .ToListAsync(cancellationToken);
            }
            catch
            {
                icerikler = new List<Icerik>();
            }

            if (!icerikler.Any())
            {
                icerikler = await _context.Icerikler.AsNoTracking()
                    .Where(i => !i.Silindi &&
                                (EF.Functions.ILike(i.Baslik, $"%{query}%") ||
                                 EF.Functions.ILike(i.Aciklama ?? string.Empty, $"%{query}%")))
                    .OrderByDescending(i => i.PopulerlikSkoru)
                    .ThenByDescending(i => i.OrtalamaPuan)
                    .Take(20)
                    .ToListAsync(cancellationToken);
            }

            if (turFilter.HasValue)
            {
                icerikler = icerikler.Where(i => i.Tur == turFilter.Value).ToList();
            }

            var candidates = icerikler
                .Take(12)
                .Select(i => new AiCandidate
                {
                    Id = i.Id,
                    Baslik = i.Baslik,
                    Tur = i.Tur,
                    YayinTarihi = i.YayinTarihi,
                    Aciklama = i.Aciklama,
                    PosterUrl = i.PosterUrl
                })
                .ToList();

            string? answer = null;
            if (candidates.Count > 0)
            {
                answer = await _localAiService.GenerateAnswerAsync(query, candidates, cancellationToken);
            }

            if (string.IsNullOrWhiteSpace(answer))
            {
                answer = candidates.Count > 0
                    ? "En yakın eşleşmeler aşağıda listelendi."
                    : "Uygun bir eşleşme bulamadım.";
            }

            var response = new AiAskResponse
            {
                Answer = answer,
                Matches = candidates.Select(c => new AiMatchDto
                {
                    Id = c.Id,
                    Baslik = c.Baslik,
                    Tur = c.Tur.ToString(),
                    YayinTarihi = c.YayinTarihi?.ToString("yyyy-MM-dd"),
                    PosterUrl = c.PosterUrl
                }).ToList()
            };

            return Ok(response);
        }

        /// <summary>
        /// İçerik Tanımlama - LLM kullanarak tanımdan film/dizi/kitap adını bul ve TMDB/Google Books'ta ara
        /// Örnek: "ellerinden pençe çıkan adam" -> Wolverine/X-Men filmlerini bulur
        /// </summary>
        [HttpPost("identify")]
        [AllowAnonymous]
        public async Task<ActionResult> IdentifyAndSearch([FromBody] IdentifyRequestDto request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.Description))
            {
                return BadRequest(new { message = "Tanım boş olamaz." });
            }

            try
            {
                _logger.LogInformation("İçerik tanımlama: {Description}", request.Description);
                
                // 1. LLM'e sor: Bu tanım hangi içeriğe ait?
                var identifyResult = await _semanticSearchService.IdentifyContentAsync(
                    request.Description, 
                    request.Tur, 
                    cancellationToken);

                if (identifyResult == null || !identifyResult.Found)
                {
                    return Ok(new IdentifyAndSearchResponse
                    {
                        Success = false,
                        Message = "LLM bu tanımı tanıyamadı. Lütfen daha detaylı açıklama yapın.",
                        IdentifiedTitle = null,
                        SearchResults = new List<AiMatchDto>()
                    });
                }

                _logger.LogInformation("LLM tanımladı: {Title} ({Confidence})", identifyResult.Title, identifyResult.Confidence);

                // 2. Bulunan isimle TMDB/Google Books'ta ara
                var searchQuery = identifyResult.SearchQuery;
                List<AiMatchDto> searchResults = new();

                if (identifyResult.Tur == "kitap")
                {
                    // Google Books'ta ara
                    // TODO: Google Books entegrasyonu
                    searchResults = await SearchInternalDb(searchQuery, "kitap", cancellationToken);
                }
                else
                {
                    // TMDB'de ara (film/dizi)
                    searchResults = await SearchTmdb(searchQuery, identifyResult.Tur, cancellationToken);
                }

                return Ok(new IdentifyAndSearchResponse
                {
                    Success = true,
                    Message = identifyResult.Explanation,
                    IdentifiedTitle = identifyResult.Title,
                    IdentifiedTitleEn = identifyResult.TitleEn,
                    IdentifiedType = identifyResult.Tur,
                    IdentifiedYear = identifyResult.Year,
                    Confidence = identifyResult.Confidence,
                    SearchResults = searchResults
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Identify hatası: {Description}", request.Description);
                return StatusCode(500, new { message = "İçerik tanımlama sırasında bir hata oluştu." });
            }
        }

        private async Task<List<AiMatchDto>> SearchTmdb(string query, string tur, CancellationToken cancellationToken)
        {
            var results = new List<AiMatchDto>();
            
            try
            {
                // Önce veritabanında ara
                var turFilter = ParseTurFilter(tur);
                
                var icerikler = await _context.Icerikler
                    .AsNoTracking()
                    .Where(i => !i.Silindi)
                    .Where(i => turFilter == null || i.Tur == turFilter)
                    .Where(i => EF.Functions.ILike(i.Baslik, $"%{query}%"))
                    .Take(5)
                    .ToListAsync(cancellationToken);

                results = icerikler.Select(i => new AiMatchDto
                {
                    Id = i.Id,
                    Baslik = i.Baslik,
                    Tur = i.Tur.ToString(),
                    YayinTarihi = i.YayinTarihi?.ToString("yyyy-MM-dd"),
                    PosterUrl = i.PosterUrl
                }).ToList();
                
                // Veritabanında yeterli sonuç yoksa TMDB'den ara
                if (results.Count < 5)
                {
                    List<TmdbFilmDto> tmdbResults;
                    
                    if (tur == "dizi")
                    {
                        tmdbResults = await _tmdbService.SearchTvShowsAsync(query);
                    }
                    else
                    {
                        // Film veya belirsiz ise film ara
                        tmdbResults = await _tmdbService.SearchFilmsAsync(query);
                    }
                    
                    // TMDB sonuçlarını ekle (mevcut ID'leri atla)
                    var existingIds = results.Select(r => r.Id).ToHashSet();
                    var tmdbMapped = tmdbResults
                        .Where(t => !string.IsNullOrEmpty(t.Id))
                        .Take(10 - results.Count)
                        .Select(t => new AiMatchDto
                        {
                            Id = 0, // TMDB'den gelen, veritabanında yok
                            Baslik = t.Baslik ?? "Bilinmiyor",
                            Tur = tur == "dizi" ? "dizi" : "film",
                            YayinTarihi = t.YayinTarihi,
                            PosterUrl = t.PosterUrl,
                            TmdbId = t.Id // TMDB ID'si ile import edilebilir
                        });
                    
                    results.AddRange(tmdbMapped);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "TMDB arama hatası: {Query}", query);
            }

            return results;
        }

        private async Task<List<AiMatchDto>> SearchInternalDb(string query, string tur, CancellationToken cancellationToken)
        {
            var turFilter = ParseTurFilter(tur);
            
            var icerikler = await _context.Icerikler
                .AsNoTracking()
                .Where(i => !i.Silindi)
                .Where(i => turFilter == null || i.Tur == turFilter)
                .Where(i => EF.Functions.ILike(i.Baslik, $"%{query}%"))
                .Take(10)
                .ToListAsync(cancellationToken);

            return icerikler.Select(i => new AiMatchDto
            {
                Id = i.Id,
                Baslik = i.Baslik,
                Tur = i.Tur.ToString(),
                YayinTarihi = i.YayinTarihi?.ToString("yyyy-MM-dd"),
                PosterUrl = i.PosterUrl
            }).ToList();
        }

        /// <summary>
        /// Semantic search - Anlat ve bul (HuggingFace AI microservice kullanır)
        /// </summary>
        [HttpPost("semantic-search")]
        [AllowAnonymous]
        public async Task<ActionResult<SemanticSearchApiResponse>> SemanticSearch([FromBody] SemanticSearchApiRequest request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.Query))
            {
                return BadRequest(new { message = "Arama sorgusu boş olamaz." });
            }

            try
            {
                // Önce AI service'den semantic search yap
                var results = await _semanticSearchService.SearchAsync(
                    request.Query, 
                    request.Limit, 
                    request.Tur, 
                    cancellationToken);

                if (results.Any())
                {
                    return Ok(new SemanticSearchApiResponse
                    {
                        Success = true,
                        Query = request.Query,
                        Results = results.Select(r => new SemanticSearchResultDto
                        {
                            Id = r.Id,
                            Baslik = r.Baslik,
                            Tur = r.Tur,
                            Aciklama = r.Aciklama,
                            Yil = r.Yil,
                            PosterUrl = r.PosterUrl,
                            Puan = r.Puan,
                            Score = r.Score,
                            Neden = r.Neden
                        }).ToList(),
                        Source = "semantic"
                    });
                }

                // Fallback: Normal FTS arama
                _logger.LogInformation("Semantic search sonuç bulamadı, FTS'e düşülüyor: {Query}", request.Query);
                
                var turFilter = ParseTurFilter(request.Tur);
                var ftsResults = await _context.Icerikler
                    .AsNoTracking()
                    .Where(i => !i.Silindi)
                    .Where(i => turFilter == null || i.Tur == turFilter)
                    .Where(i => EF.Functions.ToTsVector("turkish", i.Baslik + " " + i.Aciklama)
                        .Matches(EF.Functions.PlainToTsQuery("turkish", request.Query)))
                    .Take(request.Limit)
                    .Select(i => new SemanticSearchResultDto
                    {
                        Id = i.Id,
                        Baslik = i.Baslik,
                        Tur = i.Tur.ToString(),
                        Aciklama = i.Aciklama ?? "",
                        Yil = i.YayinTarihi.HasValue ? i.YayinTarihi.Value.Year : null,
                        PosterUrl = i.PosterUrl,
                        Puan = (double?)i.OrtalamaPuan,
                        Score = 0.5,
                        Neden = "Metin araması sonucu"
                    })
                    .ToListAsync(cancellationToken);

                return Ok(new SemanticSearchApiResponse
                {
                    Success = true,
                    Query = request.Query,
                    Results = ftsResults,
                    Source = "fts"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Semantic search hatası: {Query}", request.Query);
                return StatusCode(500, new { message = "Arama sırasında bir hata oluştu." });
            }
        }

        /// <summary>
        /// AI index'ini güncelle - Admin endpoint
        /// </summary>
        [HttpPost("update-index")]
        [Authorize(Roles = "Admin")]
        public async Task<ActionResult> UpdateSemanticIndex(CancellationToken cancellationToken)
        {
            try
            {
                // Tüm içerikleri al
                var contents = await _context.Icerikler
                    .AsNoTracking()
                    .Where(i => !i.Silindi)
                    .Select(i => new SemanticContent
                    {
                        Id = i.Id,
                        Baslik = i.Baslik,
                        Tur = i.Tur.ToString(),
                        Aciklama = i.Aciklama ?? "",
                        Yil = i.YayinTarihi.HasValue ? i.YayinTarihi.Value.Year : null,
                        PosterUrl = i.PosterUrl,
                        Puan = (double?)i.OrtalamaPuan
                    })
                    .ToListAsync(cancellationToken);

                if (!contents.Any())
                {
                    return BadRequest(new { message = "İndexlenecek içerik yok." });
                }

                var success = await _semanticSearchService.IndexContentsAsync(contents, cancellationToken);
                
                if (success)
                {
                    return Ok(new { message = $"{contents.Count} içerik indexlendi.", count = contents.Count });
                }
                
                return StatusCode(500, new { message = "Index güncellenemedi." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Index güncelleme hatası");
                return StatusCode(500, new { message = "Index güncelleme sırasında bir hata oluştu." });
            }
        }

        /// <summary>
        /// AI service sağlık kontrolü
        /// </summary>
        [HttpGet("health")]
        [AllowAnonymous]
        public async Task<ActionResult> CheckAiHealth(CancellationToken cancellationToken)
        {
            var isHealthy = await _semanticSearchService.IsHealthyAsync(cancellationToken);
            return Ok(new { 
                status = isHealthy ? "healthy" : "unavailable",
                service = "semantic-search",
                timestamp = DateTime.UtcNow
            });
        }

        // ===== YENİ: AI Chat Endpoint'leri =====

        /// <summary>
        /// Genel AI sohbet - Film, dizi, kitap hakkında soru sor
        /// </summary>
        [HttpPost("chat")]
        [AllowAnonymous]
        public async Task<ActionResult<AiChatResponse>> Chat([FromBody] AiChatRequest request, CancellationToken cancellationToken)
        {
            if (request.Messages == null || !request.Messages.Any())
            {
                return BadRequest(new { message = "En az bir mesaj gerekli." });
            }

            try
            {
                var messages = request.Messages.Select(m => new ChatMessageDto
                {
                    Role = m.Role,
                    Content = m.Content
                }).ToList();

                var result = await _semanticSearchService.ChatAsync(messages, request.Context, cancellationToken);

                return Ok(new AiChatResponse
                {
                    Message = result.Message,
                    Suggestions = result.Suggestions
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Chat hatası");
                return StatusCode(500, new { message = "Sohbet sırasında bir hata oluştu." });
            }
        }

        /// <summary>
        /// Belirli bir içerik hakkında soru sor
        /// </summary>
        [HttpPost("content-question")]
        [AllowAnonymous]
        public async Task<ActionResult<AiContentQuestionResponse>> AskAboutContent([FromBody] AiContentQuestionRequest request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.Question))
            {
                return BadRequest(new { message = "Soru boş olamaz." });
            }

            try
            {
                // İçerik ID varsa veritabanından bilgileri al
                string contentTitle = request.ContentTitle;
                string contentType = request.ContentType ?? "film";
                string? description = request.ContentDescription;

                if (request.ContentId.HasValue)
                {
                    var icerik = await _context.Icerikler
                        .AsNoTracking()
                        .FirstOrDefaultAsync(i => i.Id == request.ContentId.Value, cancellationToken);

                    if (icerik != null)
                    {
                        contentTitle = icerik.Baslik;
                        contentType = icerik.Tur.ToString();
                        description = icerik.Aciklama;
                    }
                }

                var result = await _semanticSearchService.AskAboutContentAsync(
                    contentTitle, 
                    contentType, 
                    request.Question, 
                    description, 
                    cancellationToken);

                return Ok(new AiContentQuestionResponse
                {
                    Answer = result.Answer,
                    RelatedQuestions = result.RelatedQuestions
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Content question hatası: {Title}", request.ContentTitle);
                return StatusCode(500, new { message = "Soru yanıtlanırken bir hata oluştu." });
            }
        }

        /// <summary>
        /// Site asistanı - Navigasyon, arama, öneri, yardım
        /// </summary>
        [HttpPost("assistant")]
        [AllowAnonymous]
        public async Task<ActionResult<AiAssistantResponse>> Assistant([FromBody] AiAssistantRequest request, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(request.Query))
            {
                return BadRequest(new { message = "Sorgu boş olamaz." });
            }

            try
            {
                // Kullanıcı giriş yapmışsa, kullanıcı konteksti ekle
                object? userContext = null;
                var kullaniciId = GetCurrentUserIdOrNull();
                
                if (kullaniciId.HasValue)
                {
                    var kullanici = await _context.Kullanicilar
                        .AsNoTracking()
                        .FirstOrDefaultAsync(k => k.Id == kullaniciId.Value, cancellationToken);

                    if (kullanici != null)
                    {
                        // Kullanıcının son aktivitelerini al
                        var sonIzlenenler = await _context.KutuphaneDurumlari
                            .AsNoTracking()
                            .Where(k => k.KullaniciId == kullaniciId.Value)
                            .OrderByDescending(k => k.GuncellemeZamani)
                            .Take(5)
                            .Include(k => k.Icerik)
                            .Select(k => k.Icerik.Baslik)
                            .ToListAsync(cancellationToken);

                        userContext = new
                        {
                            kullaniciAdi = kullanici.KullaniciAdi,
                            sonIzlenenler
                        };
                    }
                }

                // Chat geçmişini dönüştür
                List<ChatMessage>? chatHistory = null;
                if (request.ChatHistory != null && request.ChatHistory.Count > 0)
                {
                    chatHistory = request.ChatHistory.Select(h => new ChatMessage
                    {
                        Role = h.Role,
                        Content = h.Content
                    }).ToList();
                }

                var result = await _semanticSearchService.AskAssistantAsync(
                    request.Query, 
                    request.CurrentPage, 
                    userContext,
                    chatHistory,
                    cancellationToken);

                return Ok(new AiAssistantResponse
                {
                    Message = result.Message,
                    Action = result.Action,
                    ActionData = result.ActionData,
                    Suggestions = result.Suggestions
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Assistant hatası: {Query}", request.Query);
                return StatusCode(500, new { message = "Asistan hatası oluştu." });
            }
        }

        /// <summary>
        /// İçerik özeti al
        /// </summary>
        [HttpGet("content-summary/{id}")]
        [AllowAnonymous]
        public async Task<ActionResult<AiSummaryContentResponse>> GetContentSummary(long id, [FromQuery] bool spoilerFree = true, CancellationToken cancellationToken = default)
        {
            try
            {
                var icerik = await _context.Icerikler
                    .AsNoTracking()
                    .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

                if (icerik == null)
                {
                    return NotFound(new { message = "İçerik bulunamadı." });
                }

                var result = await _semanticSearchService.GetContentSummaryAsync(
                    icerik.Baslik, 
                    icerik.Tur.ToString(), 
                    spoilerFree, 
                    cancellationToken);

                return Ok(new AiSummaryContentResponse
                {
                    ContentId = id,
                    Title = icerik.Baslik,
                    Type = icerik.Tur.ToString(),
                    Summary = result.Summary,
                    SpoilerFree = spoilerFree
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Content summary hatası: {Id}", id);
                return StatusCode(500, new { message = "Özet alınırken bir hata oluştu." });
            }
        }

        [HttpGet("summary")]
        [Authorize]
        public async Task<ActionResult<AiSummaryResponse>> GetSummary([FromQuery] int year = 2025, CancellationToken cancellationToken = default)
        {
            var userId = GetCurrentUserId();
            var startDate = new DateTime(year, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            var endDate = new DateTime(year, 12, 31, 23, 59, 59, DateTimeKind.Utc);

            // Kullanıcının bu yıl içindeki kütüphane kayıtlarını çek
            var kutuphane = await _context.KutuphaneDurumlari
                .AsNoTracking()
                .Include(k => k.Icerik)
                .Where(k => k.KullaniciId == userId && !k.Silindi && k.GuncellemeZamani >= startDate && k.GuncellemeZamani <= endDate)
                .ToListAsync(cancellationToken);

            // Kullanıcının bu yıl içindeki puanlamalarını çek
            var puanlamalar = await _context.Puanlamalar
                .AsNoTracking()
                .Include(p => p.Icerik)
                .Where(p => p.KullaniciId == userId && !p.Silindi && p.OlusturulmaZamani >= startDate && p.OlusturulmaZamani <= endDate)
                .ToListAsync(cancellationToken);

            // Kullanıcının bu yıl içindeki yorumlarını çek
            var yorumlar = await _context.Yorumlar
                .AsNoTracking()
                .Where(y => y.KullaniciId == userId && !y.Silindi && y.OlusturulmaZamani >= startDate && y.OlusturulmaZamani <= endDate)
                .ToListAsync(cancellationToken);

            // Kullanıcının bu yıl içindeki aktivitelerini çek (aylık dağılım için)
            var aktiviteler = await _context.Aktiviteler
                .AsNoTracking()
                .Where(a => a.KullaniciId == userId && a.OlusturulmaZamani >= startDate && a.OlusturulmaZamani <= endDate)
                .Select(a => new { a.OlusturulmaZamani })
                .ToListAsync(cancellationToken);

            if (!kutuphane.Any() && !puanlamalar.Any())
            {
                return Ok(new AiSummaryResponse
                {
                    Year = year,
                    Title = "Özet bulunamadı",
                    Narrative = "Bu yıl için yeterli veri bulunamadı.",
                    Stats = new AiSummaryStats()
                });
            }

            var stats = BuildSummaryStats(kutuphane, puanlamalar, yorumlar.Count, aktiviteler.Select(a => a.OlusturulmaZamani).ToList());

            var systemPrompt = @"Sen Saga platformunun yıllık özet yapay zekasısın. 
KURALLAR:
- Türkçe yaz, samimi ve eğlenceli ol
- 4-6 cümle ile özet yaz
- İstatistikleri yaratıcı yorumla
- Emojiler kullan 🎬📚🎭
- Kişiselleştirilmiş öneriler ekle";

            var userPrompt = $"Yıl: {year}\nİstatistikler: {JsonSerializer.Serialize(stats)}\nKullanıcı için kişiselleştirilmiş bir özet yaz.";

            // Önce Groq API dene, başarısız olursa LocalAi
            string? narrative = null;
            if (_groqService.IsConfigured)
            {
                narrative = await _groqService.GenerateTextAsync(systemPrompt, userPrompt, cancellationToken);
            }
            
            if (string.IsNullOrEmpty(narrative))
            {
                narrative = await _localAiService.GenerateTextAsync(systemPrompt, userPrompt, cancellationToken);
            }

            // Hala boşsa fallback mesaj
            if (string.IsNullOrEmpty(narrative))
            {
                var totalContent = stats.TotalCount;
                narrative = $"🎬 {year} yılında {totalContent} içerik tükettiniz! " +
                    $"Toplam {stats.TotalMinutes / 60} saat izleme ve {stats.TotalPages} sayfa okuma ile harika bir yıl geçirmişsiniz! " +
                    $"En sevdiğiniz türler: {string.Join(", ", stats.TopGenres.Take(3))}. Tebrikler! 🎉";
            }

            return Ok(new AiSummaryResponse
            {
                Year = year,
                Title = $"{year} Saga Özeti",
                Narrative = narrative,
                Stats = stats
            });
        }

        private static AiSummaryStats BuildSummaryStats(List<KutuphaneDurumu> kutuphane, List<Puanlama> puanlamalar, int totalReviews, List<DateTime> aktiviteTarihleri)
        {
            var typeCounts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            var genreCounts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            var authorCounts = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            var monthCounts = new Dictionary<int, int>();
            var dayCounts = new Dictionary<DayOfWeek, int>();
            int totalMinutes = 0;
            int totalPages = 0;
            int completedCount = 0;
            int watchingCount = 0;
            int plannedCount = 0;

            // Türkçe ay isimleri
            var ayIsimleri = new[] { "", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık" };
            var gunIsimleri = new Dictionary<DayOfWeek, string>
            {
                { DayOfWeek.Monday, "Pazartesi" },
                { DayOfWeek.Tuesday, "Salı" },
                { DayOfWeek.Wednesday, "Çarşamba" },
                { DayOfWeek.Thursday, "Perşembe" },
                { DayOfWeek.Friday, "Cuma" },
                { DayOfWeek.Saturday, "Cumartesi" },
                { DayOfWeek.Sunday, "Pazar" }
            };

            foreach (var item in kutuphane)
            {
                var tur = item.Icerik.Tur.ToString();
                typeCounts[tur] = typeCounts.GetValueOrDefault(tur) + 1;

                // Durum bazlı sayım
                var durum = item.Durum.ToString().ToLowerInvariant();
                if (durum == "tamamlandi" || durum == "tamamlandı")
                    completedCount++;
                else if (durum == "izleniyor" || durum == "okunuyor" || durum == "devam_ediyor")
                    watchingCount++;
                else if (durum == "izlenecek" || durum == "okunacak" || durum == "planlanan")
                    plannedCount++;

                // Ay bazlı aktivite
                var month = item.GuncellemeZamani.Month;
                monthCounts[month] = monthCounts.GetValueOrDefault(month) + 1;

                // Gün bazlı aktivite
                var day = item.GuncellemeZamani.DayOfWeek;
                dayCounts[day] = dayCounts.GetValueOrDefault(day) + 1;

                if (!string.IsNullOrWhiteSpace(item.Icerik.MetaVeri) && item.Icerik.MetaVeri != "{}")
                {
                    try
                    {
                        var metaDoc = JsonDocument.Parse(item.Icerik.MetaVeri);
                        var root = metaDoc.RootElement;

                        if (root.TryGetProperty("turler", out var turler) && turler.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var t in turler.EnumerateArray())
                            {
                                var tStr = t.GetString();
                                if (!string.IsNullOrWhiteSpace(tStr))
                                {
                                    genreCounts[tStr!] = genreCounts.GetValueOrDefault(tStr!) + 1;
                                }
                            }
                        }

                        if (root.TryGetProperty("kategoriler", out var kategoriler) && kategoriler.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var k in kategoriler.EnumerateArray())
                            {
                                var kStr = k.GetString();
                                if (!string.IsNullOrWhiteSpace(kStr))
                                {
                                    genreCounts[kStr!] = genreCounts.GetValueOrDefault(kStr!) + 1;
                                }
                            }
                        }

                        if (root.TryGetProperty("yazarlar", out var yazarlar) && yazarlar.ValueKind == JsonValueKind.Array)
                        {
                            foreach (var y in yazarlar.EnumerateArray())
                            {
                                var yStr = y.GetString();
                                if (!string.IsNullOrWhiteSpace(yStr))
                                {
                                    authorCounts[yStr!] = authorCounts.GetValueOrDefault(yStr!) + 1;
                                }
                            }
                        }

                        if (root.TryGetProperty("sure", out var sure) && sure.ValueKind == JsonValueKind.Number)
                        {
                            totalMinutes += sure.GetInt32();
                        }

                        if (root.TryGetProperty("sayfaSayisi", out var sayfa) && sayfa.ValueKind == JsonValueKind.Number)
                        {
                            totalPages += sayfa.GetInt32();
                        }
                    }
                    catch
                    {
                        // ignore broken meta
                    }
                }
            }

            // Aktivite tarihlerinden de ay/gün dağılımını hesapla
            foreach (var tarih in aktiviteTarihleri)
            {
                monthCounts[tarih.Month] = monthCounts.GetValueOrDefault(tarih.Month) + 1;
                dayCounts[tarih.DayOfWeek] = dayCounts.GetValueOrDefault(tarih.DayOfWeek) + 1;
            }

            // En aktif ay
            var mostActiveMonth = monthCounts.OrderByDescending(m => m.Value).FirstOrDefault();
            var mostActiveMonthName = mostActiveMonth.Key > 0 ? ayIsimleri[mostActiveMonth.Key] : null;

            // En aktif gün
            var favoriteDay = dayCounts.OrderByDescending(d => d.Value).FirstOrDefault();
            var favoriteDayName = favoriteDay.Value > 0 ? gunIsimleri.GetValueOrDefault(favoriteDay.Key) : null;

            // Aylık aktivite grafiği
            var monthlyActivity = Enumerable.Range(1, 12)
                .Select(m => new AiMonthlyActivity
                {
                    Month = m,
                    MonthName = ayIsimleri[m],
                    Count = monthCounts.GetValueOrDefault(m)
                })
                .ToList();

            // En çok izlenen/okunan türler
            var topGenres = genreCounts
                .OrderByDescending(k => k.Value)
                .Take(6)
                .Select(k => k.Key)
                .ToList();

            // En çok okunan yazarlar
            var topAuthors = authorCounts
                .OrderByDescending(k => k.Value)
                .Take(5)
                .Select(k => k.Key)
                .ToList();

            // TopRated: Kullanıcının kendi puanlamalarını kullan
            var topRated = puanlamalar
                .OrderByDescending(p => p.Puan)
                .Take(5)
                .Select(p => new AiTopItem
                {
                    Baslik = p.Icerik.Baslik,
                    Tur = p.Icerik.Tur.ToString(),
                    Puan = (double)p.Puan
                })
                .ToList();

            // Kullanıcının ortalama puanı
            var averageRating = puanlamalar.Any() ? (double)puanlamalar.Average(p => p.Puan) : 0;

            return new AiSummaryStats
            {
                TotalCount = kutuphane.Count,
                TypeCounts = typeCounts,
                TopGenres = topGenres,
                TopAuthors = topAuthors,
                TotalMinutes = totalMinutes,
                TotalPages = totalPages,
                TopRated = topRated,
                // Yeni kişiye özel alanlar
                AverageRating = Math.Round(averageRating, 1),
                TotalRatings = puanlamalar.Count,
                TotalReviews = totalReviews,
                MostActiveMonth = mostActiveMonthName,
                MostActiveMonthCount = mostActiveMonth.Value,
                FavoriteDay = favoriteDayName,
                CompletedCount = completedCount,
                WatchingCount = watchingCount,
                PlannedCount = plannedCount,
                MonthlyActivity = monthlyActivity
            };
        }

        private static IcerikTuru? ParseTurFilter(string? tur)
        {
            if (string.IsNullOrWhiteSpace(tur)) return null;
            var t = tur.Trim().ToLowerInvariant();
            return t switch
            {
                "film" => IcerikTuru.film,
                "dizi" => IcerikTuru.dizi,
                "kitap" => IcerikTuru.kitap,
                _ => null
            };
        }

        /// <summary>
        /// Yıllık Özet - Groq AI ile kullanıcının yıllık istatistiklerinden özet oluşturur
        /// </summary>
        [HttpGet("yearly-summary")]
        [Authorize]
        public async Task<ActionResult<YearlySummaryResponse>> GetYearlySummary([FromQuery] int? year = null, CancellationToken cancellationToken = default)
        {
            var kullaniciId = GetCurrentUserIdOrNull();
            if (kullaniciId == null)
            {
                return Unauthorized(new { message = "Oturum açmanız gerekiyor." });
            }

            var targetYear = year ?? DateTime.Now.Year;
            var startDate = new DateTime(targetYear, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            var endDate = new DateTime(targetYear, 12, 31, 23, 59, 59, DateTimeKind.Utc);

            try
            {
                // 1. Kullanıcının kütüphane verilerini çek
                var kutuphane = await _context.KutuphaneDurumlari
                    .AsNoTracking()
                    .Include(k => k.Icerik)
                    .Where(k => k.KullaniciId == kullaniciId.Value)
                    .Where(k => k.GuncellemeZamani >= startDate && k.GuncellemeZamani <= endDate)
                    .ToListAsync(cancellationToken);

                // 2. Puanlamalar
                var puanlamalar = await _context.Puanlamalar
                    .AsNoTracking()
                    .Include(p => p.Icerik)
                    .Where(p => p.KullaniciId == kullaniciId.Value)
                    .Where(p => p.OlusturulmaZamani >= startDate && p.OlusturulmaZamani <= endDate)
                    .ToListAsync(cancellationToken);

                // 3. İstatistikleri hesapla
                var filmler = kutuphane.Where(k => k.Icerik.Tur == IcerikTuru.film && k.Durum == KutuphaneDurum.izlendi).ToList();
                var diziler = kutuphane.Where(k => k.Icerik.Tur == IcerikTuru.dizi && k.Durum == KutuphaneDurum.izlendi).ToList();
                var kitaplar = kutuphane.Where(k => k.Icerik.Tur == IcerikTuru.kitap && k.Durum == KutuphaneDurum.izlendi).ToList();

                // Tahmini süreler (ortalama değerler kullanılıyor)
                int totalFilmSaat = filmler.Count * 2; // Ortalama film 2 saat
                int totalDiziSaat = diziler.Count * 10; // Ortalama dizi sezonu 10 saat
                int totalSayfa = kitaplar.Count * 300; // Ortalama kitap 300 sayfa

                // Favori içerikler (en yüksek puanlananlar)
                var filmPuanlari = puanlamalar.Where(p => p.Icerik.Tur == IcerikTuru.film).OrderByDescending(p => p.Puan).Take(3).Select(p => p.Icerik.Baslik).ToList();
                var diziPuanlari = puanlamalar.Where(p => p.Icerik.Tur == IcerikTuru.dizi).OrderByDescending(p => p.Puan).Take(3).Select(p => p.Icerik.Baslik).ToList();
                var kitapPuanlari = puanlamalar.Where(p => p.Icerik.Tur == IcerikTuru.kitap).OrderByDescending(p => p.Puan).Take(3).Select(p => p.Icerik.Baslik).ToList();

                // Ortalama puanlar
                var ortFilmPuan = puanlamalar.Where(p => p.Icerik.Tur == IcerikTuru.film).Select(p => (double)p.Puan).DefaultIfEmpty(0).Average();
                var ortDiziPuan = puanlamalar.Where(p => p.Icerik.Tur == IcerikTuru.dizi).Select(p => (double)p.Puan).DefaultIfEmpty(0).Average();
                var ortKitapPuan = puanlamalar.Where(p => p.Icerik.Tur == IcerikTuru.kitap).Select(p => (double)p.Puan).DefaultIfEmpty(0).Average();

                // En aktif ay
                string[] ayIsimleri = { "", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık" };
                var monthCounts = kutuphane
                    .Where(k => k.Durum == KutuphaneDurum.izlendi)
                    .GroupBy(k => k.GuncellemeZamani.Month)
                    .ToDictionary(g => g.Key, g => g.Count());
                var enAktifAy = monthCounts.OrderByDescending(m => m.Value).FirstOrDefault();
                var enAktifAyIsmi = enAktifAy.Key > 0 && enAktifAy.Key <= 12 ? ayIsimleri[enAktifAy.Key] : "Bilinmiyor";

                // 4. YearlySummaryData hazırla
                var summaryData = new YearlySummaryData
                {
                    ToplamFilm = filmler.Count,
                    ToplamDizi = diziler.Count,
                    ToplamKitap = kitaplar.Count,
                    ToplamSaatFilm = totalFilmSaat,
                    ToplamSaatDizi = totalDiziSaat,
                    ToplamSayfaKitap = totalSayfa,
                    EnSevdigiTurler = new List<string>(), // Basitleştirildi
                    EnCokIzledigiFavFilmler = filmPuanlari,
                    EnCokIzledigiFavDiziler = diziPuanlari,
                    EnCokOkuduguFavKitaplar = kitapPuanlari,
                    OrtalamaFilmPuani = ortFilmPuan,
                    OrtalamaDiziPuani = ortDiziPuan,
                    OrtalamaKitapPuani = ortKitapPuan,
                    EnAktifAy = enAktifAyIsmi,
                    Yil = targetYear
                };

                // 5. Groq AI ile özet oluştur
                string? aiSummary = null;
                if (_groqService.IsConfigured)
                {
                    aiSummary = await _groqService.GenerateYearlySummaryAsync(summaryData, cancellationToken);
                }

                // Fallback özet
                if (string.IsNullOrEmpty(aiSummary))
                {
                    var totalIcerik = summaryData.ToplamFilm + summaryData.ToplamDizi + summaryData.ToplamKitap;
                    aiSummary = $"🎬 {targetYear} yılında {totalIcerik} içerik tükettiniz! " +
                        $"{summaryData.ToplamFilm} film ({summaryData.ToplamSaatFilm} saat), " +
                        $"{summaryData.ToplamDizi} dizi ({summaryData.ToplamSaatDizi} saat), " +
                        $"{summaryData.ToplamKitap} kitap ({summaryData.ToplamSayfaKitap} sayfa) ile harika bir yıl geçirmişsiniz! " +
                        $"En aktif olduğunuz ay: {enAktifAyIsmi}. Tebrikler! 🎉";
                }

                return Ok(new YearlySummaryResponse
                {
                    Year = targetYear,
                    Summary = aiSummary,
                    Stats = summaryData,
                    GeneratedByAi = _groqService.IsConfigured
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Yearly summary hatası");
                return StatusCode(500, new { message = "Yıllık özet oluşturulurken bir hata oluştu." });
            }
        }
    }

    public class AiAskRequest
    {
        public string Query { get; set; } = "";
        public string? Tur { get; set; }
    }

    public class AiAskResponse
    {
        public string Answer { get; set; } = "";
        public List<AiMatchDto> Matches { get; set; } = new();
    }

    public class AiMatchDto
    {
        public long Id { get; set; }
        public string Baslik { get; set; } = "";
        public string Tur { get; set; } = "";
        public string? YayinTarihi { get; set; }
        public string? PosterUrl { get; set; }
        public string? TmdbId { get; set; } // TMDB'den gelen içerikler için
    }

    public class AiSummaryResponse
    {
        public int Year { get; set; }
        public string Title { get; set; } = "";
        public string Narrative { get; set; } = "";
        public AiSummaryStats Stats { get; set; } = new();
    }

    public class AiSummaryStats
    {
        public int TotalCount { get; set; }
        public Dictionary<string, int> TypeCounts { get; set; } = new();
        public List<string> TopGenres { get; set; } = new();
        public List<string> TopAuthors { get; set; } = new();
        public int TotalMinutes { get; set; }
        public int TotalPages { get; set; }
        public List<AiTopItem> TopRated { get; set; } = new();
        
        // Kişiye özel yeni alanlar
        public double AverageRating { get; set; } // Kullanıcının ortalama puanı
        public int TotalRatings { get; set; } // Toplam puanlama sayısı
        public int TotalReviews { get; set; } // Toplam yorum sayısı
        public string? MostActiveMonth { get; set; } // En aktif ay
        public int MostActiveMonthCount { get; set; } // En aktif aydaki içerik sayısı
        public string? FavoriteDay { get; set; } // En çok içerik tüketilen gün
        public int CompletedCount { get; set; } // Tamamlanan içerik sayısı
        public int WatchingCount { get; set; } // İzleniyor/Okunuyor sayısı
        public int PlannedCount { get; set; } // Planlanmış içerik sayısı
        public List<AiMonthlyActivity> MonthlyActivity { get; set; } = new(); // Aylık aktivite grafiği
    }

    public class AiTopItem
    {
        public string Baslik { get; set; } = "";
        public string Tur { get; set; } = "";
        public double? Puan { get; set; }
    }

    public class AiMonthlyActivity
    {
        public int Month { get; set; }
        public string MonthName { get; set; } = "";
        public int Count { get; set; }
    }

    // Semantic Search API DTOs
    public class SemanticSearchApiRequest
    {
        public string Query { get; set; } = "";
        public int Limit { get; set; } = 10;
        public string? Tur { get; set; }
    }

    public class SemanticSearchApiResponse
    {
        public bool Success { get; set; }
        public string Query { get; set; } = "";
        public string Source { get; set; } = ""; // "semantic" veya "fts"
        public List<SemanticSearchResultDto> Results { get; set; } = new();
        public string? Error { get; set; }
    }

    public class SemanticSearchResultDto
    {
        public long Id { get; set; }
        public string Baslik { get; set; } = "";
        public string Tur { get; set; } = "";
        public string? Aciklama { get; set; }
        public int? Yil { get; set; }
        public string? PosterUrl { get; set; }
        public double? Puan { get; set; }
        public double Score { get; set; }
        public string? Neden { get; set; }
    }

    // Identify (LLM ile içerik tanımlama) DTOs
    public class IdentifyRequestDto
    {
        public string Description { get; set; } = "";
        public string? Tur { get; set; } // film/dizi/kitap - opsiyonel
    }

    public class IdentifyAndSearchResponse
    {
        public bool Success { get; set; }
        public string Message { get; set; } = "";
        public string? IdentifiedTitle { get; set; }
        public string? IdentifiedTitleEn { get; set; }
        public string? IdentifiedType { get; set; }
        public int? IdentifiedYear { get; set; }
        public double? Confidence { get; set; }
        public List<AiMatchDto> SearchResults { get; set; } = new();
    }

    // ===== YENİ: AI Chat DTOs =====
    public class AiChatMessageDto
    {
        public string Role { get; set; } = "user";
        public string Content { get; set; } = "";
    }

    public class AiChatRequest
    {
        public List<AiChatMessageDto> Messages { get; set; } = new();
        public string? Context { get; set; } // Sayfa konteksti
    }

    public class AiChatResponse
    {
        public string Message { get; set; } = "";
        public List<string>? Suggestions { get; set; }
    }

    public class AiContentQuestionRequest
    {
        public long? ContentId { get; set; }
        public string ContentTitle { get; set; } = "";
        public string? ContentType { get; set; }
        public string? ContentDescription { get; set; }
        public string Question { get; set; } = "";
    }

    public class AiContentQuestionResponse
    {
        public string Answer { get; set; } = "";
        public List<string>? RelatedQuestions { get; set; }
    }

    public class AiAssistantRequest
    {
        public string Query { get; set; } = "";
        public string? CurrentPage { get; set; }
        public List<ChatHistoryItem>? ChatHistory { get; set; }
    }

    public class ChatHistoryItem
    {
        public string Role { get; set; } = "";
        public string Content { get; set; } = "";
    }

    public class AiAssistantResponse
    {
        public string Message { get; set; } = "";
        public string? Action { get; set; } // navigate, search, recommend, info
        public Dictionary<string, object>? ActionData { get; set; }
        public List<string>? Suggestions { get; set; }
    }

    public class AiSummaryContentResponse
    {
        public long ContentId { get; set; }
        public string Title { get; set; } = "";
        public string Type { get; set; } = "";
        public string Summary { get; set; } = "";
        public bool SpoilerFree { get; set; } = true;
    }

    // ===== GROQ YEARLY SUMMARY DTOs =====
    public class YearlySummaryResponse
    {
        public int Year { get; set; }
        public string Summary { get; set; } = "";
        public YearlySummaryData Stats { get; set; } = new();
        public bool GeneratedByAi { get; set; }
    }
}
