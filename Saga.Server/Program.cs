using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using Saga.Server.Data;
using Saga.Server.Models;
using Saga.Server.Services; // <--- TokenService buradan geliyor
using System.Text;

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

// 3. CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactAppPolicy", policy =>
    {
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader();
    });
});

// 4. AUTH
var key = Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"] ?? "saga_super_gizli_anahtar_32_karakter_olmali");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(key),
            ValidateIssuer = false,
            ValidateAudience = false
        };
    });

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// DB TEST
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<SagaDbContext>();
    try
    {
        if (db.Database.CanConnect())
            Console.WriteLine("✅✅✅ BAŞARILI: Saga Veritabanına Bağlanıldı! ✅✅✅");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"❌❌❌ DB Hatası: {ex.Message}");
    }
}

app.UseDefaultFiles();
app.UseStaticFiles();

app.UseSwagger();
app.UseSwaggerUI();

app.UseCors("ReactAppPolicy");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapFallbackToFile("/index.html");

app.Run();