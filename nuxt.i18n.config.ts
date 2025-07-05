import defineI18nConfig from '@nuxtjs/i18n';

export default defineI18nConfig({
    locales: [
        { code: 'en', file: 'en.json', name: 'English' },
        { code: 'ru', file: 'ru.json', name: 'Русский' },
    ],
    defaultLocale: 'en',
    lazy: true,
    langDir: 'locales/',
    strategy: 'no_prefix',
    vueI18n: {
        legacy: false,
        locale: 'en',
        fallbackLocale: 'en',
    },
}); 