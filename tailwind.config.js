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
        fo: {
          teal: '#2D6A5E',
          tealLight: '#3D8B7A',
          tealBg: '#E8F4F1',
          beige: '#C8B89A',
          beigeLight: '#E8D9C4',
          dark: '#1A1A2E',
          sidebar: '#F7F7F5',
          bg: '#FAFAFA',
          card: '#FFFFFF',
          border: '#EBEBEB',
          text: '#1A1A2E',
          textMuted: '#6B7280',
          success: '#2D6A5E',
          warning: '#D4A017',
          danger: '#C0392B',
          live: '#2D6A5E',
        },
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
