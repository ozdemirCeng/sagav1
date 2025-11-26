import api from './api';

// Types
export interface ProfilDto {
  id: string;
  kullaniciAdi: string;
  eposta: string;
  goruntulemeAdi?: string;
  biyografi?: string;
  avatarUrl?: string;
  rol: string;
  olusturulmaZamani: string;
  toplamPuanlama: number;
  toplamYorum: number;
  toplamListe: number;
  takipEdenSayisi: number;
  takipEdilenSayisi: number;
  takipEdiyorMu: boolean;
}

export interface ProfilUpdateDto {
  goruntulemeAdi?: string;
  biyografi?: string;
  avatarUrl?: string;
}

export interface KullaniciListDto {
  id: string;
  kullaniciAdi: string;
  goruntulemeAdi?: string;
  avatarUrl?: string;
  takipEdenSayisi: number;
  toplamPuanlama: number;
}

export interface TakipDto {
  takipEdenId: string;
  takipEdenKullaniciAdi: string;
  takipEdenAvatar?: string;
  takipEdilenId: string;
  takipEdilenKullaniciAdi: string;
  takipEdilenAvatar?: string;
  olusturulmaZamani: string;
}

export interface KullaniciIstatistikDto {
  kullaniciId: string;
  toplamIzlenenFilm: number;
  toplamOkunanKitap: number;
  toplamPuanlama: number;
  toplamYorum: number;
  toplamListe: number;
  takipEdenSayisi: number;
  takipEdilenSayisi: number;
  ortalamaPuan: number;
}

// API Functions
export const kullaniciService = {
  // Kendi profilini getir
  getMyProfile: async (): Promise<ProfilDto> => {
    const response = await api.get('/kullanici/profil');
    return response.data;
  },

  // Kullanıcı adına göre profil getir
  getProfileByUsername: async (kullaniciAdi: string): Promise<ProfilDto> => {
    const response = await api.get(`/kullanici/username/${kullaniciAdi}`);
    return response.data;
  },

  // ID'ye göre profil getir
  getProfileById: async (kullaniciId: string): Promise<ProfilDto> => {
    const response = await api.get(`/kullanici/id/${kullaniciId}`);
    return response.data;
  },

  // Profili güncelle
  updateProfile: async (data: ProfilUpdateDto): Promise<ProfilDto> => {
    const response = await api.put('/kullanici/profil', data);
    return response.data;
  },

  // Kullanıcı ara
  search: async (query: string, params?: {
    page?: number;
    limit?: number;
  }): Promise<KullaniciListDto[]> => {
    const response = await api.get('/kullanici/ara', {
      params: { q: query, ...params },
    });
    return response.data;
  },

  // Kullanıcı istatistiklerini getir
  getStats: async (kullaniciId: string): Promise<KullaniciIstatistikDto> => {
    const response = await api.get(`/kullanici/${kullaniciId}/istatistik`);
    return response.data;
  },

  // Takip et
  follow: async (kullaniciId: string): Promise<TakipDto> => {
    const response = await api.post(`/kullanici/${kullaniciId}/takip`);
    return response.data;
  },

  // Takibi bırak
  unfollow: async (kullaniciId: string): Promise<void> => {
    await api.post(`/kullanici/${kullaniciId}/takip`); // Toggle endpoint
  },

  // Takipçileri getir
  getFollowers: async (
    kullaniciId: string,
    params?: { page?: number; limit?: number }
  ): Promise<KullaniciListDto[]> => {
    const response = await api.get(`/kullanici/${kullaniciId}/takip-edenler`, { params });
    return response.data;
  },

  // Takip edilenleri getir
  getFollowing: async (
    kullaniciId: string,
    params?: { page?: number; limit?: number }
  ): Promise<KullaniciListDto[]> => {
    const response = await api.get(`/kullanici/${kullaniciId}/takip-ettikleri`, { params });
    return response.data;
  },
};
