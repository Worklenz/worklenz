import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { UserConfig } from 'vite'; // Import type for better auto-completion

export default defineConfig(({ command }: { command: 'build' | 'serve' }) => {
  return {
    // **Plugins**
    plugins: [
      react(),
    ],

    // **Resolve**
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@features': path.resolve(__dirname, './src/features'),
        '@assets': path.resolve(__dirname, './src/assets'),
        '@utils': path.resolve(__dirname, './src/utils'),
        '@services': path.resolve(__dirname, './src/services'),
        '@api': path.resolve(__dirname, './src/api'),
      }
    },

    // **Build**
    build: {
      // **Target**
      target: ['es2020'], // Updated to a more modern target, adjust according to your needs

      // **Output**
      outDir: 'build',
      assetsDir: 'assets', // Consider a more specific directory for better organization, e.g., 'build/assets'
      cssCodeSplit: true,

      // **Sourcemaps**
      sourcemap: command === 'serve' ? 'inline' : true, // Adjust sourcemap strategy based on command

      // **Minification**
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: command === 'build',
          drop_debugger: command === 'build',
        },
        // **Additional Optimization**
        format: {
          comments: command === 'serve', // Preserve comments during development
        },
      },

      // **Rollup Options**
      rollupOptions: {
        output: {
          // **Chunking Strategy**
          manualChunks(id) {
            if (['react', 'react-dom', 'react-router-dom'].includes(id)) return 'vendor';
            if (id.includes('antd')) return 'antd';
            if (id.includes('i18next')) return 'i18n';
            // Add more conditions as needed
          },
          // **File Naming Strategies**
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
        },
      },
    },
  };
});