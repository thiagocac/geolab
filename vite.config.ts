import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// React Compiler 1.0 — memoizacao automatica (build-time via Babel).
// target '19': usa o runtime embutido do React 19 (sem pacote react-compiler-runtime).
const reactCompiler: [string, Record<string, unknown>] = ['babel-plugin-react-compiler', { target: '19' }];

export default defineConfig({
  plugins: [react({ babel: { plugins: [reactCompiler] } })],
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 180,
    rollupOptions: {
      output: {
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
