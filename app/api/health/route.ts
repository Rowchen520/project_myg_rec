import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "project-myg",
    timestamp: new Date().toISOString()
  });
}
