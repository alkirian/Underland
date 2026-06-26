import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// Touched to reload env configuration
export default defineConfig({
  plugins: [
    react(),
    basicSsl()
  ],
})
