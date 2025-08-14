/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: /^https?:\/\/localhost:3000\//,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 24 * 60 * 60
        }
      }
    },
    {
      urlPattern: /^https:\/\/api\./,
      handler: 'NetworkOnly',
      options: {
        backgroundSync: {
          name: 'api-queue',
          options: {
            maxRetentionTime: 24 * 60
          }
        }
      }
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60
        }
      }
    }
  ]
});

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate'
          }
        ]
      }
    ];
  }
};

module.exports = withPWA(nextConfig);
