import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from '@vercel/analytics/next';
import { GoogleAnalytics } from '@next/third-parties/google';
import AuthWrapper from "@/components/AuthWrapper";
import { ThemeProvider } from "@/components/ThemeProvider";
import SupportChatbot from "@/components/SupportChatbot";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import BrandCssVars from "@/components/BrandCssVars";
import { tenantConfig } from "@/lib/whitelabel";

export const metadata: Metadata = {
  title: tenantConfig.brandName,
  description: `${tenantConfig.brandName} — AI Search Presence for enterprise teams`,
  icons: {
    icon: [
      { url: tenantConfig.faviconUrl || "/favicon.svg", type: "image/svg+xml" }
    ]
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark transition-colors duration-300" suppressHydrationWarning>
      <body className="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 antialiased min-h-screen selection:bg-cyan-500/30" suppressHydrationWarning>
        <ErrorBoundary>
          <ThemeProvider>
            <AuthWrapper>
              <BrandCssVars />
              {children}
              <SupportChatbot />
              <Analytics />
            </AuthWrapper>
          </ThemeProvider>
        </ErrorBoundary>
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID || "G-PE7HKG5DSM"} />
      </body>
    </html>
  );
}
