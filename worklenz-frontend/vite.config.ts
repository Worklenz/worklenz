import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ command, mode }) => {
  const isProduction = command === 'build';

  return {
    // **Plugins**
    plugins: [
      react(),
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
        { find: '@hooks', replacement: path.resolve(__dirname, './src/hooks') },
        { find: '@pages', replacement: path.resolve(__dirname, './src/pages') },
        { find: '@api', replacement: path.resolve(__dirname, './src/api') },
        { find: '@types', replacement: path.resolve(__dirname, './src/types') },
        { find: '@shared', replacement: path.resolve(__dirname, './src/shared') },
        { find: '@layouts', replacement: path.resolve(__dirname, './src/layouts') },
        { find: '@services', replacement: path.resolve(__dirname, './src/services') },
      ],
      // **Ensure single React instance to prevent context issues**
      dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
    },

    // **CSS Configuration**
    css: {
      preprocessorOptions: {
        less: {
          modifyVars: {
            '@primary-color': '#1890ff',
          },
          javascriptEnabled: true,
        },
      },
    },

    // **Development Server**
    server: {
      port: 5173,
      host: true,
      open: true,
    },

    // **Build Configuration**
    build: {
      // **Output Directory**
      outDir: 'build',
      
      // **Source Maps**
      sourcemap: false,
      
      // **Minification**
      minify: 'terser',
      
      // **Terser Options**
      terserOptions: {
        compress: {
          drop_console: isProduction,
          drop_debugger: isProduction,
        },
      },

      // **Rollup Options**
      rollupOptions: {
        output: {
          // **Simplified Manual Chunking Strategy - Fixed for React context issues**
          manualChunks: (id) => {
            // Vendor libraries
            if (id.includes('node_modules')) {
              // React and React DOM - keep in main vendor to ensure single instance
              if (id.includes('react') || id.includes('react-dom')) {
                return 'vendor';
              }
              
              // Ant Design - Keep together to share React context
              if (id.includes('antd') || id.includes('@ant-design')) {
                return 'antd';
              }
              
              // Chart.js and related
              if (id.includes('chart.js') || id.includes('react-chartjs-2')) {
                return 'charts';
              }
              
              // Redux and related state management
              if (id.includes('@reduxjs/toolkit') || id.includes('react-redux')) {
                return 'redux';
              }
              
              // React Router
              if (id.includes('react-router')) {
                return 'router';
              }
              
              // i18n
              if (id.includes('react-i18next') || id.includes('i18next')) {
                return 'i18n';
              }
              
              // Other large libraries
              if (id.includes('lodash')) {
                return 'lodash';
              }
              
              if (id.includes('dayjs')) {
                return 'dayjs';
              }
              
              // Remaining vendor code
              return 'vendor';
            }
            
            // Application code chunking
            // Project view components
            if (id.includes('src/pages/projects/projectView')) {
              return 'project-view';
            }
            
            // Other project components
            if (id.includes('src/pages/projects')) {
              return 'projects';
            }
            
            // Task management components
            if (id.includes('src/components/task-') || id.includes('src/features/tasks')) {
              return 'tasks';
            }
            
            // Settings and admin components
            if (id.includes('src/pages/settings') || id.includes('src/components/admin')) {
              return 'admin';
            }
            
            // Common components
            if (id.includes('src/components/common') || id.includes('src/shared')) {
              return 'common';
            }
          },
        },
      },
      
      // **Chunk Size Warning Limit**
      chunkSizeWarningLimit: 2000, // Increased to accommodate larger antd chunk
    },

    // **Optimization**
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react-router-dom',
        '@reduxjs/toolkit',
        'react-redux',
        'react-i18next',
        'dayjs',
      ],
      // Remove antd from exclude to prevent context issues
      exclude: [],
    },

    // **Define Global Constants**
    define: {
      __DEV__: !isProduction,
      // Ensure global React is available
      global: 'globalThis',
    },
  };
});