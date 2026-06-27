import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: [],
    exclude: [...configDefaults.exclude, 'e2e/**'],
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
