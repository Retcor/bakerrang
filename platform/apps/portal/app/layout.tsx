import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import type { ReactNode } from 'react'
import './globals.css'
import { AuthProvider } from './providers/AuthProvider'

export const metadata: Metadata = {
  title: 'BakerRang',
  description: 'Manage BakerRang businesses, websites, domains, and leads.'
}

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export default function RootLayout ({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html className={inter.variable} lang="en">
      <body><AuthProvider>{children}</AuthProvider></body>
    </html>
  )
}
