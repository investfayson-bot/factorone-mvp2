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
        <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: { background: '#182120', color: '#E4E8E7', border: '1px solid #2E3D3B', fontSize: '13px' },
            success: { iconTheme: { primary: '#22C97A', secondary: '#182120' } },
            error: { iconTheme: { primary: '#FF4F4F', secondary: '#182120' } },
          }}
        />
      </body>
    </html>
  )
}
