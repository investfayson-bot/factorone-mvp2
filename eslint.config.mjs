import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'eslint.config.mjs',
      'next.config.js',
      'postcss.config.mjs',
      'tailwind.config.js',
    ],
  },
  {
    rules: {
      // Padrão comum: fetch inicial em useEffect + setState (Supabase)
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]

export default eslintConfig
