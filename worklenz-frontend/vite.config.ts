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
          // **Optimized Chunking Strategy for better caching and loading**
          manualChunks: (id) => {
            // Core React libraries - most stable, rarely change
            if (id.includes('react') || id.includes('react-dom') || id.includes('react/jsx-runtime')) {
              return 'react-core';
            }
            
            // React Router - separate chunk as it's used throughout the app
            if (id.includes('react-router') || id.includes('react-router-dom')) {
              return 'react-router';
            }
            
            // Ant Design - large UI library, separate chunk
            if (id.includes('antd') || id.includes('@ant-design')) {
              return 'antd';
            }
            
            // Chart.js and related libraries - heavy visualization libs
            if (id.includes('chart.js') || id.includes('react-chartjs') || id.includes('chartjs')) {
              return 'charts';
            }
            
            // TinyMCE - heavy editor, separate chunk (lazy loaded)
            if (id.includes('tinymce') || id.includes('@tinymce')) {
              return 'tinymce';
            }
            
            // Gantt and scheduling libraries - heavy components
            if (id.includes('gantt') || id.includes('scheduler')) {
              return 'gantt';
            }
            
            // Date utilities - commonly used
            if (id.includes('date-fns') || id.includes('moment')) {
              return 'date-utils';
            }
            
            // Redux and state management
            if (id.includes('@reduxjs') || id.includes('react-redux') || id.includes('redux')) {
              return 'redux';
            }
            
            // Socket.io - real-time communication
            if (id.includes('socket.io')) {
              return 'socket';
            }
            
            // Utility libraries
            if (id.includes('lodash') || id.includes('dompurify') || id.includes('nanoid')) {
              return 'utils';
            }
            
            // i18n libraries
            if (id.includes('i18next') || id.includes('react-i18next')) {
              return 'i18n';
            }
            
            // Other node_modules dependencies
            if (id.includes('node_modules')) {
              return 'vendor';
            }
            
            // Return undefined for app code to be bundled together
            return undefined;
          },

          // **File Naming Strategies**
          chunkFileNames: (chunkInfo) => {
            // Use shorter names for better caching
            return `assets/js/[name]-[hash:8].js`;
          },
          entryFileNames: 'assets/js/[name]-[hash:8].js',
          assetFileNames: (assetInfo) => {
            if (!assetInfo.name) return 'assets/[name]-[hash:8].[ext]';
            const info = assetInfo.name.split('.');
            let extType = info[info.length - 1];
            if (/png|jpe?g|svg|gif|tiff|bmp|ico|webp/i.test(extType)) {
              extType = 'img';
            } else if (/woff2?|eot|ttf|otf/i.test(extType)) {
              extType = 'fonts';
            } else if (/css/i.test(extType)) {
              extType = 'css';
            }
            return `assets/${extType}/[name]-[hash:8].[ext]`;
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
      include: [
        'react', 
        'react-dom', 
        'react/jsx-runtime', 
        'antd', 
        '@ant-design/icons',
        'react-router-dom',
        'i18next',
        'react-i18next',
        'date-fns',
        'dompurify',
      ],
      exclude: [
        // Exclude heavy libraries that should be lazy loaded
        '@tinymce/tinymce-react',
        'tinymce',
        'chart.js',
        'react-chartjs-2',
        'gantt-task-react',
      ],
      // Force pre-bundling to avoid runtime issues
      force: false, // Only force when needed to improve dev startup time
    },

    // **Define global constants**
    define: {
      __DEV__: !isProduction,
    },


  };
});
