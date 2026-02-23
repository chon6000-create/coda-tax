import { defineConfig } from 'vite'

export default defineConfig({
    base: '/coda-tax/',
    publicDir: 'public',
    server: {
        port: 5173,
        open: true
    }
})
