import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/components/auth-provider';
import { FirebaseConnectionStatus } from '@/components/firebase-connection-status';
import { suppressReactDevToolsWarning } from '@/utils/suppress-react-devtools-warning';

// Suppress React DevTools warning in development mode
suppressReactDevToolsWarning();

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'StoryTailor',
  description: 'Craft your animated stories with AI',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <AuthProvider>
          <FirebaseConnectionStatus />
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
