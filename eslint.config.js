import js from '@eslint/js'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'

const browserGlobals = {
    window: 'readonly', document: 'readonly', navigator: 'readonly',
    localStorage: 'readonly', sessionStorage: 'readonly',
    setTimeout: 'readonly', clearTimeout: 'readonly',
    setInterval: 'readonly', clearInterval: 'readonly',
    fetch: 'readonly', URL: 'readonly', URLSearchParams: 'readonly',
    console: 'readonly', Promise: 'readonly', Date: 'readonly',
    Math: 'readonly', JSON: 'readonly', Set: 'readonly', Map: 'readonly',
    Error: 'readonly', FormData: 'readonly', File: 'readonly',
    FileReader: 'readonly', Blob: 'readonly', ArrayBuffer: 'readonly',
    self: 'readonly', caches: 'readonly', clients: 'readonly',
    Request: 'readonly', Response: 'readonly',
    PushManager: 'readonly', importScripts: 'readonly',
    confirm: 'readonly', alert: 'readonly', prompt: 'readonly',
    Notification: 'readonly', Event: 'readonly',
    atob: 'readonly', btoa: 'readonly',
    performance: 'readonly', history: 'readonly', location: 'readonly',
    XMLHttpRequest: 'readonly', WebSocket: 'readonly',
    MutationObserver: 'readonly', IntersectionObserver: 'readonly',
    ResizeObserver: 'readonly', requestAnimationFrame: 'readonly',
    cancelAnimationFrame: 'readonly', queueMicrotask: 'readonly',
    __dirname: 'readonly', __filename: 'readonly',
    process: 'readonly', Buffer: 'readonly', global: 'readonly',
    module: 'readonly', require: 'readonly', exports: 'readonly',
}

export default [
    js.configs.recommended,
    {
        files: ['src/**/*.{js,jsx}'],
        plugins: {
            react: reactPlugin,
            'react-hooks': reactHooksPlugin,
        },
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: browserGlobals,
            parserOptions: {
                ecmaFeatures: { jsx: true },
            },
        },
        settings: {
            react: { version: '18' },
        },
        rules: {
            // React rules
            'react/jsx-uses-react': 'off',
            'react/react-in-jsx-scope': 'off',
            'react/prop-types': 'off',
            'react/display-name': 'off',
            'react/no-unescaped-entities': 'warn',
            // Hooks — warn on existing violations (pattern: hooks after early `if (supabaseMode) return`)
            // Fix in T3-2 by extracting legacy branches into separate components
            'react-hooks/rules-of-hooks': 'warn',
            'react-hooks/exhaustive-deps': 'warn',
            // General
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_?' }],
            'no-console': 'off',
            'no-undef': 'error',
            'no-empty': 'warn',
            'no-useless-escape': 'warn',
            'no-control-regex': 'off',
        },
    },
    {
        ignores: ['dist/**', 'node_modules/**', 'public/sw.js', 'supabase/**'],
    },
]
