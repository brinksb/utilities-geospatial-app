import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Property Viewer',
  description: 'View and manage properties on an interactive map',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}
