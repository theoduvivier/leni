import type { Metadata, Viewport } from 'next'
import { AppNav } from '@/components/app-nav'
import './globals.css'

export const metadata: Metadata = {
  title: 'Leni — Agent Social Media',
  description: 'Dashboard de contrôle Leni',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#eef2ff',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className="bg-background min-h-dvh">
        {/* Aurora background blobs */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-32 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
          <div className="absolute top-1/4 -right-20 h-48 w-48 rounded-full bg-teal/20 blur-3xl" />
          <div className="absolute bottom-1/3 -left-16 h-56 w-56 rounded-full bg-pink/15 blur-3xl" />
        </div>

        <AppNav />

        {/* Mobile: centered 430px, bottom padding for nav */}
        {/* Desktop: offset by sidebar width, full width content */}
        <main className="relative z-10 mx-auto max-w-[430px] min-h-dvh pb-20 lg:ml-56 lg:max-w-none lg:pb-0">
          {children}
        </main>
      </body>
    </html>
  )
}
