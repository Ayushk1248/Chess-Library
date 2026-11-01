import type { Metadata } from 'next'
import './globals.css'
import { DialogFocus } from '@/components/dialog-focus'

export const metadata: Metadata = {
  title: 'Chess Library',
  description: 'Your personal chess opening repertoire',
}

// app/layout.tsx
import { ThemeProvider } from "@/lib/theme-context";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider><DialogFocus />{children}</ThemeProvider>
      </body>
    </html>
  );
}
