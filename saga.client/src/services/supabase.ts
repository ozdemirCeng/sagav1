import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("❌ Supabase konfigürasyonu eksik!");
    console.error("URL:", supabaseUrl);
    console.error("KEY:", supabaseAnonKey ? "Mevcut (gizli)" : "EKSİK!");
    throw new Error('Supabase URL veya Anon Key eksik! .env dosyasını kontrol et.');
}

console.log("✅ Supabase başlatıldı:");
console.log("URL:", supabaseUrl);
console.log("KEY başlangıcı:", supabaseAnonKey.substring(0, 20) + "...");

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});