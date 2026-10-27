import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { RootProvider } from 'fumadocs-ui/provider/next'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import StaticSearch from './search'
import { source } from './source'
import './global.css'

export const metadata: Metadata = {
  title: { template: '%s · webular docs', default: 'webular docs' },
  metadataBase: new URL('https://webular.dev'),
}

// data-theme drives the home page tokens; the class drives Fumadocs' dark variant.
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider
          theme={{ attribute: ['class', 'data-theme'] }}
          search={{ SearchDialog: StaticSearch }}
        >
          <DocsLayout
            tree={source.getPageTree()}
            nav={{ title: 'webular', url: 'https://webular.dev/' }}
            links={[{ text: 'Home', url: 'https://webular.dev/' }]}
          >
            {children}
          </DocsLayout>
        </RootProvider>
      </body>
    </html>
  )
}
