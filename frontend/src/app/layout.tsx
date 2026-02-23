import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Analytics } from '@vercel/analytics/next';
import AuthWrapper from "@/components/AuthWrapper";
import { ThemeProvider } from "@/components/ThemeProvider";
import SupportChatbot from "@/components/SupportChatbot";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AUM Context Foundry",
  description: "Generative Engine Optimization (GEO) & Agentic Commerce Protocol",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark transition-colors duration-300">
      <body className={`${inter.className} bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-200 antialiased min-h-screen selection:bg-cyan-500/30`}>
        <ThemeProvider>
          <AuthWrapper>
            {children}
            <SupportChatbot />
            <Analytics />
          </AuthWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}