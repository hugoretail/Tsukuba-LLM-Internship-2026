import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "jisho-ultime-api",
    timestamp: new Date().toISOString(),
  });
}

