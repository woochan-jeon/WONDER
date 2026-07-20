import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getGoogleAuthUrl, isGoogleOAuthConfigured } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/calendar?error=admin_only", request.url));
  }
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.redirect(new URL("/calendar?error=not_configured", request.url));
  }

  return NextResponse.redirect(getGoogleAuthUrl());
}
