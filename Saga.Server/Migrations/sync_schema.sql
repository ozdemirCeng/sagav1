-- Saga Veritabanı Şema Senkronizasyonu
-- Bu script eksik tüm sütunları ekler

-- ===== icerikler tablosu =====
ALTER TABLE icerikler 
ADD COLUMN IF NOT EXISTS harici_puan DECIMAL(3,1) DEFAULT 0;

ALTER TABLE icerikler 
ADD COLUMN IF NOT EXISTS harici_oy_sayisi INTEGER DEFAULT 0;

ALTER TABLE icerikler 
ADD COLUMN IF NOT EXISTS listeye_eklenme_sayisi INTEGER DEFAULT 0;

ALTER TABLE icerikler 
ADD COLUMN IF NOT EXISTS goruntuleme_sayisi INTEGER DEFAULT 0;

ALTER TABLE icerikler 
ADD COLUMN IF NOT EXISTS populerlik_skoru DECIMAL DEFAULT 0;

-- ===== kullanicilar tablosu =====
ALTER TABLE kullanicilar 
ADD COLUMN IF NOT EXISTS cinsiyet VARCHAR(50);

ALTER TABLE kullanicilar 
ADD COLUMN IF NOT EXISTS dogum_tarihi TIMESTAMP;

ALTER TABLE kullanicilar 
ADD COLUMN IF NOT EXISTS konum VARCHAR(255);

ALTER TABLE kullanicilar 
ADD COLUMN IF NOT EXISTS web_sitesi VARCHAR(500);

ALTER TABLE kullanicilar 
ADD COLUMN IF NOT EXISTS kapak_resmi_url VARCHAR(500);

ALTER TABLE kullanicilar 
ADD COLUMN IF NOT EXISTS takipci_sayisi INTEGER DEFAULT 0;

ALTER TABLE kullanicilar 
ADD COLUMN IF NOT EXISTS takip_edilen_sayisi INTEGER DEFAULT 0;

ALTER TABLE kullanicilar 
ADD COLUMN IF NOT EXISTS toplam_puan INTEGER DEFAULT 0;

ALTER TABLE kullanicilar 
ADD COLUMN IF NOT EXISTS toplam_yorum INTEGER DEFAULT 0;

ALTER TABLE kullanicilar 
ADD COLUMN IF NOT EXISTS toplam_liste INTEGER DEFAULT 0;

ALTER TABLE kullanicilar 
ADD COLUMN IF NOT EXISTS giris_sayisi INTEGER DEFAULT 0;

-- ===== aktiviteler tablosu =====
ALTER TABLE aktiviteler 
ADD COLUMN IF NOT EXISTS begeni_sayisi INTEGER DEFAULT 0;

ALTER TABLE aktiviteler 
ADD COLUMN IF NOT EXISTS yorum_sayisi INTEGER DEFAULT 0;

ALTER TABLE aktiviteler 
ADD COLUMN IF NOT EXISTS paylasim_sayisi INTEGER DEFAULT 0;

ALTER TABLE aktiviteler 
ADD COLUMN IF NOT EXISTS silindi BOOLEAN DEFAULT FALSE;

-- ===== kullanici_ayarlari tablosu =====
ALTER TABLE kullanici_ayarlari 
ADD COLUMN IF NOT EXISTS profil_gizli BOOLEAN DEFAULT FALSE;

ALTER TABLE kullanici_ayarlari 
ADD COLUMN IF NOT EXISTS aktivite_gizli BOOLEAN DEFAULT FALSE;

-- Başarıyla tamamlandı mesajı
SELECT 'Şema senkronizasyonu tamamlandı!' as mesaj;

