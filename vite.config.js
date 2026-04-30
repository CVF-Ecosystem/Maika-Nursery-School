import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    base: '/',
    plugins: [react()],
    test: {
        environment: 'jsdom',
        setupFiles: './src/test/setup.js',
        globals: true,
        exclude: ['node_modules', 'dist', 'tests/e2e/**'],
    },
    build: {
        outDir: 'dist',
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) return 'vendor'
                },
            },
        },
    },
})
