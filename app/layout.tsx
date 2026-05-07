import type { Metadata, Viewport } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import MobileNav from '@/components/MobileNav'

export const metadata: Metadata = {
  title: 'Xavis',
  description: '나만의 AI 플래너',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Xavis',
  },
  icons: {
    icon: '/icons/icon-32.png',
    apple: '/icons/icon-180.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#f5f5f7',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <div className="app-shell">
          <Sidebar />
          <main className="main">
            {children}
          </main>
        </div>
        <MobileNav />
      </body>
    </html>
  )
}
