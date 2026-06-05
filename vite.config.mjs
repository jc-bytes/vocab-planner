import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const PRODUCTION_SUPABASE_URL = 'https://ifofhiypzffruzhiukst.supabase.co';

function validateSupabaseBuildConfig({ command, mode }) {
  const url = process.env.VITE_SUPABASE_URL || '';
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  const allowMissing = process.env.ALLOW_MISSING_SUPABASE_CONFIG === '1';
  const allowProductionInDev = process.env.ALLOW_PRODUCTION_SUPABASE_IN_DEV === '1';

  if (command === 'build' && !allowMissing && (!url || !publishableKey)) {
    throw new Error('Missing Supabase build config. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
  }

  if (url === PRODUCTION_SUPABASE_URL && mode !== 'production' && !allowProductionInDev) {
    throw new Error('Refusing to use the production Supabase project outside production mode.');
  }
}

export default defineConfig(({ command, mode }) => {
  validateSupabaseBuildConfig({ command, mode });

  return {
    appType: 'mpa',
    base: './',
    publicDir: false,
    build: {
      outDir: 'dist-desktop',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html'),
          student: resolve(__dirname, 'student.html'),
          teacher: resolve(__dirname, 'teacher.html')
        },
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/@supabase')) return 'supabase-vendor';
            if (id.includes('node_modules/chart.js')) return 'teacher-charts';
            if (id.endsWith('/js/main.js') || id.endsWith('/js/notifications.js')) return 'app-shared';
            if (id.endsWith('/js/db.js')) return 'student-storage';
            if (id.endsWith('/js/quizMaker.js')) return 'teacher-quiz-maker';
          }
        }
      }
    },
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.1.0')
    }
  };
});
