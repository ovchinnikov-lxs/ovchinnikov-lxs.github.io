importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.3.0/workbox-sw.js');

if (workbox) {
    console.log(`Workbox is loaded`);

    workbox.routing.registerRoute(({ request }) => request.destination === 'image', new workbox.strategies.CacheFirst());

    // Дополнительные настройки кэширования и другие функции Workbox...
} else {
    console.log(`Workbox didn't load`);
}
