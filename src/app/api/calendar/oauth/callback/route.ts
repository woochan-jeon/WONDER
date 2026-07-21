import { NextRequest, NextResponse } from "next/server";
import { saveConnectionFromCode } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(new URL(`/calendar?error=${encodeURIComponent(error)}`, request.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/calendar?error=missing_code", request.url));
  }

  try {
    await saveConnectionFromCode(code);
  } catch (err) {
    console.error("Google Calendar OAuth callback failed:", err);
    return NextResponse.redirect(new URL("/calendar?error=token_exchange_failed", request.url));
  }

  return NextResponse.redirect(new URL("/calendar?connected=1", request.url));
}
