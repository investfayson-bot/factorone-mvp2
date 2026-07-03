import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'FactorOne — Finance OS',
  description: 'Sistema Operacional Financeiro com IA para empresas modernas',
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700;9..144,900&family=Geist:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet" />
      </head>
      <body>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: { background: '#13201D', color: '#F7F4EE', border: '1px solid #2B564D', fontSize: '13px', fontFamily: "'Geist', system-ui, sans-serif", borderRadius: '4px' },
            success: { iconTheme: { primary: '#6FA595', secondary: '#13201D' } },
            error: { iconTheme: { primary: '#B0413E', secondary: '#13201D' } },
          }}
        />
      </body>
    </html>
  )
}
