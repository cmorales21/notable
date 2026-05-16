import type { Metadata } from "next";
import { playfair, dmSans, climateCrisis } from "./fonts";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import ErrorBoundary from "./components/ErrorBoundary";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL('https://notable-one-xi.vercel.app'),
  title: {
    default: 'Notable',
    template: '%s',
  },
  description: 'Get in, get inspired, go live your life.',
  openGraph: {
    siteName: 'Notable',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${dmSans.variable} ${climateCrisis.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ErrorBoundary>{children}</ErrorBoundary>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
