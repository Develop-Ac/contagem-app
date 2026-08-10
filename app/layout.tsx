import type { Metadata, Viewport } from 'next';
import { AppProviders } from '@/components/AppProviders';
import './globals.css';

export const metadata: Metadata = {
    title: 'Sistema de Contagem',
    description: 'Aplicativo de contagem de estoque da AC Acessórios.',
    manifest: '/manifest.json',
    applicationName: 'Contagem',
    icons: {
        icon: '/icons/icon-192x192.png',
        apple: '/icons/icon-192x192.png',
    },
    appleWebApp: {
        capable: true,
        title: 'Contagem',
        statusBarStyle: 'black-translucent',
    },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    themeColor: '#3067C5',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
    return (
        <html lang="pt-BR">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons" />
            </head>
            <body>
                <AppProviders>{children}</AppProviders>
            </body>
        </html>
    );
}
