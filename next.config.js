/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  // Disable static generation for all pages - app uses auth/dynamic data
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
}

module.exports = nextConfig
