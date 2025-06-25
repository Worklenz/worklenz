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
        // **External dependencies to prevent bundling issues**
        external: (id) => {
          // Don't externalize anything for now to prevent context issues
          return false;
        },
        output: {
          // **Manual Chunking Strategy - Fixed for React context issues**
          manualChunks: (id) => {
            // Vendor libraries
            if (id.includes('node_modules')) {
              // React core - keep together to prevent context issues
              if (id.includes('react') && !id.includes('react-router') && !id.includes('react-redux') && !id.includes('react-i18next')) {
                return 'react-core';
              }
              
              // Ant Design - Split into smaller chunks but ensure React dependency
              if (id.includes('antd/es') || id.includes('antd/lib')) {
                // Split antd by component types for better caching
                if (id.includes('date-picker') || id.includes('time-picker') || id.includes('calendar')) {
                  return 'antd-date';
                }
                if (id.includes('table') || id.includes('list') || id.includes('tree')) {
                  return 'antd-data';
                }
                if (id.includes('form') || id.includes('input') || id.includes('select') || id.includes('checkbox')) {
                  return 'antd-form';
                }
                if (id.includes('button') || id.includes('tooltip') || id.includes('dropdown') || id.includes('menu')) {
                  return 'antd-basic';
                }
                if (id.includes('modal') || id.includes('drawer') || id.includes('popconfirm')) {
                  return 'antd-overlay';
                }
                // Catch remaining antd components
                return 'antd-misc';
              }
              
              // Icons
              if (id.includes('@ant-design/icons')) {
                return 'antd-icons';
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
      chunkSizeWarningLimit: 1000,
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
        // Include antd core to prevent context issues
        'antd/es/config-provider',
        'antd/es/button',
        'antd/es/input',
        'antd/es/select',
      ],
      // Don't exclude antd to prevent React context issues
      exclude: [],
    },

    // **Define Global Constants**
    define: {
      __DEV__: !isProduction,
    },
  };
});