import api from './api';

// Types
export interface KutuphaneDurumCreateDto {
  icerikId: number;
  durum: 'izlendi' | 'izlenecek' | 'okundu' | 'okunacak' | 'devam_ediyor';
  ilerleme?: number;
  baslangicTarihi?: string;
  bitisTarihi?: string;
}

export interface KutuphaneDurumUpdateDto {
  durum: 'izlendi' | 'izlenecek' | 'okundu' | 'okunacak' | 'devam_ediyor';
  ilerleme: number;
  baslangicTarihi?: string;
  bitisTarihi?: string;
}

export interface KutuphaneDurumDto {
  id: number;
  kullaniciId: string;
  icerikId: number;
  icerikBaslik: string;
  icerikTur: string;
  posterUrl?: string;
  durum: string;
  ilerleme: number;
  baslangicTarihi?: string;
  bitisTarihi?: string;
  olusturulmaZamani: string;
  guncellemeZamani: string;
}

export interface KutuphaneListDto {
  icerikId: number;
  baslik: string;
  tur: string;
  posterUrl?: string;
  ortalamaPuan: number;
  durum: string;
  ilerleme: number;
  guncellemeZamani: string;
}

export interface KutuphaneIstatistikDto {
  kullaniciId: string;
  toplamFilm: number;
  izlenenFilm: number;
  izlenecekFilm: number;
  devamEdenFilm: number;
  toplamKitap: number;
  okunanKitap: number;
  okunacakKitap: number;
  devamEdenKitap: number;
}

// API Functions
export const kutuphaneService = {
  // Kütüphaneye içerik ekle/durum güncelle
  createOrUpdate: async (data: KutuphaneDurumCreateDto): Promise<KutuphaneDurumDto> => {
    const response = await api.post('/kutuphane', data);
    return response.data;
  },

  // Belirli bir içeriğin durumunu güncelle
  update: async (icerikId: number, data: KutuphaneDurumUpdateDto): Promise<KutuphaneDurumDto> => {
    const response = await api.put(`/kutuphane/${icerikId}`, data);
    return response.data;
  },

  // Kütüphaneden içerik sil
  remove: async (icerikId: number): Promise<void> => {
    await api.delete(`/kutuphane/${icerikId}`);
  },

  // Belirli bir içeriğin kütüphane durumunu getir
  getByIcerik: async (icerikId: number): Promise<KutuphaneDurumDto | null> => {
    try {
      const response = await api.get(`/kutuphane/icerik/${icerikId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  // Kullanıcının kütüphanesini getir (filtrelenmiş)
  getMyLibrary: async (params?: {
    durum?: string;
    tur?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: KutuphaneListDto[]; toplam: number }> => {
    const response = await api.get('/kutuphane', { params });
    return response.data;
  },

  // Belirli bir kullanıcının kütüphanesini getir
  getUserLibrary: async (
    kullaniciId: string,
    params?: {
      durum?: string;
      tur?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{ items: KutuphaneListDto[]; toplam: number }> => {
    const response = await api.get(`/kutuphane/kullanici/${kullaniciId}`, { params });
    return response.data;
  },

  // Kütüphane istatistikleri
  getMyStats: async (): Promise<KutuphaneIstatistikDto> => {
    const response = await api.get('/kutuphane/istatistikler');
    return response.data;
  },

  getUserStats: async (kullaniciId: string): Promise<KutuphaneIstatistikDto> => {
    const response = await api.get(`/kutuphane/kullanici/${kullaniciId}/istatistikler`);
    return response.data;
  },
};
