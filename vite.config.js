import { defineConfig } from 'vite'

export default defineConfig({
    base: '/coda-tax/',
    server: {
        port: 5173,
        open: true
    }
})
