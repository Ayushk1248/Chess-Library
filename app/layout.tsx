import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Chess Library',
  description: 'Your personal chess opening repertoire',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}