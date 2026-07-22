import { NextRequest, NextResponse } from "next/server";
import { getSlackAuthUrl, isSlackConfigured } from "@/lib/slack";

export async function GET(request: NextRequest) {
  if (!isSlackConfigured()) {
    return NextResponse.redirect(new URL("/tasks?slackError=not_configured", request.url));
  }

  return NextResponse.redirect(getSlackAuthUrl());
}
