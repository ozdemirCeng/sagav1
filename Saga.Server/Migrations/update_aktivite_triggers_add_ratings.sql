-- ============================================
-- SAGA PLATFORM - AKTİVİTE TRİGGER GÜNCELLEMESİ
-- TMDB (harici_puan) ve Platform (ortalama_puan) puanlarını dahil et
-- ============================================

BEGIN;

-- ============================================
-- 1. PUANLAMA AKTİVİTESİ TRİGGER - GÜNCELLE
-- ============================================
CREATE OR REPLACE FUNCTION aktivite_ekle_puanlama() RETURNS TRIGGER AS $$ 
BEGIN
    INSERT INTO aktiviteler (kullanici_id, aktivite_turu, icerik_id, puanlama_id, veri)
    SELECT NEW.kullanici_id, 'puanlama', NEW.icerik_id, NEW.id, 
           jsonb_build_object(
               'puan', NEW.puan, 
               'baslik', i.baslik, 
               'poster', i.poster_url, 
               'tur', i.tur,
               'hariciPuan', i.harici_puan,
               'ortalamaPuan', i.ortalama_puan,
               'yil', EXTRACT(YEAR FROM i.yayin_tarihi),
               'user', k.kullanici_adi, 
               'avatar', k.avatar_url
           )
    FROM icerikler i, kullanicilar k 
    WHERE i.id = NEW.icerik_id AND k.id = NEW.kullanici_id;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

-- ============================================
-- 2. YORUM AKTİVİTESİ TRİGGER - GÜNCELLE
-- ============================================
CREATE OR REPLACE FUNCTION aktivite_ekle_yorum() RETURNS TRIGGER AS $$ 
BEGIN
    INSERT INTO aktiviteler (kullanici_id, aktivite_turu, icerik_id, yorum_id, veri)
    SELECT NEW.kullanici_id, 'yorum', NEW.icerik_id, NEW.id, 
           jsonb_build_object(
               'ozet', LEFT(NEW.icerik, 150), 
               'baslik', i.baslik, 
               'poster', i.poster_url,
               'tur', i.tur,
               'hariciPuan', i.harici_puan,
               'ortalamaPuan', i.ortalama_puan,
               'yil', EXTRACT(YEAR FROM i.yayin_tarihi),
               'user', k.kullanici_adi, 
               'avatar', k.avatar_url
           )
    FROM icerikler i, kullanicilar k 
    WHERE i.id = NEW.icerik_id AND k.id = NEW.kullanici_id;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

-- ============================================
-- 3. LİSTE AKTİVİTESİ TRİGGER - GÜNCELLE (varsa)
-- ============================================
CREATE OR REPLACE FUNCTION aktivite_ekle_liste() RETURNS TRIGGER AS $$ 
BEGIN
    -- Sadece özel listeler için aktivite oluştur (izleme listesi, favoriler vb. hariç)
    IF EXISTS (
        SELECT 1 FROM listeler l 
        WHERE l.id = NEW.liste_id 
        AND l.tur = 'ozel'
    ) THEN
        INSERT INTO aktiviteler (kullanici_id, aktivite_turu, icerik_id, liste_id, veri)
        SELECT l.kullanici_id, 'listeye_ekleme', NEW.icerik_id, NEW.liste_id,
               jsonb_build_object(
                   'liste_adi', l.baslik,
                   'baslik', i.baslik,
                   'poster', i.poster_url,
                   'tur', i.tur,
                   'hariciPuan', i.harici_puan,
                   'ortalamaPuan', i.ortalama_puan,
                   'yil', EXTRACT(YEAR FROM i.yayin_tarihi),
                   'user', k.kullanici_adi,
                   'avatar', k.avatar_url
               )
        FROM listeler l, icerikler i, kullanicilar k
        WHERE l.id = NEW.liste_id 
          AND i.id = NEW.icerik_id
          AND k.id = l.kullanici_id;
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

-- ============================================
-- 4. KÜTÜPHANE (DURUM GÜNCELLEME) TRİGGER - GÜNCELLE
-- ============================================
CREATE OR REPLACE FUNCTION aktivite_ekle_kutuphane() RETURNS TRIGGER AS $$ 
BEGIN
    -- Sadece "izlendi/okundu" durumuna geçişte aktivite oluştur
    IF NEW.durum IN ('izlendi', 'okundu') AND (OLD IS NULL OR OLD.durum IS DISTINCT FROM NEW.durum) THEN
        INSERT INTO aktiviteler (kullanici_id, aktivite_turu, icerik_id, veri)
        SELECT NEW.kullanici_id, 'durum_guncelleme', NEW.icerik_id,
               jsonb_build_object(
                   'durum', NEW.durum,
                   'baslik', i.baslik,
                   'poster', i.poster_url,
                   'tur', i.tur,
                   'hariciPuan', i.harici_puan,
                   'ortalamaPuan', i.ortalama_puan,
                   'yil', EXTRACT(YEAR FROM i.yayin_tarihi),
                   'user', k.kullanici_adi,
                   'avatar', k.avatar_url
               )
        FROM icerikler i, kullanicilar k
        WHERE i.id = NEW.icerik_id AND k.id = NEW.kullanici_id;
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

COMMIT;

-- ============================================
-- NOT: Bu SQL'i Supabase SQL Editor'da çalıştırın
-- Mevcut trigger'lar güncellenir, yeni aktiviteler 
-- artık TMDB ve platform puanlarını içerecektir.
-- ============================================
