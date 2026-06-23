// Config de runtime do GEOLAB (carregado antes do bundle, em index.html).
// A anon key e PUBLICA por design (vai em todo bundle de frontend); o RLS protege os dados.
// Trocar de projeto Supabase = editar so este arquivo, sem rebuild de codigo.
window.__CONSULTE_GEO_CONFIG__ = {
  VITE_SUPABASE_URL: 'https://xbdvyvvxvzmcosnekmfv.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiZHZ5dnZ4dnptY29zbmVrbWZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNjEwMDEsImV4cCI6MjA5NzczNzAwMX0.KhLZVORWXZLEw7UvD1LuqLpm-A-zbdUaIR4HgvcM3HA',
  VITE_DEMO_MODE: 'false'
};
