# Saga 📚🎬

<div align="center">

![Saga Logo](https://img.shields.io/badge/Saga-Film%20%26%20Kitap%20Platformu-gold?style=for-the-badge)

**Kişisel film ve kitap kütüphanenizi oluşturun, içerikleri puanlayın ve sosyal akışta paylaşın.**

[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![.NET](https://img.shields.io/badge/.NET-8-512BD4?style=flat-square&logo=dotnet)](https://dotnet.microsoft.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?style=flat-square&logo=postgresql)](https://supabase.com/)

</div>

---

## 📖 Hakkında

Saga, kullanıcıların kişisel film ve kitap kütüphanelerini oluşturabildiği, içerikleri puanlayıp yorumlayabildiği ve sosyal akış üzerinden aktivitelerini paylaşabildiği modern bir web platformudur.

## ✨ Özellikler

### 🎬 İçerik Yönetimi
- **Film & Dizi Takibi** - TMDB entegrasyonu ile geniş film ve dizi veritabanı
- **Kitap Takibi** - Google Books entegrasyonu ile milyonlarca kitaba erişim
- **Akıllı Arama** - Türkçe ve uluslararası içeriklerde arama

### ⭐ Değerlendirme Sistemi
- 10 üzerinden puanlama
- Detaylı yorumlar yazma
- Spoiler uyarısı desteği
- Yorum beğenme ve yanıtlama

### 📋 Kütüphane & Listeler
- İzlendi / İzlenecek / İzleniyor durumları
- Okundu / Okunacak / Okunuyor durumları
- Özel listeler oluşturma ve paylaşma
- Kütüphaneden içerik çıkarma

### 👥 Sosyal Özellikler
- Kullanıcı takip sistemi
- Sosyal akış (feed) - takip edilenlerin aktiviteleri
- Aktivite beğenme ve yorumlama
- Profil özelleştirme (avatar, biyografi)

### 🔔 Bildirimler
- Beğeni bildirimleri
- Yorum bildirimleri
- Takip bildirimleri
- Okundu olarak işaretleme

## 🛠️ Teknolojiler

### Frontend
| Teknoloji | Açıklama |
|-----------|----------|
| React 18 | UI kütüphanesi |
| TypeScript | Tip güvenliği |
| Vite | Build tool |
| TailwindCSS | Utility-first CSS |

### Backend
| Teknoloji | Açıklama |
|-----------|----------|
| ASP.NET Core 8 | Web API framework |
| Entity Framework Core | ORM |
| PostgreSQL | Veritabanı (Supabase) |

### Entegrasyonlar
| Servis | Kullanım |
|--------|----------|
| TMDB API | Film ve dizi verileri |
| Google Books API | Kitap verileri |
| Supabase Auth | Kimlik doğrulama |
| Supabase Storage | Dosya depolama (avatarlar) |
| Groq API | AI metin üretimi |
| HuggingFace Spaces | Semantic search (saga-semantic) |

## 🚀 Kurulum

### Gereksinimler
- Node.js 18+
- .NET 8 SDK
- PostgreSQL veritabanı (veya Supabase hesabı)

### Frontend Kurulumu
```bash
cd saga.client
cp .env.example .env  # .env dosyasını oluştur ve düzenle
npm install
npm run dev
```

### Backend Kurulumu
```bash
cd Saga.Server
# appsettings.Development.json dosyasını oluştur ve düzenle
dotnet restore
dotnet run
```

### AI Servisi (HuggingFace Spaces)
```bash
cd saga-semantic
# HuggingFace Spaces'e deploy et
# Secrets'ta GROQ_API_KEY ayarla
```

### Ortam Değişkenleri

**Frontend** (`saga.client/.env`):
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_URL=https://your-backend-url.com/api  # Production için
```

**Backend** (`Saga.Server/appsettings.Development.json`):
Tüm yapılandırma seçenekleri için `.env.example` dosyasına bakın.

## 📸 Ekran Görüntüleri

<details>
<summary>Ekran görüntülerini görmek için tıklayın</summary>

### Ana Sayfa (Feed)
Takip ettiğiniz kullanıcıların aktivitelerini görün.

### Keşfet
Trend filmler, popüler kitaplar ve önerilen içerikleri keşfedin.

### Detay Sayfası
İçerik hakkında detaylı bilgi, puanlama ve yorumlar.

### Kütüphane
Kişisel film ve kitap koleksiyonunuz.

### Profil
Kullanıcı profili, aktiviteler ve istatistikler.

</details>

## 📁 Proje Yapısı

```
Saga/
├── saga.client/                 # React Frontend
│   ├── src/
│   │   ├── components/         # UI bileşenleri
│   │   │   ├── layout/         # Layout bileşenleri
│   │   │   ├── modals/         # Modal bileşenleri
│   │   │   └── ui/             # Temel UI bileşenleri
│   │   ├── pages/glass/        # Sayfa bileşenleri
│   │   ├── services/           # API servisleri ve cache
│   │   ├── context/            # React Context'ler
│   │   └── styles/             # Global stiller
│   └── public/                 # Statik dosyalar
│
├── Saga.Server/                # ASP.NET Core Backend
│   ├── Controllers/            # API endpoint'leri
│   ├── Models/                 # Veritabanı modelleri
│   ├── DTOs/                   # Data Transfer Objects
│   ├── Services/               # İş mantığı servisleri
│   ├── Data/                   # DbContext
│   └── Migrations/             # EF Core migration'ları
│
└── saga-semantic/              # AI Microservice (HuggingFace)
    └── app.py                  # FastAPI + Groq + Semantic Search
```

## 🎨 Tasarım

- **Glass Morphism** - Modern cam efekti tasarımı
- **Karanlık Tema** - Göz yormayan koyu renk paleti
- **Altın Vurgular** - Zarif altın rengi aksanlar
- **Responsive** - Mobil uyumlu tasarım

## 👥 Katkıda Bulunma

1. Bu repoyu fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add amazing feature'`)
4. Branch'inizi push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

## 📄 Lisans

Bu proje eğitim amaçlı geliştirilmiştir.

---

<div align="center">

**[⬆ Yukarı](#saga-)**

Made with ❤️ by [ozdemirCeng](https://github.com/ozdemirCeng) and onurakbas

</div>

