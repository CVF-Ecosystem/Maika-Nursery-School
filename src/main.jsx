import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import ErrorBoundary from './app/ErrorBoundary'
import './styles/global.css'

const root = document.getElementById('root')
const supabaseBackend = import.meta.env.VITE_DATA_BACKEND === 'supabase'
const missingSupabaseEnv = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter(
    key => !import.meta.env[key] || import.meta.env[key].includes('your-'),
)

if (supabaseBackend && missingSupabaseEnv.length) {
    root.innerHTML = `
        <main style="min-height:100vh;display:grid;place-items:center;background:#F5F3FF;padding:24px;font-family:Nunito,system-ui,sans-serif">
            <section style="max-width:520px;background:#fff;border-radius:18px;padding:28px;box-shadow:0 18px 48px rgba(109,40,217,.16)">
                <h1 style="margin:0 0 12px;color:#1E1B4B;font-size:24px">Thiếu cấu hình Supabase</h1>
                <p style="margin:0;color:#5B5490;font-weight:700;line-height:1.6">Vui lòng cấu hình ${missingSupabaseEnv.join(', ')} trong .env.local hoặc biến môi trường deploy.</p>
            </section>
        </main>
    `
} else {
    ReactDOM.createRoot(root).render(
        <React.StrictMode>
            <ErrorBoundary>
                <BrowserRouter>
                    <App />
                </BrowserRouter>
            </ErrorBoundary>
        </React.StrictMode>,
    )
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/sw.js')
            .then(registration => registration.update().catch(() => {}))
            .catch(() => {})
    })
}
