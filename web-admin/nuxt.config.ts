import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  devServer: {
    port: 3001,
  },
  vite: {
    plugins: [tailwindcss()],
  },
  routeRules: {
    '/api/**': {
      proxy: 'http://localhost:3000/api/**',
    },
  },
})
