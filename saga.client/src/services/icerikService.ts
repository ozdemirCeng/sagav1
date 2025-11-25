import api from './api';

// Backend'den gelen veri tipleri
export interface Icerik {
    id: number;
    baslik: string;
    tur: 'film' | 'kitap';
    aciklama?: string | null;
    posterUrl: string | null;
    ortalamaPuan: number;
    populerlikSkoru?: number;
    yayinTarihi?: string;
}

export interface IcerikDetay extends Icerik {
    aciklama: string | null;
    yonetmen?: string;
    oyuncular?: string[];
    kullaniciPuani?: number; // Kullanıcının verdiği puan
    kullanicininDurumu?: string; // izlendi/okundu vs.
}

export const icerikService = {
    // Tüm içerikleri getir (Keşfet sayfası için)
    getAll: async (page = 1, limit = 20) => {
        const response = await api.get<Icerik[]>('/icerikler', {
            params: { page, limit }
        });
        return response.data;
    },

    // Popüler içerikleri getir (Ana sayfa vitrini için)
    getPopular: async () => {
        const response = await api.get<Icerik[]>('/icerik/populer');
        return response.data;
    },

    // İçerik detayını getir
    getById: async (id: string) => {
        const response = await api.get<IcerikDetay>(`/icerik/${id}`);
        return response.data;
    },

    // Arama yap
    search: async (query: string) => {
        const response = await api.get<Icerik[]>('/icerik/ara', {
            params: { q: query }
        });
        return response.data;
    },

    // Filtreli arama
    filter: async (params: {
        tur?: 'film' | 'kitap';
        turler?: string[]; // Film türleri veya kitap kategorileri
        minPuan?: number;
        maxPuan?: number;
        yil?: number;
        minYil?: number;
        maxYil?: number;
        page?: number;
        limit?: number;
    }) => {
        const response = await api.get<{ items: Icerik[]; toplam: number }>('/icerik/filtrele', { params });
        return response.data;
    },

    // En yüksek puanlılar
    getTopRated: async (params?: { tur?: 'film' | 'kitap'; limit?: number }) => {
        const response = await api.get<Icerik[]>('/icerik/en-yuksek-puanlilar', { params });
        return response.data;
    },

    // Yeni içerikler
    getRecent: async (params?: { tur?: 'film' | 'kitap'; limit?: number }) => {
        const response = await api.get<Icerik[]>('/icerik/yeni', { params });
        return response.data;
    },

    // Önerilen içerikler (login gerekli)
    getRecommended: async (params?: { limit?: number }) => {
        const response = await api.get<Icerik[]>('/icerik/onerilenler', { params });
        return response.data;
    }
};