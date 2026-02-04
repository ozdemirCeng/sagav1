using Saga.Server.Data;
using Saga.Server.Models;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Saga.Server.Services
{
    public class OpenLibraryService : IOpenLibraryService
    {
        private readonly HttpClient _httpClient;
        private readonly SagaDbContext _context;
        private readonly ILogger<OpenLibraryService> _logger;
        private const string BaseUrl = "https://openlibrary.org";

        public OpenLibraryService(
            HttpClient httpClient,
            SagaDbContext context,
            ILogger<OpenLibraryService> logger)
        {
            _httpClient = httpClient;
            _context = context;
            _logger = logger;
        }

        public async Task<OpenLibrarySearchResult> SearchBooksAsync(string query, int page = 1, int limit = 20)
        {
            try
            {
                var url = $"{BaseUrl}/search.json?q={Uri.EscapeDataString(query)}&page={page}&limit={limit}";
                var response = await _httpClient.GetAsync(url);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Open Library arama hatası: {StatusCode}", response.StatusCode);
                    return new OpenLibrarySearchResult();
                }

                var json = await response.Content.ReadAsStringAsync();
                var data = JsonSerializer.Deserialize<JsonElement>(json);

                var result = new OpenLibrarySearchResult
                {
                    TotalItems = data.TryGetProperty("numFound", out var total) ? total.GetInt32() : 0
                };

                if (!data.TryGetProperty("docs", out var docs) || docs.ValueKind != JsonValueKind.Array)
                {
                    return result;
                }

                foreach (var doc in docs.EnumerateArray())
                {
                    var title = doc.TryGetProperty("title", out var t) ? t.GetString() : null;
                    if (string.IsNullOrWhiteSpace(title)) continue;

                    var authors = new List<string>();
                    if (doc.TryGetProperty("author_name", out var authorArr) && authorArr.ValueKind == JsonValueKind.Array)
                    {
                        authors.AddRange(authorArr.EnumerateArray().Select(a => a.GetString()).Where(a => !string.IsNullOrWhiteSpace(a))!);
                    }

                    string? workKey = doc.TryGetProperty("key", out var keyVal) ? keyVal.GetString() : null; // /works/OL..W

                    string? olid = null;
                    if (doc.TryGetProperty("edition_key", out var editionArr) && editionArr.ValueKind == JsonValueKind.Array)
                    {
                        olid = editionArr.EnumerateArray().Select(e => e.GetString()).FirstOrDefault(s => !string.IsNullOrWhiteSpace(s));
                    }

                    var coverId = doc.TryGetProperty("cover_i", out var coverVal) ? coverVal.GetInt32() : (int?)null;
                    var coverUrl = coverId.HasValue ? $"https://covers.openlibrary.org/b/id/{coverId}-L.jpg" : null;

                    var publishYear = doc.TryGetProperty("first_publish_year", out var yearVal) ? yearVal.GetInt32().ToString() : null;

                    string? isbn = null;
                    if (doc.TryGetProperty("isbn", out var isbnArr) && isbnArr.ValueKind == JsonValueKind.Array)
                    {
                        isbn = isbnArr.EnumerateArray().Select(i => i.GetString()).FirstOrDefault(s => !string.IsNullOrWhiteSpace(s));
                    }

                    if (string.IsNullOrWhiteSpace(coverUrl) && !string.IsNullOrWhiteSpace(isbn))
                    {
                        coverUrl = $"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg";
                    }
                    if (string.IsNullOrWhiteSpace(coverUrl) && !string.IsNullOrWhiteSpace(olid))
                    {
                        coverUrl = $"https://covers.openlibrary.org/b/olid/{olid}-L.jpg";
                    }

                    string? language = null;
                    if (doc.TryGetProperty("language", out var langArr) && langArr.ValueKind == JsonValueKind.Array)
                    {
                        language = langArr.EnumerateArray().Select(l => l.GetString()).FirstOrDefault(s => !string.IsNullOrWhiteSpace(s));
                    }
                    language = NormalizeLanguageCode(language);

                    var subjects = new List<string>();
                    if (doc.TryGetProperty("subject", out var subjArr) && subjArr.ValueKind == JsonValueKind.Array)
                    {
                        subjects.AddRange(subjArr.EnumerateArray().Select(s => s.GetString()).Where(s => !string.IsNullOrWhiteSpace(s))!);
                    }

                    var id = !string.IsNullOrWhiteSpace(olid)
                        ? olid!
                        : (!string.IsNullOrWhiteSpace(workKey) ? $"work:{workKey!.Replace("/works/", "")}" : Guid.NewGuid().ToString());
                    var readUrl = !string.IsNullOrWhiteSpace(olid)
                        ? $"{BaseUrl}/books/{olid}"
                        : (!string.IsNullOrWhiteSpace(workKey) ? $"{BaseUrl}{workKey}" : null);

                    result.Items.Add(new OpenLibraryBookDto
                    {
                        Id = id,
                        Baslik = title!,
                        Yazarlar = authors.Any() ? authors : null,
                        YayinTarihi = publishYear,
                        PosterUrl = coverUrl,
                        Dil = language,
                        Kategoriler = subjects.Any() ? subjects.Take(10).ToList() : null,
                        ISBN = isbn,
                        OkumaLinki = readUrl,
                        WorkKey = workKey
                    });
                }

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Open Library arama sırasında hata: {Query}", query);
                return new OpenLibrarySearchResult();
            }
        }

        public async Task<OpenLibraryBookDto?> GetBookByIsbnAsync(string isbn)
        {
            if (string.IsNullOrWhiteSpace(isbn)) return null;
            var cleanIsbn = Regex.Replace(isbn, "[^0-9Xx]", "");

            return await GetBookByBibKeyAsync($"ISBN:{cleanIsbn}");
        }

        public async Task<OpenLibraryBookDto?> GetBookByOlidAsync(string olid)
        {
            if (string.IsNullOrWhiteSpace(olid)) return null;
            var clean = olid.StartsWith("ol:", StringComparison.OrdinalIgnoreCase) ? olid.Substring(3) : olid;
            return await GetBookByBibKeyAsync($"OLID:{clean}");
        }

        public async Task<OpenLibraryBookDto?> FindBookAsync(string title, string? author = null)
        {
            if (string.IsNullOrWhiteSpace(title)) return null;

            var q = Uri.EscapeDataString(title);
            var authorQ = !string.IsNullOrWhiteSpace(author) ? $"&author={Uri.EscapeDataString(author)}" : "";
            var url = $"{BaseUrl}/search.json?title={q}{authorQ}&limit=1";

            var response = await _httpClient.GetAsync(url);
            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadAsStringAsync();
            var data = JsonSerializer.Deserialize<JsonElement>(json);

            if (!data.TryGetProperty("docs", out var docs) || docs.ValueKind != JsonValueKind.Array) return null;
            var first = docs.EnumerateArray().FirstOrDefault();
            if (first.ValueKind == JsonValueKind.Undefined) return null;

            string? olid = null;
            if (first.TryGetProperty("edition_key", out var editionArr) && editionArr.ValueKind == JsonValueKind.Array)
            {
                olid = editionArr.EnumerateArray().Select(e => e.GetString()).FirstOrDefault(s => !string.IsNullOrWhiteSpace(s));
            }

            if (!string.IsNullOrWhiteSpace(olid))
            {
                return await GetBookByOlidAsync(olid);
            }

            var workKey = first.TryGetProperty("key", out var keyVal) ? keyVal.GetString() : null;
            if (!string.IsNullOrWhiteSpace(workKey))
            {
                return await GetBookByWorkKeyAsync(workKey!);
            }

            return null;
        }

        public async Task<Icerik?> ImportBookAsync(string olid)
        {
            try
            {
                OpenLibraryBookDto? book;

                if (olid.StartsWith("work:", StringComparison.OrdinalIgnoreCase))
                {
                    var workId = olid.Substring(5);
                    book = await GetBookByWorkKeyAsync($"/works/{workId}");
                }
                else
                {
                    book = await GetBookByOlidAsync(olid);
                }
                if (book == null) return null;

                var hariciId = $"ol:{book.Id}";

                var mevcutIcerik = _context.Icerikler
                    .FirstOrDefault(i => i.HariciId == hariciId && i.ApiKaynagi == ApiKaynak.diger);

                if (mevcutIcerik != null)
                {
                    return mevcutIcerik;
                }

                var metaVeri = new
                {
                    yazarlar = book.Yazarlar,
                    sayfaSayisi = book.SayfaSayisi,
                    kategoriler = book.Kategoriler,
                    yayinevi = book.Yayinevi,
                    isbn = book.ISBN,
                    okumaLinki = book.OkumaLinki,
                    openLibraryId = book.Id,
                    workKey = book.WorkKey
                };

                var icerik = new Icerik
                {
                    HariciId = hariciId,
                    ApiKaynagi = ApiKaynak.diger,
                    Tur = IcerikTuru.kitap,
                    Baslik = book.Baslik,
                    Aciklama = book.Aciklama,
                    PosterUrl = book.PosterUrl,
                    YayinTarihi = ParseDateOnly(book.YayinTarihi),
                    HariciPuan = 0,
                    HariciOySayisi = 0,
                    MetaVeri = JsonSerializer.Serialize(metaVeri),
                    OlusturulmaZamani = DateTime.UtcNow
                };

                _context.Icerikler.Add(icerik);
                await _context.SaveChangesAsync();

                return icerik;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Open Library import hatası: {Olid}", olid);
                return null;
            }
        }

        private async Task<OpenLibraryBookDto?> GetBookByBibKeyAsync(string bibKey)
        {
            var url = $"{BaseUrl}/api/books?bibkeys={Uri.EscapeDataString(bibKey)}&format=json&jscmd=data";
            var response = await _httpClient.GetAsync(url);
            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadAsStringAsync();
            var data = JsonSerializer.Deserialize<JsonElement>(json);
            if (!data.TryGetProperty(bibKey, out var bookData)) return null;

            return await ParseBookDataAsync(bookData);
        }

        public async Task<OpenLibraryBookDto?> GetBookByWorkKeyAsync(string workKey)
        {
            var normalizedWorkKey = workKey.StartsWith("/works/") ? workKey : $"/works/{workKey.TrimStart('/')}";
            var url = $"{BaseUrl}{normalizedWorkKey}.json";
            var response = await _httpClient.GetAsync(url);
            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadAsStringAsync();
            var workData = JsonSerializer.Deserialize<JsonElement>(json);

            var title = workData.TryGetProperty("title", out var titleVal) ? titleVal.GetString() : null;
            if (string.IsNullOrWhiteSpace(title)) return null;

            var desc = ExtractDescription(workData);

            var subjects = new List<string>();
            if (workData.TryGetProperty("subjects", out var subjArr) && subjArr.ValueKind == JsonValueKind.Array)
            {
                subjects.AddRange(subjArr.EnumerateArray().Select(s => s.GetString()).Where(s => !string.IsNullOrWhiteSpace(s))!);
            }

            string? coverUrl = null;
            if (workData.TryGetProperty("covers", out var covers) && covers.ValueKind == JsonValueKind.Array)
            {
                var coverId = covers.EnumerateArray().Select(c => c.GetInt32()).FirstOrDefault();
                if (coverId > 0)
                {
                    coverUrl = $"https://covers.openlibrary.org/b/id/{coverId}-L.jpg";
                }
            }

            var authorKeys = new List<string>();
            if (workData.TryGetProperty("authors", out var authorsArr) && authorsArr.ValueKind == JsonValueKind.Array)
            {
                foreach (var a in authorsArr.EnumerateArray())
                {
                    if (a.TryGetProperty("author", out var authorObj) && authorObj.TryGetProperty("key", out var authorKey))
                    {
                        var key = authorKey.GetString();
                        if (!string.IsNullOrWhiteSpace(key)) authorKeys.Add(key);
                    }
                }
            }

            List<string>? authorNames = null;
            if (authorKeys.Any())
            {
                authorNames = new List<string>();
                var authorTasks = authorKeys.Take(5).Select(async key =>
                {
                    var authorResp = await _httpClient.GetAsync($"{BaseUrl}{key}.json");
                    if (!authorResp.IsSuccessStatusCode) return (string?)null;
                    var authorJson = await authorResp.Content.ReadAsStringAsync();
                    var authorData = JsonSerializer.Deserialize<JsonElement>(authorJson);
                    return authorData.TryGetProperty("name", out var nameVal) ? nameVal.GetString() : null;
                });

                foreach (var name in await Task.WhenAll(authorTasks))
                {
                    if (!string.IsNullOrWhiteSpace(name)) authorNames.Add(name!);
                }

                if (!authorNames.Any()) authorNames = null;
            }

            string? isbn = null;
            string? publishDate = null;
            int? pageCount = null;
            string? publisher = null;
            string? language = null;
            string? editionKey = null;

            var editionsUrl = $"{BaseUrl}{normalizedWorkKey}/editions.json?limit=1";
            var editionsResp = await _httpClient.GetAsync(editionsUrl);
            if (editionsResp.IsSuccessStatusCode)
            {
                var editionsJson = await editionsResp.Content.ReadAsStringAsync();
                var editionsData = JsonSerializer.Deserialize<JsonElement>(editionsJson);
                if (editionsData.TryGetProperty("entries", out var entries) && entries.ValueKind == JsonValueKind.Array)
                {
                    var firstEdition = entries.EnumerateArray().FirstOrDefault();
                    if (firstEdition.ValueKind != JsonValueKind.Undefined)
                    {
                        if (firstEdition.TryGetProperty("key", out var eKey)) editionKey = eKey.GetString();

                        if (firstEdition.TryGetProperty("isbn_13", out var isbn13Arr) && isbn13Arr.ValueKind == JsonValueKind.Array)
                        {
                            isbn = isbn13Arr.EnumerateArray().Select(i => i.GetString()).FirstOrDefault(s => !string.IsNullOrWhiteSpace(s));
                        }
                        if (string.IsNullOrWhiteSpace(isbn) && firstEdition.TryGetProperty("isbn_10", out var isbn10Arr) && isbn10Arr.ValueKind == JsonValueKind.Array)
                        {
                            isbn = isbn10Arr.EnumerateArray().Select(i => i.GetString()).FirstOrDefault(s => !string.IsNullOrWhiteSpace(s));
                        }

                        publishDate = firstEdition.TryGetProperty("publish_date", out var pd) ? pd.GetString() : null;
                        pageCount = firstEdition.TryGetProperty("number_of_pages", out var pages) ? pages.GetInt32() : (int?)null;

                        if (firstEdition.TryGetProperty("publishers", out var pubs) && pubs.ValueKind == JsonValueKind.Array)
                        {
                            publisher = pubs.EnumerateArray().Select(p => p.GetString()).FirstOrDefault(s => !string.IsNullOrWhiteSpace(s));
                        }

                        if (firstEdition.TryGetProperty("languages", out var langs) && langs.ValueKind == JsonValueKind.Array)
                        {
                            var firstLang = langs.EnumerateArray().FirstOrDefault();
                            if (firstLang.ValueKind != JsonValueKind.Undefined && firstLang.TryGetProperty("key", out var langKey))
                            {
                                language = langKey.GetString()?.Replace("/languages/", "");
                            }
                        }

                        if (string.IsNullOrWhiteSpace(coverUrl) && firstEdition.TryGetProperty("covers", out var editionCovers) && editionCovers.ValueKind == JsonValueKind.Array)
                        {
                            var editionCoverId = editionCovers.EnumerateArray().Select(c => c.GetInt32()).FirstOrDefault();
                            if (editionCoverId > 0)
                            {
                                coverUrl = $"https://covers.openlibrary.org/b/id/{editionCoverId}-L.jpg";
                            }
                        }
                    }
                }
            }

            if (string.IsNullOrWhiteSpace(coverUrl) && !string.IsNullOrWhiteSpace(isbn))
            {
                coverUrl = $"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg";
            }

            language = NormalizeLanguageCode(language);

            var cleanId = normalizedWorkKey.Replace("/works/", "");
            var readUrl = !string.IsNullOrWhiteSpace(editionKey)
                ? $"{BaseUrl}{editionKey}"
                : $"{BaseUrl}{normalizedWorkKey}";

            return new OpenLibraryBookDto
            {
                Id = cleanId,
                Baslik = title!,
                Yazarlar = authorNames,
                Aciklama = desc,
                YayinTarihi = publishDate,
                PosterUrl = coverUrl,
                Dil = language,
                SayfaSayisi = pageCount,
                Kategoriler = subjects.Any() ? subjects.Take(10).ToList() : null,
                Yayinevi = publisher,
                ISBN = isbn,
                OkumaLinki = readUrl,
                WorkKey = normalizedWorkKey
            };
        }

        private async Task<OpenLibraryBookDto?> ParseBookDataAsync(JsonElement bookData)
        {
            try
            {
                var title = bookData.TryGetProperty("title", out var titleVal) ? titleVal.GetString() : null;
                if (string.IsNullOrWhiteSpace(title)) return null;

                var authors = new List<string>();
                if (bookData.TryGetProperty("authors", out var authorsArr) && authorsArr.ValueKind == JsonValueKind.Array)
                {
                    foreach (var a in authorsArr.EnumerateArray())
                    {
                        if (a.TryGetProperty("name", out var nameVal))
                        {
                            var name = nameVal.GetString();
                            if (!string.IsNullOrWhiteSpace(name)) authors.Add(name);
                        }
                    }
                }

                var publishers = new List<string>();
                if (bookData.TryGetProperty("publishers", out var pubArr) && pubArr.ValueKind == JsonValueKind.Array)
                {
                    publishers.AddRange(pubArr.EnumerateArray().Select(p => p.GetString()).Where(p => !string.IsNullOrWhiteSpace(p))!);
                }

                string? isbn = null;
                if (bookData.TryGetProperty("identifiers", out var ids) && ids.ValueKind == JsonValueKind.Object)
                {
                    if (ids.TryGetProperty("isbn_13", out var isbn13Arr) && isbn13Arr.ValueKind == JsonValueKind.Array)
                    {
                        isbn = isbn13Arr.EnumerateArray().Select(i => i.GetString()).FirstOrDefault(s => !string.IsNullOrWhiteSpace(s));
                    }
                    if (string.IsNullOrWhiteSpace(isbn) && ids.TryGetProperty("isbn_10", out var isbn10Arr) && isbn10Arr.ValueKind == JsonValueKind.Array)
                    {
                        isbn = isbn10Arr.EnumerateArray().Select(i => i.GetString()).FirstOrDefault(s => !string.IsNullOrWhiteSpace(s));
                    }
                }

                string? publishDate = bookData.TryGetProperty("publish_date", out var pd) ? pd.GetString() : null;
                int? pageCount = bookData.TryGetProperty("number_of_pages", out var pages) ? pages.GetInt32() : (int?)null;

                string? coverUrl = null;
                if (bookData.TryGetProperty("cover", out var cover) && cover.ValueKind == JsonValueKind.Object)
                {
                    coverUrl = cover.TryGetProperty("large", out var large) ? large.GetString()
                        : cover.TryGetProperty("medium", out var medium) ? medium.GetString()
                        : cover.TryGetProperty("small", out var small) ? small.GetString() : null;
                }

                var subjects = new List<string>();
                if (bookData.TryGetProperty("subjects", out var subjArr) && subjArr.ValueKind == JsonValueKind.Array)
                {
                    foreach (var s in subjArr.EnumerateArray())
                    {
                        if (s.TryGetProperty("name", out var nameVal))
                        {
                            var name = nameVal.GetString();
                            if (!string.IsNullOrWhiteSpace(name)) subjects.Add(name);
                        }
                    }
                }

                string? workKey = null;
                if (bookData.TryGetProperty("works", out var works) && works.ValueKind == JsonValueKind.Array)
                {
                    var firstWork = works.EnumerateArray().FirstOrDefault();
                    if (firstWork.ValueKind != JsonValueKind.Undefined && firstWork.TryGetProperty("key", out var workKeyVal))
                    {
                        workKey = workKeyVal.GetString();
                    }
                }

                string? language = null;
                if (bookData.TryGetProperty("languages", out var langs) && langs.ValueKind == JsonValueKind.Array)
                {
                    var firstLang = langs.EnumerateArray().FirstOrDefault();
                    if (firstLang.ValueKind != JsonValueKind.Undefined && firstLang.TryGetProperty("key", out var langKey))
                    {
                        language = langKey.GetString()?.Replace("/languages/", "");
                    }
                }
                language = NormalizeLanguageCode(language);

                string? readUrl = null;
                if (bookData.TryGetProperty("availability", out var availability) && availability.ValueKind == JsonValueKind.Object)
                {
                    if (availability.TryGetProperty("read_url", out var readUrlVal))
                    {
                        readUrl = readUrlVal.GetString();
                    }
                }

                if (string.IsNullOrWhiteSpace(readUrl))
                {
                    if (bookData.TryGetProperty("preview_url", out var previewUrl)) readUrl = previewUrl.GetString();
                }
                if (string.IsNullOrWhiteSpace(readUrl))
                {
                    if (bookData.TryGetProperty("url", out var urlVal)) readUrl = urlVal.GetString();
                }
                if (string.IsNullOrWhiteSpace(readUrl))
                {
                    if (bookData.TryGetProperty("info_url", out var infoUrl)) readUrl = infoUrl.GetString();
                }
                if (string.IsNullOrWhiteSpace(readUrl) && !string.IsNullOrWhiteSpace(workKey))
                {
                    readUrl = $"{BaseUrl}{workKey}";
                }

                string? description = null;
                if (!string.IsNullOrWhiteSpace(workKey))
                {
                    var workUrl = $"{BaseUrl}{workKey}.json";
                    var workResp = await _httpClient.GetAsync(workUrl);
                    if (workResp.IsSuccessStatusCode)
                    {
                        var workJson = await workResp.Content.ReadAsStringAsync();
                        var workData = JsonSerializer.Deserialize<JsonElement>(workJson);
                        description = ExtractDescription(workData);
                    }
                }

                var olid = bookData.TryGetProperty("key", out var keyVal) ? keyVal.GetString() : null;
                var cleanId = !string.IsNullOrWhiteSpace(olid) ? olid.Replace("/books/", "") : Guid.NewGuid().ToString();

                if (string.IsNullOrWhiteSpace(coverUrl) && !string.IsNullOrWhiteSpace(isbn))
                {
                    coverUrl = $"https://covers.openlibrary.org/b/isbn/{isbn}-L.jpg";
                }
                if (string.IsNullOrWhiteSpace(coverUrl) && !string.IsNullOrWhiteSpace(cleanId))
                {
                    coverUrl = $"https://covers.openlibrary.org/b/olid/{cleanId}-L.jpg";
                }

                return new OpenLibraryBookDto
                {
                    Id = cleanId,
                    Baslik = title!,
                    Yazarlar = authors.Any() ? authors : null,
                    Aciklama = description,
                    YayinTarihi = publishDate,
                    PosterUrl = coverUrl,
                    Dil = language,
                    SayfaSayisi = pageCount,
                    Kategoriler = subjects.Any() ? subjects.Take(10).ToList() : null,
                    Yayinevi = publishers.FirstOrDefault(),
                    ISBN = isbn,
                    OkumaLinki = readUrl,
                    WorkKey = workKey
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Open Library kitap parse hatası");
                return null;
            }
        }

        private static string? ExtractDescription(JsonElement data)
        {
            if (data.TryGetProperty("description", out var descVal))
            {
                if (descVal.ValueKind == JsonValueKind.String)
                {
                    return descVal.GetString();
                }
                if (descVal.ValueKind == JsonValueKind.Object && descVal.TryGetProperty("value", out var valueVal))
                {
                    return valueVal.GetString();
                }
            }
            return null;
        }

        private static string? NormalizeLanguageCode(string? code)
        {
            if (string.IsNullOrWhiteSpace(code)) return null;
            var c = code.Trim().ToLowerInvariant();
            if (c.StartsWith("tur") || c.StartsWith("tr")) return "tr";
            if (c.StartsWith("eng") || c.StartsWith("en")) return "en";
            return c;
        }

        private static DateOnly? ParseDateOnly(string? dateString)
        {
            if (string.IsNullOrWhiteSpace(dateString)) return null;

            if (DateOnly.TryParse(dateString, out var date)) return date;

            if (Regex.IsMatch(dateString, "^\\d{4}$"))
            {
                if (DateOnly.TryParse($"{dateString}-01-01", out var yearDate)) return yearDate;
            }

            return null;
        }
    }
}
