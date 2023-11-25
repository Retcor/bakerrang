import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Only used for Dev, as we will build the client and nginx will serve the files on 8080 from Dockerfile
    host: true,
    strictPort: true,
    port: 3000
  }
})
