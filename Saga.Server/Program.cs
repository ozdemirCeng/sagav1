using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using Saga.Server.Data;
using Saga.Server.Models;
using Saga.Server.Services;
using Saga.Server.Middleware;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// 1. VERİTABANI BAĞLANTISI (SADE VE TEMİZ)
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

// DataSourceBuilder ile Enum mapleme yapıyoruz
var dataSourceBuilder = new NpgsqlDataSourceBuilder(connectionString);
dataSourceBuilder.MapEnum<ApiKaynak>("api_kaynak");
dataSourceBuilder.MapEnum<IcerikTuru>("icerik_turu");
dataSourceBuilder.MapEnum<KullaniciRol>("kullanici_rol");
dataSourceBuilder.MapEnum<AktiviteTuru>("aktivite_turu");
dataSourceBuilder.MapEnum<ListeTuru>("liste_turu");
dataSourceBuilder.MapEnum<KutuphaneDurum>("kutuphane_durum");
var dataSource = dataSourceBuilder.Build();

builder.Services.AddDbContext<SagaDbContext>(options =>
    options.UseNpgsql(dataSource));

// 2. TOKEN SERVİSİ
builder.Services.AddScoped<TokenService>();

// 2.1. EXTERNAL API SERVİSLERİ
builder.Services.AddHttpClient<ITmdbService, TmdbService>();
builder.Services.AddHttpClient<IGoogleBooksService, GoogleBooksService>();
builder.Services.AddHttpClient<IOpenLibraryService, OpenLibraryService>();
builder.Services.AddHttpClient<ILocalAiService, LocalAiService>(client =>
{
    var timeoutSeconds = builder.Configuration.GetValue<int?>("LocalAi:TimeoutSeconds") ?? 30;
    client.Timeout = TimeSpan.FromSeconds(timeoutSeconds);
});

// 2.2. BİLDİRİM SERVİSİ
builder.Services.AddScoped<IBildirimService, BildirimService>();

// 2.3. SEMANTİK ARAMA SERVİSİ (HuggingFace Spaces)
builder.Services.AddHttpClient<ISemanticSearchService, SemanticSearchService>(client =>
{
    var baseUrl = builder.Configuration["AI:SemanticSearchUrl"] ?? "https://ozdemirceng-saga-semantic.hf.space";
    client.BaseAddress = new Uri(baseUrl);
    client.Timeout = TimeSpan.FromSeconds(120); // LLM için 2 dakika timeout
});

// 2.3.1. GROQ AI SERVİSİ (Direkt Groq API)
builder.Services.AddHttpClient<IGroqService, GroqService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(60);
});

// 2.4. RESPONSE CACHING
builder.Services.AddResponseCaching();
builder.Services.AddMemoryCache();

// 2.4. RATE LIMITING - DDoS ve aşırı yük koruması
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    
    // Genel IP bazlı limit: 100 istek / dakika
    options.AddFixedWindowLimiter("fixed", opt =>
    {
        opt.PermitLimit = 100;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 5;
    });
    
    // Ağır istekler için: 20 istek / dakika (import, seed vb.)
    options.AddFixedWindowLimiter("heavy", opt =>
    {
        opt.PermitLimit = 20;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueLimit = 2;
    });

    // Arama için: 30 istek / dakika
    options.AddSlidingWindowLimiter("search", opt =>
    {
        opt.PermitLimit = 30;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.SegmentsPerWindow = 6;
        opt.QueueLimit = 3;
    });

    // AI istekleri için: 10 istek / dakika (Groq rate limit koruması)
    options.AddFixedWindowLimiter("ai", opt =>
    {
        opt.PermitLimit = 10;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueLimit = 2;
    });
});

// 2.5. HEALTH CHECKS
builder.Services.AddHealthChecks()
    .AddNpgSql(connectionString!, name: "database", timeout: TimeSpan.FromSeconds(5));

