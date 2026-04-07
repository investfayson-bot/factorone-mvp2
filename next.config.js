/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },

  // opcional (remove warning de root)
  turbopack: {
    root: __dirname,
  },
}

module.exports = nextConfig
