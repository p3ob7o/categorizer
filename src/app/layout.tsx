import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ThemeToggle } from '@/components/ThemeToggle'
import WizardLogo from '@/components/WizardLogo'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Domain Categorizer',
  description: 'AI-powered domain name categorization tool',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="font-sans antialiased bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-50">
        <ThemeProvider>
          <div className="min-h-screen">
            {/* Minimal header */}
            <header className="sticky top-0 z-50 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-black/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-black/60">
              <div className="container mx-auto px-4">
                <div className="flex h-14 items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <a href="/" className="flex items-center space-x-2">
                      <WizardLogo className="h-6 w-6 text-zinc-900 dark:text-white" />
                      <span className="text-sm font-medium">Domain Categorizer</span>
                    </a>
                  </div>
                  <div className="flex items-center space-x-2">
                    <ThemeToggle />
                  </div>
                </div>
              </div>
            </header>
            {/* Main content */}
            <main className="flex-1">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
} 