import { NextRequest, NextResponse } from "next/server";
import { getGoogleAuthUrl, isGoogleOAuthConfigured } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.redirect(new URL("/calendar?error=not_configured", request.url));
  }

  return NextResponse.redirect(getGoogleAuthUrl());
}
