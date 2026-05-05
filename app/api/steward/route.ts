import { NextResponse } from "next/server";
import { loadWorkspaceSnapshot } from "@/lib/services/workspace";
import { buildStewardReport, generateStewardMessages } from "@/lib/steward";

export async function GET() {
  const { snapshot, source, warning } = await loadWorkspaceSnapshot();

  return NextResponse.json({
    source,
    warning,
    report: buildStewardReport(snapshot),
    messages: generateStewardMessages(snapshot)
  });
}
