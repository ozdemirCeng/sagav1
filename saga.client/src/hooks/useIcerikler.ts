import { useQuery } from '@tanstack/react-query';
import { icerikService } from '../services/icerikService';
import { yorumService } from '../services/yorumService';

// Popüler İçerikleri Getir
export const usePopularContent = () => {
    return useQuery({
        queryKey: ['icerik', 'populer'], // Cache anahtarı
        queryFn: icerikService.getPopular,
    });
};

// En Yüksek Puanlılar
export const useTopRatedContent = (tur?: 'film' | 'kitap') => {
    return useQuery({
        queryKey: ['icerik', 'top-rated', tur],
        queryFn: () => icerikService.getTopRated({ tur }),
    });
};

// Yeni İçerikler
export const useRecentContent = (tur?: 'film' | 'kitap') => {
    return useQuery({
        queryKey: ['icerik', 'recent', tur],
        queryFn: () => icerikService.getRecent({ tur }),
    });
};

// Önerilen İçerikler
export const useRecommendedContent = () => {
    return useQuery({
        queryKey: ['icerik', 'recommended'],
        queryFn: () => icerikService.getRecommended(),
    });
};

// Detay Getir
export const useContentDetail = (id: string | undefined) => {
    return useQuery({
        queryKey: ['icerik', 'detay', id],
        queryFn: () => icerikService.getById(id!),
        enabled: !!id, // ID yoksa istek atma
    });
};

// Arama Yap
export const useSearchContent = (query: string) => {
    return useQuery({
        queryKey: ['icerik', 'arama', query],
        queryFn: () => icerikService.search(query),
        enabled: query.length > 2, // 2 harften azsa arama yapma
    });
};

// Filtreli Arama
export const useFilteredContent = (filters: {
    tur?: 'film' | 'kitap';
    turler?: string[];
    minPuan?: number;
    maxPuan?: number;
    yil?: number;
    minYil?: number;
    maxYil?: number;
    page?: number;
    limit?: number;
}) => {
    return useQuery({
        queryKey: ['icerik', 'filter', filters],
        queryFn: () => icerikService.filter(filters),
        enabled: Object.keys(filters).length > 0,
    });
};

export const useContentComments = (icerikId: number) => {
    return useQuery({
        queryKey: ['yorumlar', icerikId],
        queryFn: () => yorumService.getByIcerik(icerikId),
        enabled: !!icerikId,
    });
};