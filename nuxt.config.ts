// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },
  modules: [
    '@nuxt/eslint',
    '@nuxt/test-utils',
    '@nuxtjs/i18n',
  ],
  ssr: true,
  // app: {
  //   baseURL: '/ovchinnikov-lxs.github.io/', // для GitHub Pages
  // },
})