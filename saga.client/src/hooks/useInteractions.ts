import { useMutation, useQueryClient } from '@tanstack/react-query';
import { puanlamaService } from '../services/puanlamaService';
// HATA BURADAYDI, AŞAĞIDAKİ GİBİ 'type' EKLEYEREK DÜZELTİYORUZ:
import { yorumService, type YorumCreateDto } from '../services/yorumService';
import { notifications } from '@mantine/notifications';

export const useInteractions = () => {
    const queryClient = useQueryClient();

    // Puan Verme Hook'u
    const rateMutation = useMutation({
        mutationFn: async ({ icerikId, puan }: { icerikId: number; puan: number }) => {
            // Önce mevcut puanı kontrol et
            try {
                const existing = await puanlamaService.getMyRating(icerikId);
                // Varsa güncelle
                return await puanlamaService.updatePuan(existing.id, puan);
            } catch {
                // Yoksa yeni oluştur
                return await puanlamaService.addPuan(icerikId, puan);
            }
        },

        onSuccess: (_, variables) => {
            notifications.show({
                title: 'Başarılı',
                message: 'Puanınız kaydedildi!',
                color: 'green',
            });
            // İlgili içeriğin detay verisini yenile (puan güncellensin diye)
            queryClient.invalidateQueries({ queryKey: ['icerik', 'detay', String(variables.icerikId)] });
        },
        onError: (error: any) => {
            notifications.show({
                title: 'Hata',
                message: error.response?.data?.message || "Puan verilirken hata oluştu.",
                color: 'red',
            });
        }
    });

    // Yorum Yapma Hook'u
    const commentMutation = useMutation({
        mutationFn: (data: YorumCreateDto) => yorumService.addYorum(data),

        onSuccess: (_, variables) => {
            notifications.show({
                title: 'Başarılı',
                message: 'Yorumunuz paylaşıldı!',
                color: 'green',
            });
            // Yorum listesini yenile
            queryClient.invalidateQueries({ queryKey: ['yorumlar', variables.icerikId] });
            // İçerik detayını da yenile (yorum sayısı artsın)
            queryClient.invalidateQueries({ queryKey: ['icerik', 'detay', String(variables.icerikId)] });
        },
        onError: (error: any) => {
            notifications.show({
                title: 'Hata',
                message: error.response?.data?.message || "Yorum yapılırken hata oluştu.",
                color: 'red',
            });
        }
    });

    return {
        rate: rateMutation,
        comment: commentMutation,
    };
};