import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Analytics } from '@vercel/analytics/next';
import AuthWrapper from "@/components/AuthWrapper";
import { ThemeProvider } from "@/components/ThemeProvider";
import SupportChatbot from "@/components/SupportChatbot";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AUM Context Foundry",
  description: "AUM Context Foundry — Generative Engine Optimization (GEO) for the Agentic Web",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark transition-colors duration-300" suppressHydrationWarning>
      <body className={`${inter.className} bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 antialiased min-h-screen selection:bg-cyan-500/30`} suppressHydrationWarning>
        <ErrorBoundary>
          <ThemeProvider>
            <AuthWrapper>
              {children}
              <SupportChatbot />
              <Analytics />
            </AuthWrapper>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}