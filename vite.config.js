import { defineConfig } from 'vite'

export default defineConfig({
    base: '/coda-tax/',
    publicDir: 'public',
    build: {
        rollupOptions: {
            output: {
                // Disable hashing for predictable filenames in sw.js
                entryFileNames: `[name].js`,
                chunkFileNames: `[name].js`,
                assetFileNames: `[name].[ext]`
            }
        }
    },
    server: {
        port: 5173,
        open: true
    }
})
