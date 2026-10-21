import type { Metadata } from "next";
import Script from "next/script";
import { AppContextProvider } from "@/contexts/AppContext";
import { SocketProvider } from "@/contexts/SocketContext";
import "@/styles/globals.css";
import AuthProvider from "@/providers/AuthProvider";

// Honest structured data (no fabricated ratings). Emitted via next/script with
// an application/ld+json type rather than dangerouslySetInnerHTML.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "SpriteForge",
  description:
    "Web platform for testing, previewing, and fine-tuning sprite-sheet animations in real-time.",
  url: "https://spriteforge.garcessebastian.com",
  applicationCategory: "GameApplication",
  operatingSystem: "Web Browser",
  browserRequirements: "HTML5 Canvas support, JavaScript enabled",
  softwareVersion: "0.1.0",
  author: { "@type": "Person", name: "Sebxstt" },
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  },
};

export const metadata: Metadata = {
  title: 'SpriteForge - Advanced Sprite Animation Testing Platform',
  description: 'Professional web platform for testing, previewing, and fine-tuning sprite animations in real-time. Perfect for game developers, animators, and digital artists. Test multiple sprites, control animations, and debug with precision.',
  keywords: [
    // English
    'sprite animation',
    'game development',
    'animation testing',
    'sprite sheets',
    'pixel art',
    'game assets',
    'animation preview',
    'sprite editor',
    'game tools',
    'animation tools',
    'sprite debugging',
    'frame animation',
    'character animation',
    'sprite controller',
    'animation playground',
    'sprite sheet tester',
    'online sprite viewer',
    'sprite animation tool online',
    '2d animation software',
    'test sprite animation online',
    'sprite previewer',
    'web-based sprite editor',
    'sprite animation platform',
    'real-time animation testing',

    // Spanish
    'animación de sprites',
    'desarrollo de videojuegos',
    'probar animación de sprites',
    'hojas de sprites',
    'arte pixelado',
    'assets para juegos',
    'previsualizar animación',
    'editor de sprites',
    'herramientas para juegos',
    'herramientas de animación',
    'depurar sprites',
    'animación por fotogramas',
    'animación de personajes',
    'controlador de sprites',
    'testear animaciones',
    'plataforma de animación de sprites',
    'probar animaciones en tiempo real',
    'editor de sprites online',
    'visor de sprites online',
    'herramienta para animar sprites'
  ],
  authors: [{ name: 'Sebxstt' }],
  creator: 'Sebxstt',
  publisher: 'Sebxstt',
  metadataBase: new URL('https://spriteforge.garcessebastian.com'),
  openGraph: {
    title: 'SpriteForge - Advanced Sprite Animation Testing Platform',
    description: 'Professional web platform for testing, previewing, and fine-tuning sprite animations in real-time. Perfect for game developers, animators, and digital artists.',
    url: 'https://spriteforge.garcessebastian.com',
    siteName: 'SpriteForge',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        alt: 'SpriteForge - Sprite Animation Testing Platform',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SpriteForge - Advanced Sprite Animation Testing Platform',
    description: 'Professional web platform for testing, previewing, and fine-tuning sprite animations in real-time. Perfect for game developers, animators, and digital artists.',
    images: ['/logo.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  category: 'technology',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#3B82F6' },
    { media: '(prefers-color-scheme: dark)', color: '#1E40AF' },
  ],
  appleWebApp: {
    title: 'SpriteForge',
    statusBarStyle: 'black-translucent',
    capable: true,
  },
  applicationName: 'SpriteForge',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-gray-900">
      <head>
        <meta name="google-site-verification" content="BT6A1CYMlT549EKMmzXOaKlJkD7C7MST2SNmGmQmj5c" />
        <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <Script
          id="structured-data"
          type="application/ld+json"
          strategy="beforeInteractive"
        >
          {JSON.stringify(jsonLd)}
        </Script>
      </head>
      <body className="h-full overflow-hidden antialiased">
        <AuthProvider>
          <SocketProvider>
            <AppContextProvider>
              {children}
            </AppContextProvider>
          </SocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
