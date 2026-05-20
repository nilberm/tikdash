import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787";

  // Constrói a URL de redirecionamento para o backend Hono que completa o fluxo OAuth
  const redirectUrl = new URL(`${apiUrl}/tiktok/callback`);
  
  if (code) redirectUrl.searchParams.set("code", code);
  if (state) redirectUrl.searchParams.set("state", state);
  if (error) redirectUrl.searchParams.set("error", error);
  if (errorDescription) redirectUrl.searchParams.set("error_description", errorDescription);

  console.log(`[Next.js Callback Proxy] Redirecionando OAuth do TikTok para a API: ${redirectUrl.toString()}`);
  return NextResponse.redirect(redirectUrl.toString());
}
