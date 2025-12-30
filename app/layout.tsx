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
        <html lang="en">
            <head>
                <script src="https://cdn.tailwindcss.com"></script>
                <script
                    type="importmap"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify({
                            imports: {
                                "react": "https://aistudiocdn.com/react@^19.2.0",
                                "react/": "https://aistudiocdn.com/react@^19.2.0/",
                                "lucide-react": "https://aistudiocdn.com/lucide-react@^0.555.0",
                                "react-dom/": "https://aistudiocdn.com/react-dom@^19.2.0/",
                                "@google/genai": "https://aistudiocdn.com/@google/genai@^1.30.0"
                            }
                        }, null, 2)
                    }}
                />
            </head>
            <body>
                <div id="root">{children}</div>
            </body>
        </html>
    );
}
