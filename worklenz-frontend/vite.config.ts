import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import path from 'path';

export default defineConfig(({ command }) => {
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

    // **Optimize Dependencies**
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'antd',
        'react-redux',
        '@reduxjs/toolkit',
        'i18next',
        'react-i18next',
        'react-router-dom',
        'moment',
        'date-fns',
        'axios',
        'socket.io-client'
      ],
      exclude: [
        '@dnd-kit/core',
        '@dnd-kit/sortable',
        '@dnd-kit/modifiers',
        '@dnd-kit/utilities'
      ],
      force: true, // Force re-optimization on every dev server start
    },

    // **SSR Configuration**
    ssr: {
      noExternal: ['@dnd-kit/core', '@dnd-kit/utilities', '@dnd-kit/sortable', '@dnd-kit/modifiers'],
    },

    // **Additional Configuration for ES Modules**
    define: {
      // Ensure global is defined for some packages that expect it
      global: 'globalThis',
    },

    // **Build**
    build: {
      // **Target**
      target: ['es2020'], // Updated to a more modern target, adjust according to your needs

      // **Output**
      outDir: 'build',
      assetsDir: 'assets', // Consider a more specific directory for better organization, e.g., 'build/assets'
      cssCodeSplit: true,
      
      // **Chunk Size Optimization**
      chunkSizeWarningLimit: 1000, // Increase limit for vendor chunks but keep warning for others

      // **Sourcemaps**
      sourcemap: command === 'serve' ? 'inline' : true, // Adjust sourcemap strategy based on command

      // **Minification**
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: command === 'build',
          drop_debugger: command === 'build',
          // Remove unused code more aggressively
          unused: true,
          dead_code: true,
        },
        // **Additional Optimization**
        format: {
          comments: command === 'serve', // Preserve comments during development
        },
        mangle: {
          // Mangle private properties for smaller bundles
          properties: {
            regex: /^_/,
          },
        },
      },

      // **Rollup Options**
      rollupOptions: {
        output: {
          // **Enhanced Chunking Strategy**
          manualChunks(id) {
            // Core React dependencies - include @dnd-kit with React to fix loading order
            if (['react', 'react-dom'].includes(id) || id.includes('@dnd-kit')) return 'react-vendor';
            
            // Router and navigation
            if (id.includes('react-router-dom') || id.includes('react-router')) return 'router';
            
            // UI Library
            if (id.includes('antd')) return 'antd-ui';
            
            // Internationalization
            if (id.includes('i18next') || id.includes('react-i18next')) return 'i18n';
            
            // Redux and state management
            if (id.includes('@reduxjs/toolkit') || id.includes('redux') || id.includes('react-redux')) return 'redux';
            
            // Date and time utilities
            if (id.includes('moment') || id.includes('dayjs') || id.includes('date-fns')) return 'date-utils';
            
            // Charts and visualization
            if (id.includes('chart') || id.includes('echarts') || id.includes('highcharts') || id.includes('recharts')) return 'charts';
            
            // Text editor
            if (id.includes('tinymce') || id.includes('quill') || id.includes('editor')) return 'editors';
            
            // Project view components - split into separate chunks for better lazy loading
            if (id.includes('/pages/projects/projectView/taskList/')) return 'project-task-list';
            if (id.includes('/pages/projects/projectView/board/')) return 'project-board';
            if (id.includes('/pages/projects/projectView/insights/')) return 'project-insights';
            if (id.includes('/pages/projects/projectView/finance/')) return 'project-finance';
            if (id.includes('/pages/projects/projectView/members/')) return 'project-members';
            if (id.includes('/pages/projects/projectView/files/')) return 'project-files';
            if (id.includes('/pages/projects/projectView/updates/')) return 'project-updates';
            
            // Task-related components
            if (id.includes('/components/task-') || id.includes('/features/tasks/')) return 'task-components';
            
            // Filter components
            if (id.includes('/components/project-task-filters/') || id.includes('filter-dropdown')) return 'filter-components';
            
            // Other project components
            if (id.includes('/pages/projects/') && !id.includes('/projectView/')) return 'project-pages';
            
            // Settings and admin
            if (id.includes('/pages/settings/') || id.includes('/pages/admin-center/')) return 'settings-admin';
            
            // Reporting
            if (id.includes('/pages/reporting/') || id.includes('/features/reporting/')) return 'reporting';
            
            // Schedule components  
            if (id.includes('/components/schedule') || id.includes('/features/schedule')) return 'schedule';
            
            // Common utilities
            if (id.includes('/utils/') || id.includes('/shared/') || id.includes('/hooks/')) return 'common-utils';
            
            // API and services
            if (id.includes('/api/') || id.includes('/services/')) return 'api-services';
            
            // Other vendor libraries
            if (id.includes('node_modules')) return 'vendor';
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