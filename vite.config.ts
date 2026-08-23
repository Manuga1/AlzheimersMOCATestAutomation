import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,onnx,wasm}'],
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
      },
      manifest: {
        name: 'Automated Cognitive Screen (MoCA-structure)',
        short_name: 'CogScreen',
        description:
          'Self-administered MoCA-structure cognitive screening for iPad with voice guidance. Screening aid only — not a diagnostic device.',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#f7f5f0',
        theme_color: '#2c5f7c',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  build: { target: 'es2020' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
} as any);
