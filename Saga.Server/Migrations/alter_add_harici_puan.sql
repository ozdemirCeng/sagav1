-- =====================================================
-- Harici Puan (TMDB/IMDB) kolonu ekleme
-- =====================================================

-- 1. Harici puan kolonunu ekle (TMDB/IMDB puanı)
ALTER TABLE icerikler 
ADD COLUMN IF NOT EXISTS harici_puan DECIMAL(3,1) DEFAULT 0;

-- 2. Harici oy sayısını ekle
ALTER TABLE icerikler 
ADD COLUMN IF NOT EXISTS harici_oy_sayisi INTEGER DEFAULT 0;

-- 3. Yorum: Şimdi iki farklı puan var:
--    - harici_puan: TMDB/IMDB'den gelen orijinal puan (0-10)
--    - ortalama_puan: Platform kullanıcılarının verdiği puan ortalaması (0-10)

-- 4. Index ekle (yıl bazlı filtreleme için)
CREATE INDEX IF NOT EXISTS idx_icerikler_yayin_yili 
ON icerikler (EXTRACT(YEAR FROM yayin_tarihi));

-- 5. Harici puan index'i
CREATE INDEX IF NOT EXISTS idx_icerikler_harici_puan 
ON icerikler (harici_puan DESC) WHERE silindi = false;

-- =====================================================
-- KULLANIM:
-- psql -U postgres -d saga_db -f alter_add_harici_puan.sql
-- VEYA pgAdmin'de çalıştır
-- =====================================================
