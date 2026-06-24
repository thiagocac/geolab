import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 180,
    rollupOptions: {
      output: {
        // Forma de função: robusta ao layout de módulos do React 19
        // (a forma de objeto ['react','react-dom'] deixou de capturar o react-dom 19).
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) return 'vendor';
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('@tanstack')) return 'query';
        }
      }
    }
  }
});
