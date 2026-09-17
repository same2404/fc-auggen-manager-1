import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import { execFileSync } from 'child_process';

function firestorePatchPlugin(): Plugin {
  return {
    name: 'firestore-patch-plugin',
    buildStart() {
      try {
        const patchScript = path.resolve(process.cwd(), 'scripts/patch-firestore.cjs');
        execFileSync(process.execPath, [patchScript], { stdio: 'ignore' });
      } catch (e) {
        // Silently continue if patch script cannot be executed
      }
    },
    configureServer() {
      try {
        const patchScript = path.resolve(process.cwd(), 'scripts/patch-firestore.cjs');
        execFileSync(process.execPath, [patchScript], { stdio: 'ignore' });
      } catch (e) {
        // Silently continue
      }
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    base: './',
    plugins: [react(), tailwindcss(), firestorePatchPlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
      sourcemap: false,
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
