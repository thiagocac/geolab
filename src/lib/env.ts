const cfg = (typeof window !== 'undefined' && window.__CONSULTE_GEO_CONFIG__) || {};
export const env = {
  supabaseUrl: cfg.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || 'https://example.supabase.co',
  supabaseAnonKey: cfg.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || 'local-anon-key',
  // demo é opt-in explícito; produção usa dados reais
  demoMode: (cfg.VITE_DEMO_MODE || import.meta.env.VITE_DEMO_MODE || 'false') === 'true'
};
