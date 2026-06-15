import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Analytics } from '@vercel/analytics/next';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ServiceWorker } from '@/components/ServiceWorker';

export const metadata: Metadata = {
  title: 'RideTogether — Live Group Ride Tracking',
  description:
    'Share one live map with your whole group. Create a ride, send the link, and everyone appears on the map — no app install required.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RideTogether',
  },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
};

export const viewport: Viewport = {
  themeColor: '#175cf5',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inline theme bootstrap to avoid flash of incorrect theme. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('rt-theme');var d=t? t==='dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
        <ServiceWorker />
        <Analytics />
      </body>
    </html>
  );
}
