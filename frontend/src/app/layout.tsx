import type { Metadata } from 'next'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'Springfield Utilities Dept. | Sector 7G',
  description: 'Mmm... infrastructure. Synthetic utility network for Springfield, Oregon. Safety codes not verified.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#FED90F',
              border: '2px solid #000',
              color: '#000',
              fontFamily: 'system-ui, sans-serif',
            },
          }}
        />
      </body>
    </html>
  )
}
