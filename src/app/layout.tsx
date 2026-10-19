import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { profile, seo, SITE_URL } from '@/content';
import './globals.css';

const sans = Geist({ subsets: ['latin'], variable: '--font-sans' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: seo.title, template: `%s · ${profile.name}` },
  description: seo.description,
  keywords: seo.keywords,
  applicationName: profile.name,
  authors: [{ name: profile.name, url: SITE_URL }],
  creator: profile.name,
  publisher: profile.name,
  category: 'technology',
  alternates: { canonical: '/' },
  formatDetection: { telephone: false },
  // opengraph-image / twitter-image / icon / apple-icon come from files in this folder.
  openGraph: {
    type: 'profile',
    url: '/',
    siteName: profile.name,
    title: seo.title,
    description: seo.description,
    locale: 'en_US',
    firstName: 'Aleksandr',
    lastName: 'Ovchinnikov',
    username: 'ovchinnikov-lxs',
  },
  twitter: { card: 'summary_large_image', title: seo.title, description: seo.description },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
  },
  verification: { yandex: '66831ef4a1a5e12d' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
