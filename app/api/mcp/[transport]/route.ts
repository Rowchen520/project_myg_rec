import { NextResponse } from "next/server";

const body = {
  error: "not_implemented",
  seeAlso: "/docs/agent/mcp-spec.md"
};

export async function GET() {
  return NextResponse.json(body, { status: 501 });
}

export async function POST() {
  return NextResponse.json(body, { status: 501 });
}
