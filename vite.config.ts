import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';

// Vite 8 + @vitejs/plugin-react v6: o plugin-react dropou o Babel (usa Oxc).
// O React Compiler (Babel) volta via @rolldown/plugin-babel, com o reactCompilerPreset()
// no array `presets`. ORDEM: babel() ANTES de react() — senão o compiler nao roda.
export default defineConfig({
  plugins: [
    babel({ presets: [reactCompilerPreset()] }),
    react(),
  ],
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 180,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return;
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) return 'vendor';
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('@tanstack')) return 'query';
        }
      }
    }
  }
});
