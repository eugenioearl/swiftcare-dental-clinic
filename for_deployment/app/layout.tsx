
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Providers } from "@/components/providers"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "SwiftCare Dental Clinic - Comprehensive Dental Management",
  description: "Professional dental clinic management system with appointment scheduling, patient management, billing, and more.",
  keywords: ["dental clinic", "appointment scheduling", "patient management", "dental care", "healthcare"],
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning style={{ colorScheme: 'light' }} data-theme="light">
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
