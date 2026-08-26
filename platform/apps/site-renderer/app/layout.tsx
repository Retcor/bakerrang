import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import {
  Inter,
  Lora,
  Merriweather,
  Montserrat,
  Playfair_Display,
  Poppins,
  Source_Serif_4,
  Work_Sans
} from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-site-inter' })
const poppins = Poppins({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-site-poppins', weight: ['400', '600', '700'] })
const montserrat = Montserrat({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-site-montserrat' })
const workSans = Work_Sans({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-site-work-sans' })
const lora = Lora({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-site-lora' })
const merriweather = Merriweather({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-site-merriweather' })
const playfair = Playfair_Display({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-site-playfair' })
const sourceSerif = Source_Serif_4({ subsets: ['latin'], display: 'swap', preload: false, variable: '--font-site-source-serif' })
const tenantFontVariables = [
  inter, poppins, montserrat, workSans, lora, merriweather, playfair, sourceSerif
].map((font) => font.variable).join(' ')

export const metadata: Metadata = {
  title: 'Website'
}

export default function RootLayout ({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html className={tenantFontVariables} lang="en">
      <body>{children}</body>
    </html>
  )
}
