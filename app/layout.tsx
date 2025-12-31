import './globals.css';
import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'History Detector',
    description: 'AI History Detector',
    viewport: {
        width: 'device-width',
        initialScale: 1,
        maximumScale: 1,
        userScalable: false,
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="zh-TW" suppressHydrationWarning>
            <head>


                <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@100;400;700;800&display=swap" rel="stylesheet" />
            </head>
            <body suppressHydrationWarning>
                <div id="root">{children}</div>
            </body>
        </html>
    );
}
