/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    reporters: ['verbose'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/'],
    },
  },
  resolve: {
    alias: [
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
  },
});
