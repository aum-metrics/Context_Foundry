/**
 * Author: "Sambath Kumar Natarajan"
 * Date: "26-Dec-2025"
 * Org: " Start-up/AUM Data Labs"
 * Product: "Context Foundry"
 * Description: Next.js Configuration with API Proxy Rewrites.
 */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    /**
     * PROXY LOGIC:
     * We map the frontend API routes to the Python FastAPI backend (Port 8000).
     * This bypasses CORS issues and allows for a unified API interface.
     */
    return [
      {
        source: '/api/simulation/:path*',
        destination: 'http://127.0.0.1:8000/api/simulation/:path*'
      },
      {
        source: '/api/ingestion/:path*',
        destination: 'http://127.0.0.1:8000/api/ingestion/:path*'
      }
    ];
  }
};

export default nextConfig;
