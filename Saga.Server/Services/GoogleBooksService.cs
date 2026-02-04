using Saga.Server.Data;
using Saga.Server.Models;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Saga.Server.Services
{
    public class GoogleBooksService : IGoogleBooksService
    {
        private readonly HttpClient _httpClient;
        private readonly SagaDbContext _context;
        private readonly ILogger<GoogleBooksService> _logger;
        private readonly string[] _apiKeys;
        private int _currentKeyIndex = 0;
        private readonly object _keyLock = new();
        private const string BaseUrl = "https://www.googleapis.com/books/v1";

        public GoogleBooksService(
            HttpClient httpClient,
            SagaDbContext context,
            ILogger<GoogleBooksService> logger,
            IConfiguration configuration)
        {
            _httpClient = httpClient;
            _context = context;
            _logger = logger;
            
            // Önce ApiKeys array'ini dene, yoksa tek ApiKey'i al
            var apiKeys = configuration.GetSection("GoogleBooks:ApiKeys").Get<string[]>();
            if (apiKeys != null && apiKeys.Length > 0)
            {
                _apiKeys = apiKeys;
                _logger.LogInformation("🔑 Google Books API: {Count} adet API key yüklendi", _apiKeys.Length);
            }
            else
            {
                var singleKey = configuration["GoogleBooks:ApiKey"];
                _apiKeys = !string.IsNullOrEmpty(singleKey) ? new[] { singleKey } : Array.Empty<string>();
            }
        }

        /// <summary>
        /// HTML taglarını temizleyen yardımcı metot
        /// </summary>
        private static string StripHtmlTags(string? html)
        {
            if (string.IsNullOrEmpty(html)) return "";
            
            // <br> ve </p> taglarını satır sonuna çevir
            var text = Regex.Replace(html, @"<br\s*/?>", "\n", RegexOptions.IgnoreCase);
            text = Regex.Replace(text, @"</p>", "\n", RegexOptions.IgnoreCase);
            
            // Diğer HTML taglarını kaldır
            text = Regex.Replace(text, @"<[^>]*>", "");
            
            // HTML entities decode
            text = text.Replace("&amp;", "&")
                       .Replace("&lt;", "<")
                       .Replace("&gt;", ">")
                       .Replace("&quot;", "\"")
                       .Replace("&#39;", "'")
                       .Replace("&nbsp;", " ");
            
            // Birden fazla satır sonunu düzenle
            text = Regex.Replace(text, @"\n{3,}", "\n\n");
            
            // Satır başı/sonu boşlukları temizle
            var lines = text.Split('\n').Select(l => l.Trim());
            text = string.Join("\n", lines).Trim();
            
            return text;
        }

        private string GetCurrentApiKey()
        {
            lock (_keyLock)
            {
                if (_apiKeys.Length == 0) return "";
                return _apiKeys[_currentKeyIndex];
            }
        }

        private bool SwitchToNextKey()
        {
            lock (_keyLock)
            {
                if (_apiKeys.Length <= 1) return false;
                
                var oldIndex = _currentKeyIndex;
                _currentKeyIndex = (_currentKeyIndex + 1) % _apiKeys.Length;
                _logger.LogWarning("🔄 API Key değiştirildi: Key {OldIndex} → Key {NewIndex}", oldIndex + 1, _currentKeyIndex + 1);
                return true;
            }
        }

        public async Task<GoogleBookDto?> GetBookByIdAsync(string googleBooksId)
        {
            try
            {
                var apiKey = GetCurrentApiKey();
                var url = string.IsNullOrEmpty(apiKey)
                    ? $"{BaseUrl}/volumes/{googleBooksId}"
                    : $"{BaseUrl}/volumes/{googleBooksId}?key={apiKey}";

                var response = await _httpClient.GetAsync(url);

                // Rate limit durumunda diğer key'e geç ve tekrar dene
                if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests && SwitchToNextKey())
                {
                    apiKey = GetCurrentApiKey();
                    url = string.IsNullOrEmpty(apiKey)
                        ? $"{BaseUrl}/volumes/{googleBooksId}"
                        : $"{BaseUrl}/volumes/{googleBooksId}?key={apiKey}";
                    response = await _httpClient.GetAsync(url);
                }

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Google Books API hatası: {StatusCode} - Book ID: {GoogleBooksId}", 
                        response.StatusCode, googleBooksId);
                    return null;
                }

                var content = await response.Content.ReadAsStringAsync();
                var bookData = JsonSerializer.Deserialize<JsonElement>(content);

                return ParseBookData(bookData);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Google Books kitap bilgisi alınırken hata: {GoogleBooksId}", googleBooksId);
                return null;
            }
        }

        public async Task<GoogleBooksSearchResult> SearchBooksAsync(string query, int startIndex = 0, int maxResults = 20, string? orderBy = null, string? langRestrict = null, string? filter = null)
        {
            const int maxRetries = 3;
            int retryCount = 0;
            int keySwitchCount = 0;
            int maxKeySwitches = _apiKeys.Length; // Her key için bir şans
            
            while (retryCount < maxRetries)
            {
                try
                {
                    var apiKey = GetCurrentApiKey();
                    var encodedQuery = Uri.EscapeDataString(query);
                    // orderBy: relevance (varsayılan) veya newest
                    var order = string.IsNullOrEmpty(orderBy) ? "relevance" : orderBy;
                    // Dil filtresi (tr, en, de, fr, vb.) - q parametresinden BAĞIMSIZ
                    var langParam = !string.IsNullOrEmpty(langRestrict) ? $"&langRestrict={langRestrict}" : "";
                    // Filter: paid-ebooks (ticari kitaplar), free-ebooks, full, partial, ebooks
                    var filterParam = !string.IsNullOrEmpty(filter) ? $"&filter={filter}" : "";
                    // printType: books (dergileri vs. ele)
                    var printTypeParam = "&printType=books";
                    
                    var url = string.IsNullOrEmpty(apiKey)
                        ? $"{BaseUrl}/volumes?q={encodedQuery}&startIndex={startIndex}&maxResults={maxResults}&orderBy={order}{langParam}{filterParam}{printTypeParam}"
                        : $"{BaseUrl}/volumes?q={encodedQuery}&startIndex={startIndex}&maxResults={maxResults}&orderBy={order}{langParam}{filterParam}{printTypeParam}&key={apiKey}";

                    _logger.LogInformation("📚 Google Books API isteği (Key {KeyIndex}): startIndex={StartIndex}", _currentKeyIndex + 1, startIndex);

                    var response = await _httpClient.GetAsync(url);

                    // Rate limit (429) hatası - önce diğer key'e geç
                    if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
                    {
                        // Diğer key'e geçmeyi dene
                        if (keySwitchCount < maxKeySwitches && SwitchToNextKey())
                        {
                            keySwitchCount++;
                            _logger.LogWarning("⚠️ Rate limit! Diğer API key'e geçildi ({KeySwitch}/{MaxSwitch})", keySwitchCount, maxKeySwitches);
                            continue; // Hemen diğer key ile dene
                        }
                        
                        // Tüm key'ler rate limited, exponential backoff ile bekle
                        retryCount++;
                        if (retryCount < maxRetries)
                        {
                            var delay = (int)Math.Pow(2, retryCount) * 1000; // 2s, 4s, 8s
                            _logger.LogWarning("⏳ Tüm key'ler rate limited, {RetryCount}. deneme, {Delay}ms bekleniyor...", retryCount, delay);
                            await Task.Delay(delay);
                            keySwitchCount = 0; // Key switch sayacını sıfırla
                            continue;
                        }
                        _logger.LogWarning("❌ Google Books rate limit aşıldı, maksimum deneme sayısına ulaşıldı");
                        return new GoogleBooksSearchResult { Items = new List<GoogleBookDto>(), TotalItems = 0 };
                    }

                    if (!response.IsSuccessStatusCode)
                    {
                        _logger.LogWarning("Google Books arama hatası: {StatusCode}", response.StatusCode);
                        return new GoogleBooksSearchResult { Items = new List<GoogleBookDto>(), TotalItems = 0 };
                    }

                    var content = await response.Content.ReadAsStringAsync();
                    var searchData = JsonSerializer.Deserialize<JsonElement>(content);

                    var results = new List<GoogleBookDto>();
                    int totalItems = 0;

                    // totalItems'ı al
                    if (searchData.TryGetProperty("totalItems", out var totalItemsElement))
                    {
                        totalItems = totalItemsElement.GetInt32();
                    }

                    if (searchData.TryGetProperty("items", out var itemsArray))
                    {
                        foreach (var item in itemsArray.EnumerateArray())
                        {
                            var bookDto = ParseBookData(item);
                            if (bookDto != null)
                            {
                                results.Add(bookDto);
                            }
                        }
                    }

                    _logger.LogInformation("✅ Google Books sonuç: {Count} kitap, toplam: {Total}, startIndex: {StartIndex}", results.Count, totalItems, startIndex);
                    return new GoogleBooksSearchResult { Items = results, TotalItems = totalItems };
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Google Books araması sırasında hata: {Query}", query);
                    return new GoogleBooksSearchResult { Items = new List<GoogleBookDto>(), TotalItems = 0 };
                }
            }
            
            return new GoogleBooksSearchResult { Items = new List<GoogleBookDto>(), TotalItems = 0 };
        }

        public async Task<Icerik?> ImportBookAsync(string googleBooksId)
        {
            try
            {
                // Önce veritabanında var mı kontrol et
                var mevcutIcerik = _context.Icerikler
                    .FirstOrDefault(i => i.HariciId == googleBooksId && i.ApiKaynagi == ApiKaynak.google_books);

                // Google Books'tan bilgileri al
                var bookDto = await GetBookByIdAsync(googleBooksId);
                if (bookDto == null)
                {
                    // API'den alınamadıysa ve veritabanında varsa mevcut olanı döndür
                    if (mevcutIcerik != null)
                    {
                        return mevcutIcerik;
                    }
                    return null;
                }

                if (mevcutIcerik != null)
                {
                    // Mevcut kayıt varsa, eksik alanları güncelle
                    bool updated = false;
                    
                    if (string.IsNullOrEmpty(mevcutIcerik.Aciklama) && !string.IsNullOrEmpty(bookDto.Aciklama))
                    {
                        mevcutIcerik.Aciklama = bookDto.Aciklama;
                        updated = true;
                        _logger.LogInformation("📝 Kitap açıklaması güncellendi: {GoogleBooksId}", googleBooksId);
                    }
                    
                    if (string.IsNullOrEmpty(mevcutIcerik.PosterUrl) && !string.IsNullOrEmpty(bookDto.PosterUrl))
                    {
                        mevcutIcerik.PosterUrl = bookDto.PosterUrl;
                        updated = true;
                    }
                    
                    if (updated)
                    {
                        await _context.SaveChangesAsync();
                    }
                    
                    _logger.LogInformation("Kitap zaten mevcut: {GoogleBooksId}", googleBooksId);
                    return mevcutIcerik;
                }

                // Meta veriyi JSON olarak hazırla
                var metaVeri = new
                {
                    yazarlar = bookDto.Yazarlar,
                    sayfaSayisi = bookDto.SayfaSayisi,
                    kategoriler = bookDto.Kategoriler,
                    yayinevi = bookDto.Yayinevi,
                    isbn = bookDto.ISBN,
                    dil = bookDto.Dil,
                    okumaLinki = bookDto.OkumaLinki
                };

                // Veritabanına kaydet
                var icerik = new Icerik
                {
                    HariciId = googleBooksId,
                    ApiKaynagi = ApiKaynak.google_books,
                    Tur = IcerikTuru.kitap,
                    Baslik = bookDto.Baslik,
                    Aciklama = bookDto.Aciklama,
                    PosterUrl = bookDto.PosterUrl,
                    YayinTarihi = ParseDateOnly(bookDto.YayinTarihi),
                    HariciPuan = bookDto.OrtalamaPuan.HasValue ? (decimal)(bookDto.OrtalamaPuan.Value * 2) : 0, // 5 üzerinden 10'a çevir
                    HariciOySayisi = bookDto.OySayisi ?? 0,
                    MetaVeri = JsonSerializer.Serialize(metaVeri),
                    OlusturulmaZamani = DateTime.UtcNow
                };

                _context.Icerikler.Add(icerik);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Kitap başarıyla import edildi: {Title} (Google Books ID: {GoogleBooksId})", 
                    icerik.Baslik, googleBooksId);
                return icerik;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Kitap import edilirken hata: {GoogleBooksId}", googleBooksId);
                return null;
            }
        }

        private GoogleBookDto? ParseBookData(JsonElement bookData)
        {
            try
            {
                var id = bookData.GetProperty("id").GetString();
                if (string.IsNullOrEmpty(id))
                    return null;

                var volumeInfo = bookData.GetProperty("volumeInfo");

                var dto = new GoogleBookDto
                {
                    Id = id,
                    Baslik = volumeInfo.TryGetProperty("title", out var title) ? title.GetString() ?? "" : "",
                    Aciklama = volumeInfo.TryGetProperty("description", out var desc) ? StripHtmlTags(desc.GetString()) : null,
                    YayinTarihi = volumeInfo.TryGetProperty("publishedDate", out var date) ? date.GetString() : null,
                    Dil = volumeInfo.TryGetProperty("language", out var lang) ? lang.GetString() : null,
                    SayfaSayisi = volumeInfo.TryGetProperty("pageCount", out var pages) ? pages.GetInt32() : null,
                    OkumaLinki = volumeInfo.TryGetProperty("previewLink", out var preview) ? preview.GetString() : null,
                    Kaynak = "google_books"
                };

                // Authors
                if (volumeInfo.TryGetProperty("authors", out var authors))
                {
                    dto.Yazarlar = new List<string>();
                    foreach (var author in authors.EnumerateArray())
                    {
                        var authorName = author.GetString();
                        if (!string.IsNullOrEmpty(authorName))
                        {
                            dto.Yazarlar.Add(authorName);
                        }
                    }
                }

                // Categories
                if (volumeInfo.TryGetProperty("categories", out var categories))
                {
                    dto.Kategoriler = new List<string>();
                    foreach (var category in categories.EnumerateArray())
                    {
                        var categoryName = category.GetString();
                        if (!string.IsNullOrEmpty(categoryName))
                        {
                            dto.Kategoriler.Add(categoryName);
                        }
                    }
                }

                // Image
                if (volumeInfo.TryGetProperty("imageLinks", out var imageLinks))
                {
                    if (imageLinks.TryGetProperty("thumbnail", out var thumbnail))
                    {
                        dto.PosterUrl = thumbnail.GetString();
                    }
                    else if (imageLinks.TryGetProperty("smallThumbnail", out var smallThumbnail))
                    {
                        dto.PosterUrl = smallThumbnail.GetString();
                    }
                }

                // Ratings
                dto.OrtalamaPuan = volumeInfo.TryGetProperty("averageRating", out var avgRating) 
                    ? avgRating.GetDouble() 
                    : null;
                dto.OySayisi = volumeInfo.TryGetProperty("ratingsCount", out var ratingsCount) 
                    ? ratingsCount.GetInt32() 
                    : null;

                // Yayınevi
                dto.Yayinevi = volumeInfo.TryGetProperty("publisher", out var publisher) 
                    ? publisher.GetString() 
                    : null;

                // ISBN
                if (volumeInfo.TryGetProperty("industryIdentifiers", out var identifiers))
                {
                    foreach (var identifier in identifiers.EnumerateArray())
                    {
                        if (identifier.TryGetProperty("type", out var type) && 
                            (type.GetString() == "ISBN_13" || type.GetString() == "ISBN_10"))
                        {
                            dto.ISBN = identifier.TryGetProperty("identifier", out var isbn) ? isbn.GetString() : null;
                            if (type.GetString() == "ISBN_13") break; // ISBN_13'ü tercih et
                        }
                    }
                }

                return dto;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Google Books veri parse edilirken hata");
                return null;
            }
        }

        private DateOnly? ParseDateOnly(string? dateString)
        {
            if (string.IsNullOrWhiteSpace(dateString))
                return null;

            // Google Books bazen sadece yıl döner (örn: "2020")
            if (dateString.Length == 4 && int.TryParse(dateString, out var year))
            {
                return new DateOnly(year, 1, 1);
            }

            // Tam tarih formatı
            if (DateOnly.TryParse(dateString, out var date))
                return date;

            // YYYY-MM formatı
            if (dateString.Length == 7 && dateString.Contains('-'))
            {
                var parts = dateString.Split('-');
                if (int.TryParse(parts[0], out var y) && int.TryParse(parts[1], out var m))
                {
                    return new DateOnly(y, m, 1);
                }
            }

            return null;
        }

        /// <summary>
        /// Kitap başlığı ve yazar ile arama yaparak açıklaması olan bir edisyon bulur.
        /// Türkçe açıklamayı önceliklendirir.
        /// </summary>
        public async Task<string?> FindDescriptionForBookAsync(string title, string? author)
        {
            try
            {
                // Farklı arama stratejileri dene
                var searchQueries = new List<string>();
                
                // 1. Başlık + yazar
                if (!string.IsNullOrEmpty(author))
                {
                    searchQueries.Add($"intitle:{title}+inauthor:{author}");
                    searchQueries.Add($"{title} {author}");
                }
                
                // 2. Sadece başlık
                searchQueries.Add($"intitle:{title}");
                searchQueries.Add(title);
                
                string? turkceAciklama = null;
                string? digerAciklama = null;

                void ProcessResults(GoogleBooksSearchResult searchResult)
                {
                    if (searchResult.Items == null) return;

                    var normalizedTitle = NormalizeTitle(title);
                    var booksWithDescription = searchResult.Items
                        .Where(b => !string.IsNullOrEmpty(b.Aciklama))
                        .Where(b => NormalizeTitle(b.Baslik).Contains(normalizedTitle) ||
                                    normalizedTitle.Contains(NormalizeTitle(b.Baslik)))
                        .ToList();

                    foreach (var book in booksWithDescription)
                    {
                        if (ContainsTurkishChars(book.Aciklama!))
                        {
                            turkceAciklama = book.Aciklama;
                            _logger.LogInformation("📖 Türkçe açıklama bulundu: {Title} -> {FoundTitle}",
                                title, book.Baslik);
                            break;
                        }
                        else if (digerAciklama == null)
                        {
                            digerAciklama = book.Aciklama;
                        }
                    }
                }
                
                foreach (var searchQuery in searchQueries)
                {
                    var searchResultTr = await SearchBooksAsync(searchQuery, maxResults: 15, langRestrict: "tr");
                    ProcessResults(searchResultTr);
                    if (turkceAciklama != null) break;

                    var searchResult = await SearchBooksAsync(searchQuery, maxResults: 15);
                    ProcessResults(searchResult);
                    if (turkceAciklama != null) break;
                }
                
                // Türkçe açıklama varsa onu, yoksa diğer dildeki açıklamayı döndür
                if (turkceAciklama != null)
                {
                    return turkceAciklama;
                }
                
                if (digerAciklama != null)
                {
                    _logger.LogInformation("📖 Yabancı dilde açıklama bulundu: {Title}", title);
                    return digerAciklama;
                }
                
                _logger.LogWarning("📖 Açıklama bulunamadı: {Title} - {Author}", title, author);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Kitap açıklaması aranırken hata: {Title}", title);
                return null;
            }
        }

        private static bool ContainsTurkishChars(string text)
        {
            // Türkçe karakterler: ç, ğ, ı, İ, ö, ş, ü, Ç, Ğ, Ö, Ş, Ü
            return text.Any(c => "çğıİöşüÇĞÖŞÜ".Contains(c));
        }

        private static string NormalizeTitle(string title)
        {
            if (string.IsNullOrEmpty(title)) return "";
            return title.ToLowerInvariant()
                .Replace("ı", "i")
                .Replace("ğ", "g")
                .Replace("ü", "u")
                .Replace("ş", "s")
                .Replace("ö", "o")
                .Replace("ç", "c")
                .Trim();
        }
    }
}