// 3. CORS - Environment'a göre ayarla
builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactAppPolicy", policy =>
    {
        if (builder.Environment.IsDevelopment())
        {
            // Development: Her yerden erişime izin ver
            policy.AllowAnyOrigin()
                  .AllowAnyMethod()
                  .AllowAnyHeader()
                  .WithExposedHeaders("X-Toplam-Sayfa", "X-Toplam-Kayit", "X-Mevcut-Sayfa");
        }
        else
        {
            // Production: Sadece belirli domain'lere izin ver
            var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() 
                ?? new[] { "https://saga.example.com" };
            policy.WithOrigins(allowedOrigins)
                  .AllowAnyMethod()
                  .AllowAnyHeader()
                  .AllowCredentials()
                  .WithExposedHeaders("X-Toplam-Sayfa", "X-Toplam-Kayit", "X-Mevcut-Sayfa");
        }
    });
});

// 4. AUTH - SUPABASE JWT VALIDATION
var supabaseUrl = builder.Configuration["Supabase:Url"] ?? throw new Exception("Supabase URL bulunamadı!");
var supabaseJwtSecret = builder.Configuration["Supabase:JwtSecret"] ?? throw new Exception("Supabase JWT Secret bulunamadı!");
var supabaseProjectRef = new Uri(supabaseUrl).Host.Split('.')[0]; // iabkzwsosqpcghjqkbzt

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(supabaseJwtSecret)),
            ValidateIssuer = true,
            ValidIssuer = $"{supabaseUrl}/auth/v1",
            ValidateAudience = true,
            ValidAudience = "authenticated",
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(5),
            NameClaimType = "sub" // Supabase'de user ID "sub" claim'inde
        };
        
        // Debug için JWT hatalarını loglayalım (sadece development'ta)
        if (builder.Environment.IsDevelopment())
        {
            options.Events = new JwtBearerEvents
            {
                OnAuthenticationFailed = context =>
                {
                    Console.WriteLine($"🔴 JWT Authentication failed: {context.Exception.Message}");
                    return Task.CompletedTask;
                },
                OnTokenValidated = context =>
                {
                    Console.WriteLine($"✅ JWT Token validated successfully for user: {context.Principal?.FindFirst("sub")?.Value}");
                    return Task.CompletedTask;
                },
                OnMessageReceived = context =>
                {
                    var token = context.Request.Headers["Authorization"].ToString();
                    if (!string.IsNullOrEmpty(token))
                    {
                        Console.WriteLine($"📩 Received token: {token.Substring(0, Math.Min(50, token.Length))}...");
                    }
                    return Task.CompletedTask;
                }
            };
        }
    });

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// DB TEST (sadece development'ta verbose log)
if (app.Environment.IsDevelopment())
{
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<SagaDbContext>();
        try
        {
            if (db.Database.CanConnect())
            {
                Console.WriteLine("✅✅✅ BAŞARILI: Saga Veritabanına Bağlanıldı! ✅✅✅");

                // ENUM FIX: 'dizi' değeri eksikse ekle
                try
                {
                    db.Database.ExecuteSqlRaw(@"
                        DO $$
                        BEGIN
                            IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'icerik_turu' AND e.enumlabel = 'dizi') THEN
                                ALTER TYPE icerik_turu ADD VALUE 'dizi';
                            END IF;
                        END$$;");
                    Console.WriteLine("✅ ENUM FIX: icerik_turu 'dizi' değeri doğrulandı.");
                }
                catch (Exception enumEx)
                {
                    Console.WriteLine($"⚠️ ENUM FIX Hatası: {enumEx.Message}");
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌❌❌ DB Hatası: {ex.Message}");
        }
    }
}

app.UseDefaultFiles();
app.UseStaticFiles();

// Global exception handling
app.UseMiddleware<ExceptionHandlingMiddleware>();

// Swagger sadece development'ta aktif
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("ReactAppPolicy");
app.UseRateLimiter();
app.UseResponseCaching();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Health Check Endpoint
app.MapHealthChecks("/health");

// SPA fallback disabled for API-only testing
// app.MapFallbackToFile("/index.html");

app.Run();