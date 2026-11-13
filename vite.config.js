import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Three apps, one project:  /  (customer)   /technician/   /admin/
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        customer: resolve(__dirname, 'index.html'),
        technician: resolve(__dirname, 'technician/index.html'),
        admin: resolve(__dirname, 'admin/index.html'),
      },
    },
  },
});
