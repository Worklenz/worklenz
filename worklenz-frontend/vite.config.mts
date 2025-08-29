import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ command, mode }) => {
  const isProduction = command === 'build';

  return {
    // **Plugins**
    plugins: [react()],

    // **Resolve**
    resolve: {
      alias: [
        // Using an array with objects for clarity and easier management
        { find: '@', replacement: path.resolve(__dirname, './src') },
        { find: '@components', replacement: path.resolve(__dirname, './src/components') },
        { find: '@features', replacement: path.resolve(__dirname, './src/features') },
        { find: '@assets', replacement: path.resolve(__dirname, './src/assets') },
        { find: '@utils', replacement: path.resolve(__dirname, './src/utils') },
        { find: '@hooks', replacement: path.resolve(__dirname, './src/hooks') },
        { find: '@pages', replacement: path.resolve(__dirname, './src/pages') },
        { find: '@api', replacement: path.resolve(__dirname, './src/api') },
        { find: '@types', replacement: path.resolve(__dirname, './src/types') },
        { find: '@shared', replacement: path.resolve(__dirname, './src/shared') },
        { find: '@layouts', replacement: path.resolve(__dirname, './src/layouts') },
        { find: '@services', replacement: path.resolve(__dirname, './src/services') },
      ],
      // **Ensure single React instance**
      dedupe: ['react', 'react-dom'],
    },

    // **Development Server**
    server: {
      port: 5173,
      open: true,
      hmr: {
        overlay: false,
      },
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
        '/secure': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
      },
    },

    // **Build**
    build: {
      // **Target**
      target: ['es2020'], // Updated to a more modern target, adjust according to your needs

      // **Output**
      outDir: 'build',
      assetsDir: 'assets',
      cssCodeSplit: true,

      // **Sourcemaps**
      sourcemap: !isProduction ? 'inline' : false, // Disable sourcemaps in production for smaller bundles

      // **Minification**
      minify: isProduction ? 'terser' : false,
      terserOptions: isProduction
        ? {
            compress: {
              drop_console: true,
              drop_debugger: true,
              pure_funcs: ['console.log', 'console.info', 'console.debug'],
              passes: 2, // Multiple passes for better compression
            },
            mangle: {
              safari10: true,
            },
            format: {
              comments: false,
            },
          }
        : undefined,

      // **Chunk Size Warnings**
      chunkSizeWarningLimit: 1000,

      // **Rollup Options**
      rollupOptions: {
        output: {
          // **Simplified Chunking Strategy to avoid React context issues**
          manualChunks: {
            // Keep React and all React-dependent libraries together
            'react-vendor': ['react', 'react-dom', 'react/jsx-runtime'],

            // Separate chunk for router
            'react-router': ['react-router-dom'],

            // Keep Ant Design separate but ensure React is available
            antd: ['antd', '@ant-design/icons'],
          },

          // **File Naming Strategies**
          chunkFileNames: chunkInfo => {
            const facadeModuleId = chunkInfo.facadeModuleId
              ? chunkInfo.facadeModuleId.split('/').pop()
              : 'chunk';
            return `assets/js/[name]-[hash].js`;
          },
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: assetInfo => {
            if (!assetInfo.name) return 'assets/[name]-[hash].[ext]';
            const info = assetInfo.name.split('.');
            let extType = info[info.length - 1];
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
              extType = 'img';
            } else if (/woff2?|eot|ttf|otf/i.test(extType)) {
              extType = 'fonts';
            }
            return `assets/${extType}/[name]-[hash].[ext]`;
          },
        },

        // **External dependencies (if any should be externalized)**
        external: [],

        // **Preserve modules to avoid context issues**
        preserveEntrySignatures: 'strict',
      },

      // **Experimental features for better performance**
      reportCompressedSize: false, // Disable to speed up build

      // **CSS optimization**
      cssMinify: isProduction,
    },

    // **Optimization**
    optimizeDeps: {
      include: ['react', 'react-dom', 'react/jsx-runtime', 'antd', '@ant-design/icons'],
      exclude: [
        // Add any packages that should not be pre-bundled
      ],
      // Force pre-bundling to avoid runtime issues
      force: true,
    },

    // **Define global constants**
    define: {
      __DEV__: !isProduction,
    },

    // **Public Directory** - sw.js will be automatically copied from public/ to build/
    publicDir: 'public',
  };
});
