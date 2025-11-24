using Microsoft.EntityFrameworkCore;
using Saga.Server.Models;
using Npgsql; // Bu kütüphane şart!

namespace Saga.Server.Data
{
    public class SagaDbContext : DbContext
    {
        public SagaDbContext(DbContextOptions<SagaDbContext> options) : base(options)
        {
            // PostgreSQL tarih formatı sorunu için
            AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);
        }

        // Tüm Tabloların Tanımı
        public DbSet<Kullanici> Kullanicilar { get; set; }
        public DbSet<Icerik> Icerikler { get; set; }
        public DbSet<Aktivite> Aktiviteler { get; set; }
        public DbSet<Puanlama> Puanlamalar { get; set; }
        public DbSet<Yorum> Yorumlar { get; set; }
        public DbSet<Takip> Takipler { get; set; }
        public DbSet<Liste> Listeler { get; set; }
        public DbSet<ListeIcerigi> ListeIcerikleri { get; set; }
        public DbSet<YorumBegeni> YorumBegenileri { get; set; }
        public DbSet<KutuphaneDurumu> KutuphaneDurumlari { get; set; }
        public DbSet<Bildirim> Bildirimler { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // 1. COMPOSITE KEYS (Çoklu Anahtarlar)
            // Bu tabloların tek bir ID'si yok, iki kolon birleşip anahtar oluyor.
            modelBuilder.Entity<Takip>()
                .HasKey(t => new { t.TakipEdenId, t.TakipEdilenId });

            modelBuilder.Entity<ListeIcerigi>()
                .HasKey(li => new { li.ListeId, li.IcerikId });

            modelBuilder.Entity<YorumBegeni>()
                .HasKey(yb => new { yb.KullaniciId, yb.YorumId });

            // 2. JSONB AYARLARI
            // Bu kolonlar veritabanında JSON olarak saklanıyor
            modelBuilder.Entity<Icerik>()
                .Property(b => b.MetaVeri)
                .HasColumnType("jsonb");

            modelBuilder.Entity<Aktivite>()
                .Property(b => b.Veri)
                .HasColumnType("jsonb");

            // 3. ENUM AYARLARI (Hata almamak için string mapliyoruz)
            // SQL'de ENUM olsa bile C# tarafında string olarak çalışacağız.
            // Npgsql'in kafası karışmasın diye açıkça tip belirtiyoruz.

            modelBuilder.Entity<Icerik>(entity => {
                entity.Property(e => e.ApiKaynagi).HasColumnType("api_kaynak");
                entity.Property(e => e.Tur).HasColumnType("icerik_turu");
            });

            modelBuilder.Entity<Kullanici>(entity => {
                entity.Property(e => e.Rol).HasColumnType("kullanici_rol");
            });

            modelBuilder.Entity<Aktivite>(entity => {
                entity.Property(e => e.AktiviteTuru).HasColumnType("aktivite_turu");
            });

            modelBuilder.Entity<Liste>(entity => {
                entity.Property(e => e.Tur).HasColumnType("liste_turu");
            });

            modelBuilder.Entity<KutuphaneDurumu>(entity => {
                entity.Property(e => e.Durum).HasColumnType("kutuphane_durum");
            });

            // 4. İLİŞKİLER (Relationships)
            
            // Takip ilişkisi (self-referencing many-to-many)
            // TakipEden -> Takipler (kimin takip listesi)
            // TakipEdilen -> TakipEdenler (kimin takipçileri)
            modelBuilder.Entity<Kullanici>()
                .HasMany(k => k.Takipler)
                .WithOne(t => t.TakipEden)
                .HasForeignKey(t => t.TakipEdenId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Kullanici>()
                .HasMany(k => k.TakipEdenler)
                .WithOne(t => t.TakipEdilen)
                .HasForeignKey(t => t.TakipEdilenId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Aktivite>()
                .HasOne(a => a.Kullanici)
                .WithMany()
                .HasForeignKey(a => a.KullaniciId);

            modelBuilder.Entity<Yorum>()
                .HasOne(y => y.Kullanici)
                .WithMany()
                .HasForeignKey(y => y.KullaniciId);
        }
    }
}