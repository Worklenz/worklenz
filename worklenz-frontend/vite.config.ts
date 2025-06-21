import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(({ command, mode }) => {
  const isProduction = command === 'build';

  return {
    // **Plugins**
    plugins: [
      react(),
      tsconfigPaths({
        // Optionally, you can specify a custom tsconfig file
        // loose: true, // If you're using a non-standard tsconfig setup
      }),
    ],

    // **Resolve**
    resolve: {
      alias: [
        // Using an array with objects for clarity and easier management
        { find: '@', replacement: path.resolve(__dirname, './src') },
        { find: '@components', replacement: path.resolve(__dirname, './src/components') },
        { find: '@features', replacement: path.resolve(__dirname, './src/features') },
        { find: '@assets', replacement: path.resolve(__dirname, './src/assets') },
        { find: '@utils', replacement: path.resolve(__dirname, './src/utils') },
        { find: '@services', replacement: path.resolve(__dirname, './src/services') },
        { find: '@api', replacement: path.resolve(__dirname, './src/api') },
      ],
    },

    // **Development Server**
    server: {
      port: 3000,
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
      terserOptions: isProduction ? {
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
      } : undefined,

      // **Chunk Size Warnings**
      chunkSizeWarningLimit: 1000,

      // **Rollup Options**
      rollupOptions: {
        output: {
          // **Optimized Chunking Strategy**
          manualChunks(id) {
            // Core React libraries
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            
            // Router
            if (id.includes('react-router')) {
              return 'react-router';
            }
            
            // Ant Design (keep separate for better caching)
            if (id.includes('antd') && !id.includes('@ant-design/icons')) {
              return 'antd';
            }
            
            // Icons (if using ant design icons)
            if (id.includes('@ant-design/icons')) {
              return 'antd-icons';
            }
            
            // Internationalization
            if (id.includes('i18next')) {
              return 'i18n';
            }
            
            // Node modules vendor chunk for other libraries
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          },
          
          // **File Naming Strategies**
          chunkFileNames: (chunkInfo) => {
            const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk';
            return `assets/js/[name]-[hash].js`;
          },
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
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
      ],
      exclude: [
        // Add any packages that should not be pre-bundled
      ],
    },

    // **Define global constants**
    define: {
      __DEV__: !isProduction,
    },
  };
});