/**
 * Author: "Sambath Kumar Natarajan"
 * Date: "23-Feb-2026"
 * Org: "AUM Context Foundry"
 * Product: "AUM Context Foundry"
 * Description: Next.js Configuration with API Proxy Rewrites for all FastAPI routes.
 */
import type { NextConfig } from "next";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  eslint: {
    // Lint errors will now fail production builds (enforced in CI too)
    ignoreDuringBuilds: false,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "origin-when-cross-origin" },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https://*.googleusercontent.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://api.razorpay.com; frame-src https://checkout.razorpay.com;"
          }
        ]
      }
    ];
  },
  async rewrites() {
    /**
     * PROXY LOGIC:
     * All /api/* calls from the frontend are proxied to the Python FastAPI backend (Port 8000).
     * This bypasses CORS issues and provides a unified API surface.
     */
    return [
      { source: "/api/simulation/:path*", destination: `${API_BASE}/api/simulation/:path*` },
      { source: "/api/ingestion/:path*", destination: `${API_BASE}/api/ingestion/:path*` },
      { source: "/api/chatbot/:path*", destination: `${API_BASE}/api/chatbot/:path*` },
      { source: "/api/batch/:path*", destination: `${API_BASE}/api/batch/:path*` },
      { source: "/api/seo/:path*", destination: `${API_BASE}/api/seo/:path*` },
      { source: "/api/payments/:path*", destination: `${API_BASE}/api/payments/:path*` },
      { source: "/api/keys/:path*", destination: `${API_BASE}/api/keys/:path*` },
      { source: "/api/competitor/:path*", destination: `${API_BASE}/api/competitor/:path*` },
      { source: "/api/audit/:path*", destination: `${API_BASE}/api/audit/:path*` },
      { source: "/api/workspaces/:path*", destination: `${API_BASE}/api/workspaces/:path*` },
      { source: "/api/methods/:path*", destination: `${API_BASE}/api/methods/:path*` },
      { source: "/api/auth/:path*", destination: `${API_BASE}/api/auth/:path*` },
      { source: "/api/sso/:path*", destination: `${API_BASE}/api/sso/:path*` },
      { source: "/api/health", destination: `${API_BASE}/api/health` },
    ];
  },
};

export default nextConfig;
