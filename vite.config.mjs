import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'node:path';

const PRODUCTION_SUPABASE_URL = 'https://ifofhiypzffruzhiukst.supabase.co';

function validateSupabaseBuildConfig({ command, mode, env }) {
  const url = env.VITE_SUPABASE_URL || '';
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '';
  const allowMissing = env.ALLOW_MISSING_SUPABASE_CONFIG === '1';
  const allowProductionInDev = env.ALLOW_PRODUCTION_SUPABASE_IN_DEV === '1';
  const hasPlaceholder = url.includes('YOUR_PROJECT_REF')
    || publishableKey.includes('YOUR_SUPABASE')
    || publishableKey.includes('your_key_here');

  if (command === 'build' && !allowMissing && (!url || !publishableKey || hasPlaceholder)) {
    throw new Error('Missing Supabase build config. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
  }

  if (url === PRODUCTION_SUPABASE_URL && mode !== 'production' && !allowProductionInDev) {
    throw new Error('Refusing to use the production Supabase project outside production mode.');
  }
}

export default defineConfig(({ command, mode }) => {
  const env = {
    ...process.env,
    ...loadEnv(mode, process.cwd(), '')
  };

  validateSupabaseBuildConfig({ command, mode, env });

  return {
    appType: 'mpa',
    base: './',
    publicDir: false,
    server: {
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    },
    preview: {
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    },
    build: {
      outDir: 'dist-desktop',
      emptyOutDir: true,
      manifest: true,
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
      __APP_VERSION__: JSON.stringify(env.npm_package_version || '0.1.0'),
      'process.env.IS_PREACT': JSON.stringify('false'),
      'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development')
    }
  };
});
