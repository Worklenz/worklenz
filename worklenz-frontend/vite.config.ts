import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig(({ command, mode }) => {
  const isProduction = command === 'build';
  const buildTimestamp = Date.now().toString();

  const env = loadEnv(mode, process.cwd(), '');

  // Open-core edition seam: `ee` resolves business features to their real implementations,
  // `ce` (default, open-source build) resolves them to stubs. Set via VITE_EDITION.
  const edition = (env.VITE_EDITION ?? 'ce') === 'ee' ? 'ee' : 'ce';
  const editionDir = edition === 'ee' ? './worklenz-ee' : './worklenz-ce';

  return {
    // **Plugins**
    plugins: [
      react(),
      // Sentry plugin for source maps upload in production
      // sentryVitePlugin returns an array of plugins, so we spread it
      ...(isProduction
        ? sentryVitePlugin({
            org: env.VITE_SENTRY_ORG,
            project: env.VITE_SENTRY_PROJECT,
            authToken: env.VITE_SENTRY_AUTH_TOKEN,
            telemetry: false,
          })
        : []),
      // Custom plugin to generate version.json for reliable update detection
      {
        name: 'generate-version-file',
        generateBundle() {
          // Generate version.json with build metadata
          const versionData = {
            version: env.npm_package_version || '1.0.0',
            buildTime: buildTimestamp,
            buildId: buildTimestamp,
          };

          this.emitFile({
            type: 'asset',
            fileName: 'version.json',
            source: JSON.stringify(versionData, null, 2),
          });
        },
      },
      // Custom plugin to inject build timestamp into service worker
      {
        name: 'inject-build-timestamp',
        generateBundle(options, bundle) {
          // Update service worker with build timestamp
          const swBundle = bundle['sw.js'];
          if (swBundle && 'source' in swBundle) {
            // OutputAsset has 'source' property
            const swContent = swBundle.source;
            if (typeof swContent === 'string') {
              const updatedSw = swContent.replace(
                /const BUILD_TIMESTAMP = self\.location\.search\.match[^;]+;/,
                `const BUILD_TIMESTAMP = '${buildTimestamp}';`
              );
              swBundle.source = updatedSw;
            }
          } else if (swBundle && 'code' in swBundle) {
            // OutputChunk has 'code' property
            const swContent = swBundle.code;
            if (typeof swContent === 'string') {
              const updatedSw = swContent.replace(
                /const BUILD_TIMESTAMP = self\.location\.search\.match[^;]+;/,
                `const BUILD_TIMESTAMP = '${buildTimestamp}';`
              );
              swBundle.code = updatedSw;
            }
          }

          // Add versioning to service worker file name in production
          if (isProduction && swBundle) {
            bundle[`sw.js?v=${buildTimestamp}`] = swBundle;
            delete bundle['sw.js'];
          }
        },
        transformIndexHtml: {
          order: 'post',
          handler(html) {
            // Inject build timestamp into HTML for service worker detection
            return html.replace(
              '<head>',
              `<head>\n  <script>window.buildTimestamp = '${buildTimestamp}';</script>`
            );
          },
        },
      },
    ],

    // **Resolve**
    resolve: {
      alias: [
        // Edition seam — MUST precede the '@' catch-all so it wins for these paths.
        {
          find: /^@\/worklenz-ee\/(.*)/,
          replacement: path.resolve(__dirname, `${editionDir}/$1`),
        },
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
      hmr: {
        overlay: false,
      },
      // Allow-list specific dev hosts (e.g., ngrok) to prevent blocked host errors
      // Configure via VITE_ALLOWED_HOSTS environment variable (comma-separated list)
      // Example: VITE_ALLOWED_HOSTS=host1.example.com,host2.example.com
      allowedHosts: process.env.VITE_ALLOWED_HOSTS
        ? process.env.VITE_ALLOWED_HOSTS.split(',')
            .map(host => host.trim())
            .filter(Boolean)
        : [],
      // **Proxy API requests to backend server**
      proxy: {
        '/api': {
          target: process.env.VITE_API_URL || 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
        '/socket.io': {
          target: process.env.VITE_SOCKET_URL || 'ws://localhost:3000',
          changeOrigin: true,
          ws: true,
        },
      },
    },

    // **Build**
    build: {
      // **Target**
      target: ['es2020'], // Updated to a more modern target, adjust according to your needs

      // **Output**
      outDir: process.env.VITE_BUILD_OUTDIR || 'build',
      assetsDir: 'assets',
      cssCodeSplit: true,

      // **Sourcemaps**
      // Generate sourcemaps in production for Sentry (they'll be uploaded, not included in bundle)
      // Use 'hidden' so sourcemaps are generated but not referenced in the bundle
      sourcemap: !isProduction ? 'inline' : 'hidden',

      // **Module Preload Polyfill** - Helps with chunk loading reliability
      modulePreload: {
        polyfill: true,
      },

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
          // **Granular chunking strategy for better parallelism and cache reuse**
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react/jsx-runtime'],
            'react-router': ['react-router-dom'],
            'antd-core': ['antd'],
            'antd-icons': ['@ant-design/icons'],
            charts: ['chart.js', 'react-chartjs-2', 'chartjs-plugin-datalabels'],
            gantt: ['gantt-task-react'],
            'pdf-export': ['html2canvas', 'jspdf'],
            socket: ['socket.io-client'],
            i18n: [
              'i18next',
              'react-i18next',
              'i18next-browser-languagedetector',
              'i18next-http-backend',
            ],
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
      include: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'antd',
        '@ant-design/icons',
        'chart.js',
        'react-chartjs-2',
        'chartjs-plugin-datalabels',
        'gantt-task-react',
        'html2canvas',
        'jspdf',
        'socket.io-client',
        'i18next',
        'react-i18next',
        'i18next-browser-languagedetector',
        'i18next-http-backend',
      ],
      exclude: [
        // Add any packages that should not be pre-bundled
      ],
      // Force pre-bundling to avoid runtime issues
      force: true,
    },

    // **Define global constants**
    define: {
      __DEV__: !isProduction,
      __BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
    },

    // **Public Directory** - sw.js will be automatically copied from public/ to build/
    publicDir: 'public',
  };
});
