import { defineConfig, type UserConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';

// Vite 8 + @vitejs/plugin-react v6: o plugin-react dropou o Babel (usa Oxc).
// O React Compiler (Babel) volta via @rolldown/plugin-babel, com o reactCompilerPreset()
// no array `presets`. ORDEM: babel() ANTES de react() — senão o compiler nao roda.
// [v252] O bloco `test` (vitest) fica fora do tipo UserConfig do rolldown-vite — importar
// defineConfig de 'vitest/config' colide os tipos rollup×rolldown no `plugins`. Objeto solto
// + cast: o vitest lê o campo em runtime; o tsc valida o resto.
const config = {
  plugins: [
    babel({ presets: [reactCompilerPreset()] }),
    react(),
  ],
  test: {
    // [v252] O perfil PowerShell desta máquina exporta NODE_ENV=production; o vitest herda e o
    // React resolve o build de PRODUÇÃO (sem `act`) — Button.test quebrava só localmente
    // (no CI passa). Força ambiente de teste independente do shell.
    env: { NODE_ENV: 'test' },
  },
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
};

export default defineConfig(config as UserConfig);
