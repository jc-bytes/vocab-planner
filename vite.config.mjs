import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  appType: 'mpa',
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
});
