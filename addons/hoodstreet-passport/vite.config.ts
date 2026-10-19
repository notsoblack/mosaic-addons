import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' is REQUIRED so the built renderer/index.html uses
// ./assets/... (relative) instead of /assets/... (absolute).
// The harness loads the addon from a file:// URL; absolute paths break.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'renderer',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // Keep filenames stable & reviewable for Dr. Robert.
        entryFileNames: 'assets/index-[hash].js',
        chunkFileNames: 'assets/index-[hash].js',
        assetFileNames: 'assets/index-[hash].[ext]',
      },
    },
  },
  server: { port: 5180, strictPort: true },
});
