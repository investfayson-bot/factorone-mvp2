/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: '#1C2B2A',
        navy2: '#243736',
        brand: '#0055FF',
        accent: '#C8F135',
        /** Painel interno (mockups FactorOne Financial OS) */
        factorone: {
          canvas: '#F9FAFB',
          sidebar: '#F3F4F6',
          accent: '#059669',
        },
      },
      fontFamily: {
        sora: ['Sora', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
