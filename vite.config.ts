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
    // Produção: NÃO publicar .map. Sourcemaps públicos expõem o código-fonte (IP) e incham o
    // deploy (~1,5 MB+ por chunk). Se um dia for simbolicar erros, troque por 'hidden' (gera o
    // .map sem o comentário sourceMappingURL) e exclua *.map do publish no Netlify.
    sourcemap: false,
    chunkSizeWarningLimit: 180,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return;
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) return 'vendor';
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('@tanstack')) return 'query';
          if (id.includes('recharts') || id.includes('/d3-') || id.includes('victory-vendor')) return 'charts';
        }
      }
    }
  }
});
