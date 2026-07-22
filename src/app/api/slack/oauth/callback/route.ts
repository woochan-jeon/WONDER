import { NextRequest, NextResponse } from "next/server";
import { saveSlackConnectionFromCode } from "@/lib/slack";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(new URL(`/tasks?slackError=${encodeURIComponent(error)}`, request.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/tasks?slackError=missing_code", request.url));
  }

  try {
    await saveSlackConnectionFromCode(code);
  } catch (err) {
    console.error("Slack OAuth callback failed:", err);
    return NextResponse.redirect(new URL("/tasks?slackError=token_exchange_failed", request.url));
  }

  return NextResponse.redirect(new URL("/tasks?slackConnected=1", request.url));
}
