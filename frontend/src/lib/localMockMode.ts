"use client";

export function isLocalHostRuntime(): boolean {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

export function isLocalMockMode(): boolean {
  if (!isLocalHostRuntime()) return false;
  const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const hasMockFirebaseConfig = !firebaseApiKey || firebaseApiKey === "mock-key-to-prevent-crash";
  return process.env.NEXT_PUBLIC_ALLOW_MOCK_AUTH === "true" || hasMockFirebaseConfig;
}

export function getLocalMockSession() {
  if (typeof window === "undefined") {
    return {
      email: "demo@demo.com",
      token: "mock-demo-token",
      orgId: "demo_org_id",
    };
  }

  const savedMockUser = localStorage.getItem("mock_auth_user") || "demo@demo.com";
  const isDemoUser = savedMockUser === "demo@demo.com";

  return {
    email: savedMockUser,
    token: isDemoUser ? "mock-demo-token" : "mock-dev-token",
    orgId: isDemoUser ? "demo_org_id" : "mock-org-123",
  };
}
