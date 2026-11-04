import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // shadcn-style imports: "@/components/ui/..." resolves to src/
  resolve: { alias: { '@': decodeURIComponent(new URL('./src', import.meta.url).pathname) } },
})
