-- ============================================
-- SAGA PLATFORM - INSTAGRAM SEVİYESİ GÜNCELLEME
-- ============================================
-- Bu SQL dosyasını Supabase SQL Editor'de çalıştırın
-- Tarih: 2025-11-26
-- ============================================

BEGIN;

-- ============================================
-- 1. AKTİVİTE BEĞENİLERİ TABLOSU (Feed'deki aktivitelere beğeni)
-- ============================================
CREATE TABLE IF NOT EXISTS aktivite_begenileri (
    kullanici_id UUID NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
    aktivite_id BIGINT NOT NULL REFERENCES aktiviteler(id) ON DELETE CASCADE,
    olusturulma_zamani TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (kullanici_id, aktivite_id)
);

-- Aktivitelere beğeni sayısı kolonu ekle
ALTER TABLE aktiviteler ADD COLUMN IF NOT EXISTS begeni_sayisi INTEGER NOT NULL DEFAULT 0;
ALTER TABLE aktiviteler ADD COLUMN IF NOT EXISTS yorum_sayisi INTEGER NOT NULL DEFAULT 0;

-- Index
CREATE INDEX IF NOT EXISTS idx_aktivite_begenileri_aktivite ON aktivite_begenileri(aktivite_id);

-- ============================================
-- 2. AKTİVİTE YORUMLARI TABLOSU (Feed'deki aktivitelere yorum)
-- ============================================
CREATE TABLE IF NOT EXISTS aktivite_yorumlari (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    aktivite_id BIGINT NOT NULL REFERENCES aktiviteler(id) ON DELETE CASCADE,
    kullanici_id UUID NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
    icerik TEXT NOT NULL,
    ust_yorum_id BIGINT REFERENCES aktivite_yorumlari(id) ON DELETE CASCADE,
    begeni_sayisi INTEGER NOT NULL DEFAULT 0,
    silindi BOOLEAN NOT NULL DEFAULT FALSE,
    olusturulma_zamani TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    guncelleme_zamani TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_aktivite_yorumlari_aktivite ON aktivite_yorumlari(aktivite_id);
CREATE INDEX IF NOT EXISTS idx_aktivite_yorumlari_kullanici ON aktivite_yorumlari(kullanici_id);
CREATE INDEX IF NOT EXISTS idx_aktivite_yorumlari_ust ON aktivite_yorumlari(ust_yorum_id);

-- ============================================
-- 3. AKTİVİTE YORUM BEĞENİLERİ
-- ============================================
CREATE TABLE IF NOT EXISTS aktivite_yorum_begenileri (
    kullanici_id UUID NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
    yorum_id BIGINT NOT NULL REFERENCES aktivite_yorumlari(id) ON DELETE CASCADE,
    olusturulma_zamani TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (kullanici_id, yorum_id)
);

-- ============================================
-- 4. KULLANICI AYARLARI TABLOSU
-- ============================================
CREATE TABLE IF NOT EXISTS kullanici_ayarlari (
    kullanici_id UUID PRIMARY KEY REFERENCES kullanicilar(id) ON DELETE CASCADE,
    bildirim_yeni_takipci BOOLEAN NOT NULL DEFAULT TRUE,
    bildirim_yorumlar BOOLEAN NOT NULL DEFAULT TRUE,
    bildirim_begeniler BOOLEAN NOT NULL DEFAULT TRUE,
    bildirim_oneriler BOOLEAN NOT NULL DEFAULT FALSE,
    bildirim_email BOOLEAN NOT NULL DEFAULT FALSE,
    profil_gizli BOOLEAN NOT NULL DEFAULT FALSE,
    aktivite_gizli BOOLEAN NOT NULL DEFAULT FALSE,
    tema VARCHAR(20) NOT NULL DEFAULT 'sistem',
    dil VARCHAR(10) NOT NULL DEFAULT 'tr',
    olusturulma_zamani TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    guncelleme_zamani TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 5. ENGELLENEN KULLANICILAR
-- ============================================
CREATE TABLE IF NOT EXISTS engellenenler (
    engelleyen_id UUID NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
    engellenen_id UUID NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
    olusturulma_zamani TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (engelleyen_id, engellenen_id),
    CONSTRAINT chk_kendi_kendini_engelleme CHECK (engelleyen_id != engellenen_id)
);

-- ============================================
-- 6. KAYITLI ARAMALAR (Arama geçmişi)
-- ============================================
CREATE TABLE IF NOT EXISTS arama_gecmisi (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kullanici_id UUID NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
    arama_terimi VARCHAR(255) NOT NULL,
    arama_tipi VARCHAR(50) NOT NULL DEFAULT 'genel', -- 'genel', 'film', 'kitap', 'kullanici'
    sonuc_sayisi INTEGER NOT NULL DEFAULT 0,
    olusturulma_zamani TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arama_gecmisi_kullanici ON arama_gecmisi(kullanici_id, olusturulma_zamani DESC);

-- ============================================
-- 7. İÇERİK GÖRÜNTÜLEMELERİ (Görüntüleme takibi)
-- ============================================
CREATE TABLE IF NOT EXISTS icerik_goruntulemeler (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kullanici_id UUID REFERENCES kullanicilar(id) ON DELETE SET NULL,
    icerik_id BIGINT NOT NULL REFERENCES icerikler(id) ON DELETE CASCADE,
    ip_adresi INET,
    user_agent TEXT,
    olusturulma_zamani TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goruntulemeler_icerik ON icerik_goruntulemeler(icerik_id, olusturulma_zamani DESC);
CREATE INDEX IF NOT EXISTS idx_goruntulemeler_kullanici ON icerik_goruntulemeler(kullanici_id) WHERE kullanici_id IS NOT NULL;

-- ============================================
-- 8. HASHTAG/ETİKET SİSTEMİ
-- ============================================
CREATE TABLE IF NOT EXISTS etiketler (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ad VARCHAR(100) NOT NULL UNIQUE,
    kullanim_sayisi INTEGER NOT NULL DEFAULT 0,
    olusturulma_zamani TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS icerik_etiketleri (
    icerik_id BIGINT NOT NULL REFERENCES icerikler(id) ON DELETE CASCADE,
    etiket_id BIGINT NOT NULL REFERENCES etiketler(id) ON DELETE CASCADE,
    olusturulma_zamani TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (icerik_id, etiket_id)
);

CREATE TABLE IF NOT EXISTS liste_etiketleri (
    liste_id BIGINT NOT NULL REFERENCES listeler(id) ON DELETE CASCADE,
    etiket_id BIGINT NOT NULL REFERENCES etiketler(id) ON DELETE CASCADE,
    olusturulma_zamani TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (liste_id, etiket_id)
);

CREATE INDEX IF NOT EXISTS idx_etiketler_ad ON etiketler(lower(ad));
CREATE INDEX IF NOT EXISTS idx_etiketler_populer ON etiketler(kullanim_sayisi DESC);

-- ============================================
-- 9. PAYLAŞIM/REPOST SİSTEMİ
-- ============================================
CREATE TABLE IF NOT EXISTS paylasimlar (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kullanici_id UUID NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
    aktivite_id BIGINT NOT NULL REFERENCES aktiviteler(id) ON DELETE CASCADE,
    not_metni TEXT,
    olusturulma_zamani TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (kullanici_id, aktivite_id)
);

-- Aktivitelere paylaşım sayısı
ALTER TABLE aktiviteler ADD COLUMN IF NOT EXISTS paylasim_sayisi INTEGER NOT NULL DEFAULT 0;

-- ============================================
-- 10. KULLANICILAR TABLOSU GÜNCELLEMELERİ
-- ============================================
-- Web sitesi, konum, doğum tarihi
ALTER TABLE kullanicilar ADD COLUMN IF NOT EXISTS web_sitesi VARCHAR(255);
ALTER TABLE kullanicilar ADD COLUMN IF NOT EXISTS konum VARCHAR(100);
ALTER TABLE kullanicilar ADD COLUMN IF NOT EXISTS dogum_tarihi DATE;
ALTER TABLE kullanicilar ADD COLUMN IF NOT EXISTS cinsiyet VARCHAR(20);
ALTER TABLE kullanicilar ADD COLUMN IF NOT EXISTS kapak_resmi_url TEXT;

-- İstatistik kolonları (cache)
ALTER TABLE kullanicilar ADD COLUMN IF NOT EXISTS takipci_sayisi INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kullanicilar ADD COLUMN IF NOT EXISTS takip_edilen_sayisi INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kullanicilar ADD COLUMN IF NOT EXISTS toplam_puan INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kullanicilar ADD COLUMN IF NOT EXISTS toplam_yorum INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kullanicilar ADD COLUMN IF NOT EXISTS toplam_liste INTEGER NOT NULL DEFAULT 0;

-- ============================================
-- 11. BİLDİRİM TİPLERİ GENİŞLETME
-- ============================================
-- Bildirim tablosuna ekstra alanlar
ALTER TABLE bildirimler ADD COLUMN IF NOT EXISTS icerik_id BIGINT REFERENCES icerikler(id) ON DELETE SET NULL;
ALTER TABLE bildirimler ADD COLUMN IF NOT EXISTS aktivite_id BIGINT REFERENCES aktiviteler(id) ON DELETE SET NULL;
ALTER TABLE bildirimler ADD COLUMN IF NOT EXISTS yorum_id BIGINT REFERENCES yorumlar(id) ON DELETE SET NULL;
ALTER TABLE bildirimler ADD COLUMN IF NOT EXISTS meta_veri JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ============================================
-- 12. FAVORI LİSTELER (Kullanıcının kaydettiği başkalarının listeleri)
-- ============================================
CREATE TABLE IF NOT EXISTS favori_listeler (
    kullanici_id UUID NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
    liste_id BIGINT NOT NULL REFERENCES listeler(id) ON DELETE CASCADE,
    olusturulma_zamani TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (kullanici_id, liste_id)
);

-- Listelere favori sayısı
ALTER TABLE listeler ADD COLUMN IF NOT EXISTS favori_sayisi INTEGER NOT NULL DEFAULT 0;

-- ============================================
-- 13. İÇERİK FAVORİLERİ (Hızlı erişim için)
-- ============================================
CREATE TABLE IF NOT EXISTS icerik_favorileri (
    kullanici_id UUID NOT NULL REFERENCES kullanicilar(id) ON DELETE CASCADE,
    icerik_id BIGINT NOT NULL REFERENCES icerikler(id) ON DELETE CASCADE,
    olusturulma_zamani TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (kullanici_id, icerik_id)
);

-- İçeriklere favori sayısı
ALTER TABLE icerikler ADD COLUMN IF NOT EXISTS favori_sayisi INTEGER NOT NULL DEFAULT 0;

COMMIT;

-- ============================================
-- TRIGGER'LAR VE FONKSİYONLAR
-- ============================================

BEGIN;

-- ============================================
-- TRIGGER 1: Aktivite Beğeni Sayısı Güncelleme
-- ============================================
CREATE OR REPLACE FUNCTION aktivite_begeni_sayisi_guncelle() RETURNS TRIGGER AS $$
DECLARE
    v_aktivite_id BIGINT;
    v_yeni_sayi INTEGER;
BEGIN
    v_aktivite_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.aktivite_id ELSE NEW.aktivite_id END;
    
    SELECT COUNT(*) INTO v_yeni_sayi
    FROM aktivite_begenileri
    WHERE aktivite_id = v_aktivite_id;

    UPDATE aktiviteler
    SET begeni_sayisi = v_yeni_sayi
    WHERE id = v_aktivite_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_aktivite_begeni_stats ON aktivite_begenileri;
CREATE TRIGGER trg_aktivite_begeni_stats
    AFTER INSERT OR DELETE ON aktivite_begenileri
    FOR EACH ROW
    EXECUTE FUNCTION aktivite_begeni_sayisi_guncelle();

-- ============================================
-- TRIGGER 2: Aktivite Yorum Sayısı Güncelleme
-- ============================================
CREATE OR REPLACE FUNCTION aktivite_yorum_sayisi_guncelle() RETURNS TRIGGER AS $$
DECLARE
    v_aktivite_id BIGINT;
    v_yeni_sayi INTEGER;
BEGIN
    v_aktivite_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.aktivite_id ELSE NEW.aktivite_id END;
    
    SELECT COUNT(*) INTO v_yeni_sayi
    FROM aktivite_yorumlari
    WHERE aktivite_id = v_aktivite_id AND silindi = FALSE;

    UPDATE aktiviteler
    SET yorum_sayisi = v_yeni_sayi
    WHERE id = v_aktivite_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_aktivite_yorum_stats ON aktivite_yorumlari;
CREATE TRIGGER trg_aktivite_yorum_stats
    AFTER INSERT OR UPDATE OR DELETE ON aktivite_yorumlari
    FOR EACH ROW
    EXECUTE FUNCTION aktivite_yorum_sayisi_guncelle();

-- ============================================
-- TRIGGER 3: Aktivite Yorum Beğeni Sayısı
-- ============================================
CREATE OR REPLACE FUNCTION aktivite_yorum_begeni_guncelle() RETURNS TRIGGER AS $$
DECLARE
    v_yorum_id BIGINT;
    v_yeni_sayi INTEGER;
BEGIN
    v_yorum_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.yorum_id ELSE NEW.yorum_id END;
    
    SELECT COUNT(*) INTO v_yeni_sayi
    FROM aktivite_yorum_begenileri
    WHERE yorum_id = v_yorum_id;

    UPDATE aktivite_yorumlari
    SET begeni_sayisi = v_yeni_sayi
    WHERE id = v_yorum_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_aktivite_yorum_begeni_stats ON aktivite_yorum_begenileri;
CREATE TRIGGER trg_aktivite_yorum_begeni_stats
    AFTER INSERT OR DELETE ON aktivite_yorum_begenileri
    FOR EACH ROW
    EXECUTE FUNCTION aktivite_yorum_begeni_guncelle();

-- ============================================
-- TRIGGER 4: Takipçi Sayısı Cache Güncelleme
-- ============================================
CREATE OR REPLACE FUNCTION takip_sayilari_guncelle() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Takip eden kullanıcının takip edilen sayısını artır
        UPDATE kullanicilar SET takip_edilen_sayisi = takip_edilen_sayisi + 1 WHERE id = NEW.takip_eden_id;
        -- Takip edilen kullanıcının takipçi sayısını artır
        UPDATE kullanicilar SET takipci_sayisi = takipci_sayisi + 1 WHERE id = NEW.takip_edilen_id;
    ELSIF TG_OP = 'DELETE' THEN
        -- Takip eden kullanıcının takip edilen sayısını azalt
        UPDATE kullanicilar SET takip_edilen_sayisi = GREATEST(takip_edilen_sayisi - 1, 0) WHERE id = OLD.takip_eden_id;
        -- Takip edilen kullanıcının takipçi sayısını azalt
        UPDATE kullanicilar SET takipci_sayisi = GREATEST(takipci_sayisi - 1, 0) WHERE id = OLD.takip_edilen_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_takip_sayilari ON takipler;
CREATE TRIGGER trg_takip_sayilari
    AFTER INSERT OR DELETE ON takipler
    FOR EACH ROW
    EXECUTE FUNCTION takip_sayilari_guncelle();

-- ============================================
-- TRIGGER 5: Kullanıcı İstatistik Güncelleme (Puan, Yorum, Liste)
-- ============================================
CREATE OR REPLACE FUNCTION kullanici_puan_istatistik_guncelle() RETURNS TRIGGER AS $$
DECLARE
    v_kullanici_id UUID;
BEGIN
    v_kullanici_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.kullanici_id ELSE NEW.kullanici_id END;
    
    UPDATE kullanicilar 
    SET toplam_puan = (SELECT COUNT(*) FROM puanlamalar WHERE kullanici_id = v_kullanici_id AND silindi = FALSE)
    WHERE id = v_kullanici_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kullanici_puan_stats ON puanlamalar;
CREATE TRIGGER trg_kullanici_puan_stats
    AFTER INSERT OR UPDATE OR DELETE ON puanlamalar
    FOR EACH ROW
    EXECUTE FUNCTION kullanici_puan_istatistik_guncelle();

CREATE OR REPLACE FUNCTION kullanici_yorum_istatistik_guncelle() RETURNS TRIGGER AS $$
DECLARE
    v_kullanici_id UUID;
BEGIN
    v_kullanici_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.kullanici_id ELSE NEW.kullanici_id END;
    
    UPDATE kullanicilar 
    SET toplam_yorum = (SELECT COUNT(*) FROM yorumlar WHERE kullanici_id = v_kullanici_id AND silindi = FALSE)
    WHERE id = v_kullanici_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kullanici_yorum_stats ON yorumlar;
CREATE TRIGGER trg_kullanici_yorum_stats
    AFTER INSERT OR UPDATE OR DELETE ON yorumlar
    FOR EACH ROW
    EXECUTE FUNCTION kullanici_yorum_istatistik_guncelle();

CREATE OR REPLACE FUNCTION kullanici_liste_istatistik_guncelle() RETURNS TRIGGER AS $$
DECLARE
    v_kullanici_id UUID;
BEGIN
    v_kullanici_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.kullanici_id ELSE NEW.kullanici_id END;
    
    UPDATE kullanicilar 
    SET toplam_liste = (SELECT COUNT(*) FROM listeler WHERE kullanici_id = v_kullanici_id AND silindi = FALSE)
    WHERE id = v_kullanici_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kullanici_liste_stats ON listeler;
CREATE TRIGGER trg_kullanici_liste_stats
    AFTER INSERT OR UPDATE OR DELETE ON listeler
    FOR EACH ROW
    EXECUTE FUNCTION kullanici_liste_istatistik_guncelle();

-- ============================================
-- TRIGGER 6: Görüntüleme Sayısı Güncelleme
-- ============================================
CREATE OR REPLACE FUNCTION icerik_goruntuleme_sayisi_guncelle() RETURNS TRIGGER AS $$
BEGIN
    UPDATE icerikler 
    SET goruntuleme_sayisi = goruntuleme_sayisi + 1
    WHERE id = NEW.icerik_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_icerik_goruntuleme ON icerik_goruntulemeler;
CREATE TRIGGER trg_icerik_goruntuleme
    AFTER INSERT ON icerik_goruntulemeler
    FOR EACH ROW
    EXECUTE FUNCTION icerik_goruntuleme_sayisi_guncelle();

-- ============================================
-- TRIGGER 7: Etiket Kullanım Sayısı
-- ============================================
CREATE OR REPLACE FUNCTION etiket_kullanim_guncelle() RETURNS TRIGGER AS $$
DECLARE
    v_etiket_id BIGINT;
BEGIN
    v_etiket_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.etiket_id ELSE NEW.etiket_id END;
    
    UPDATE etiketler
    SET kullanim_sayisi = (
        SELECT COUNT(*) FROM icerik_etiketleri WHERE etiket_id = v_etiket_id
    ) + (
        SELECT COUNT(*) FROM liste_etiketleri WHERE etiket_id = v_etiket_id
    )
    WHERE id = v_etiket_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_icerik_etiket_stats ON icerik_etiketleri;
CREATE TRIGGER trg_icerik_etiket_stats
    AFTER INSERT OR DELETE ON icerik_etiketleri
    FOR EACH ROW
    EXECUTE FUNCTION etiket_kullanim_guncelle();

DROP TRIGGER IF EXISTS trg_liste_etiket_stats ON liste_etiketleri;
CREATE TRIGGER trg_liste_etiket_stats
    AFTER INSERT OR DELETE ON liste_etiketleri
    FOR EACH ROW
    EXECUTE FUNCTION etiket_kullanim_guncelle();

-- ============================================
-- TRIGGER 8: Favori Liste Sayısı
-- ============================================
CREATE OR REPLACE FUNCTION favori_liste_sayisi_guncelle() RETURNS TRIGGER AS $$
DECLARE
    v_liste_id BIGINT;
BEGIN
    v_liste_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.liste_id ELSE NEW.liste_id END;
    
    UPDATE listeler
    SET favori_sayisi = (SELECT COUNT(*) FROM favori_listeler WHERE liste_id = v_liste_id)
    WHERE id = v_liste_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_favori_liste_stats ON favori_listeler;
CREATE TRIGGER trg_favori_liste_stats
    AFTER INSERT OR DELETE ON favori_listeler
    FOR EACH ROW
    EXECUTE FUNCTION favori_liste_sayisi_guncelle();

-- ============================================
-- TRIGGER 9: İçerik Favori Sayısı
-- ============================================
CREATE OR REPLACE FUNCTION icerik_favori_sayisi_guncelle() RETURNS TRIGGER AS $$
DECLARE
    v_icerik_id BIGINT;
BEGIN
    v_icerik_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.icerik_id ELSE NEW.icerik_id END;
    
    UPDATE icerikler
    SET favori_sayisi = (SELECT COUNT(*) FROM icerik_favorileri WHERE icerik_id = v_icerik_id)
    WHERE id = v_icerik_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_icerik_favori_stats ON icerik_favorileri;
CREATE TRIGGER trg_icerik_favori_stats
    AFTER INSERT OR DELETE ON icerik_favorileri
    FOR EACH ROW
    EXECUTE FUNCTION icerik_favori_sayisi_guncelle();

-- ============================================
-- TRIGGER 10: Paylaşım Sayısı
-- ============================================
CREATE OR REPLACE FUNCTION paylasim_sayisi_guncelle() RETURNS TRIGGER AS $$
DECLARE
    v_aktivite_id BIGINT;
BEGIN
    v_aktivite_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.aktivite_id ELSE NEW.aktivite_id END;
    
    UPDATE aktiviteler
    SET paylasim_sayisi = (SELECT COUNT(*) FROM paylasimlar WHERE aktivite_id = v_aktivite_id)
    WHERE id = v_aktivite_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_paylasim_stats ON paylasimlar;
CREATE TRIGGER trg_paylasim_stats
    AFTER INSERT OR DELETE ON paylasimlar
    FOR EACH ROW
    EXECUTE FUNCTION paylasim_sayisi_guncelle();

-- ============================================
-- TRIGGER 11: Bildirim Oluşturma - Beğeni
-- ============================================
CREATE OR REPLACE FUNCTION bildirim_aktivite_begeni() RETURNS TRIGGER AS $$
DECLARE
    v_aktivite_sahibi UUID;
    v_begenen_adi VARCHAR;
BEGIN
    -- Aktivite sahibini bul
    SELECT kullanici_id INTO v_aktivite_sahibi FROM aktiviteler WHERE id = NEW.aktivite_id;
    
    -- Kendi aktivitesini beğendiyse bildirim gönderme
    IF v_aktivite_sahibi = NEW.kullanici_id THEN
        RETURN NEW;
    END IF;
    
    -- Beğenen kullanıcı adını al
    SELECT kullanici_adi INTO v_begenen_adi FROM kullanicilar WHERE id = NEW.kullanici_id;
    
    -- Bildirim oluştur
    INSERT INTO bildirimler (alici_id, gonderen_id, tip, baslik, mesaj, aktivite_id, meta_veri)
    VALUES (
        v_aktivite_sahibi,
        NEW.kullanici_id,
        'aktivite_begeni',
        'Yeni Beğeni',
        v_begenen_adi || ' aktivitenizi beğendi',
        NEW.aktivite_id,
        jsonb_build_object('begenen_id', NEW.kullanici_id)
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bildirim_aktivite_begeni ON aktivite_begenileri;
CREATE TRIGGER trg_bildirim_aktivite_begeni
    AFTER INSERT ON aktivite_begenileri
    FOR EACH ROW
    EXECUTE FUNCTION bildirim_aktivite_begeni();

-- ============================================
-- TRIGGER 12: Bildirim Oluşturma - Yorum
-- ============================================
CREATE OR REPLACE FUNCTION bildirim_aktivite_yorum() RETURNS TRIGGER AS $$
DECLARE
    v_aktivite_sahibi UUID;
    v_yorumcu_adi VARCHAR;
BEGIN
    -- Aktivite sahibini bul
    SELECT kullanici_id INTO v_aktivite_sahibi FROM aktiviteler WHERE id = NEW.aktivite_id;
    
    -- Kendi aktivitesine yorum yaptıysa bildirim gönderme
    IF v_aktivite_sahibi = NEW.kullanici_id THEN
        RETURN NEW;
    END IF;
    
    -- Yorumcu adını al
    SELECT kullanici_adi INTO v_yorumcu_adi FROM kullanicilar WHERE id = NEW.kullanici_id;
    
    -- Bildirim oluştur
    INSERT INTO bildirimler (alici_id, gonderen_id, tip, baslik, mesaj, aktivite_id, meta_veri)
    VALUES (
        v_aktivite_sahibi,
        NEW.kullanici_id,
        'aktivite_yorum',
        'Yeni Yorum',
        v_yorumcu_adi || ' aktivitenize yorum yaptı: ' || LEFT(NEW.icerik, 50),
        NEW.aktivite_id,
        jsonb_build_object('yorum_id', NEW.id, 'yorum_ozet', LEFT(NEW.icerik, 100))
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bildirim_aktivite_yorum ON aktivite_yorumlari;
CREATE TRIGGER trg_bildirim_aktivite_yorum
    AFTER INSERT ON aktivite_yorumlari
    FOR EACH ROW
    EXECUTE FUNCTION bildirim_aktivite_yorum();

-- ============================================
-- TRIGGER 13: Bildirim Oluşturma - Takip
-- ============================================
CREATE OR REPLACE FUNCTION bildirim_yeni_takip() RETURNS TRIGGER AS $$
DECLARE
    v_takipci_adi VARCHAR;
BEGIN
    SELECT kullanici_adi INTO v_takipci_adi FROM kullanicilar WHERE id = NEW.takip_eden_id;
    
    INSERT INTO bildirimler (alici_id, gonderen_id, tip, baslik, mesaj, meta_veri)
    VALUES (
        NEW.takip_edilen_id,
        NEW.takip_eden_id,
        'yeni_takipci',
        'Yeni Takipçi',
        v_takipci_adi || ' sizi takip etmeye başladı',
        jsonb_build_object('takipci_id', NEW.takip_eden_id)
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bildirim_yeni_takip ON takipler;
CREATE TRIGGER trg_bildirim_yeni_takip
    AFTER INSERT ON takipler
    FOR EACH ROW
    EXECUTE FUNCTION bildirim_yeni_takip();

COMMIT;

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLİTİKALARI
-- ============================================

BEGIN;

-- Aktivite Beğenileri
ALTER TABLE aktivite_begenileri ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read" ON aktivite_begenileri FOR SELECT USING (true);
CREATE POLICY "Owner Write" ON aktivite_begenileri FOR ALL USING (auth.uid() = kullanici_id);

-- Aktivite Yorumları
ALTER TABLE aktivite_yorumlari ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read" ON aktivite_yorumlari FOR SELECT USING (true);
CREATE POLICY "Owner Write" ON aktivite_yorumlari FOR ALL USING (auth.uid() = kullanici_id);

-- Aktivite Yorum Beğenileri
ALTER TABLE aktivite_yorum_begenileri ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read" ON aktivite_yorum_begenileri FOR SELECT USING (true);
CREATE POLICY "Owner Write" ON aktivite_yorum_begenileri FOR ALL USING (auth.uid() = kullanici_id);

-- Kullanıcı Ayarları
ALTER TABLE kullanici_ayarlari ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner Only" ON kullanici_ayarlari FOR ALL USING (auth.uid() = kullanici_id);

-- Engellenenler
ALTER TABLE engellenenler ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner Only" ON engellenenler FOR ALL USING (auth.uid() = engelleyen_id);

-- Arama Geçmişi
ALTER TABLE arama_gecmisi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner Only" ON arama_gecmisi FOR ALL USING (auth.uid() = kullanici_id);

-- Paylaşımlar
ALTER TABLE paylasimlar ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read" ON paylasimlar FOR SELECT USING (true);
CREATE POLICY "Owner Write" ON paylasimlar FOR ALL USING (auth.uid() = kullanici_id);

-- Favori Listeler
ALTER TABLE favori_listeler ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read" ON favori_listeler FOR SELECT USING (true);
CREATE POLICY "Owner Write" ON favori_listeler FOR ALL USING (auth.uid() = kullanici_id);

-- İçerik Favorileri
ALTER TABLE icerik_favorileri ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read" ON icerik_favorileri FOR SELECT USING (true);
CREATE POLICY "Owner Write" ON icerik_favorileri FOR ALL USING (auth.uid() = kullanici_id);

-- Etiketler (Herkes okuyabilir)
ALTER TABLE etiketler ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read" ON etiketler FOR SELECT USING (true);

-- İçerik Görüntülemeleri (Sadece insert)
ALTER TABLE icerik_goruntulemeler ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Insert Only" ON icerik_goruntulemeler FOR INSERT WITH CHECK (true);

-- Aktiviteler RLS güncelleme
DROP POLICY IF EXISTS "Public Read" ON aktiviteler;
CREATE POLICY "Public Read" ON aktiviteler FOR SELECT USING (silindi = FALSE);
CREATE POLICY "Owner Delete" ON aktiviteler FOR DELETE USING (auth.uid() = kullanici_id);

-- Bildirimler RLS
ALTER TABLE bildirimler ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner Read" ON bildirimler FOR SELECT USING (auth.uid() = alici_id);
CREATE POLICY "Owner Update" ON bildirimler FOR UPDATE USING (auth.uid() = alici_id);

COMMIT;

-- ============================================
-- MEVCUT VERİLERİ SENKRONLA (Bir kez çalıştır)
-- ============================================

-- Takipçi sayılarını güncelle
UPDATE kullanicilar k SET 
    takipci_sayisi = (SELECT COUNT(*) FROM takipler WHERE takip_edilen_id = k.id),
    takip_edilen_sayisi = (SELECT COUNT(*) FROM takipler WHERE takip_eden_id = k.id),
    toplam_puan = (SELECT COUNT(*) FROM puanlamalar WHERE kullanici_id = k.id AND silindi = FALSE),
    toplam_yorum = (SELECT COUNT(*) FROM yorumlar WHERE kullanici_id = k.id AND silindi = FALSE),
    toplam_liste = (SELECT COUNT(*) FROM listeler WHERE kullanici_id = k.id AND silindi = FALSE);

-- Her kullanıcı için default ayarlar oluştur
INSERT INTO kullanici_ayarlari (kullanici_id)
SELECT id FROM kullanicilar
WHERE id NOT IN (SELECT kullanici_id FROM kullanici_ayarlari)
ON CONFLICT DO NOTHING;

-- ============================================
-- INDEXLER (Performans için)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_bildirimler_alici ON bildirimler(alici_id, okundu, olusturulma_zamani DESC);
CREATE INDEX IF NOT EXISTS idx_aktiviteler_olusturulma ON aktiviteler(olusturulma_zamani DESC) WHERE silindi = FALSE;
CREATE INDEX IF NOT EXISTS idx_kullanicilar_kullanici_adi ON kullanicilar(lower(kullanici_adi));
CREATE INDEX IF NOT EXISTS idx_takipler_takip_edilen ON takipler(takip_edilen_id);
CREATE INDEX IF NOT EXISTS idx_takipler_takip_eden ON takipler(takip_eden_id);

-- ============================================
-- TAMAMLANDI
-- ============================================
-- Bu SQL'i Supabase SQL Editor'de çalıştırdıktan sonra
-- Backend'deki Entity Framework modellerini güncellemeniz gerekecek.
