import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Song Wars',
  description: 'Battle for the best song — the ultimate multiplayer music competition platform',
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎵</text></svg>",
  },
  openGraph: {
    title: 'Song Wars',
    description: 'Battle for the best song',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-950 text-white font-inter antialiased min-h-screen">
        {children}
      </body>
    </html>
  )
}
