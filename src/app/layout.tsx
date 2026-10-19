import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { profile, SITE_URL } from '@/content';
import './globals.css';

const sans = Geist({ subsets: ['latin'], variable: '--font-sans' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });

const title = `${profile.name} — ${profile.title}`;
const description = `${profile.name}, ${profile.title} (${profile.stack}). 6+ years building production web apps: frontend architecture, performance, CI/CD, multi-brand systems. Based in Portugal.`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  authors: [{ name: profile.name, url: SITE_URL }],
  alternates: { canonical: '/' },
  openGraph: { type: 'profile', url: '/', title, description, siteName: profile.name, locale: 'en_US' },
  twitter: { card: 'summary', title, description },
  robots: { index: true, follow: true },
  verification: { yandex: '66831ef4a1a5e12d' },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#ffffff' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
