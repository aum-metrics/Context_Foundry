/**
 * Author: "Sambath Kumar Natarajan"
 * Date: "23-Feb-2026"
 * Org: "AUM Data Labs"
 * Product: "Context Foundry"
 * Description: Next.js Configuration with API Proxy Rewrites for all FastAPI routes.
 */
import type { NextConfig } from "next";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  reactCompiler: true,
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
      { source: "/api/auth/:path*", destination: `${API_BASE}/api/auth/:path*` },
      { source: "/api/health", destination: `${API_BASE}/api/health` },
    ];
  },
};

export default nextConfig;
