import { NextResponse } from "next/server";
import {
  getStoredFeishuDepartmentTreeSnapshot,
  syncFeishuDepartmentTreeSnapshot,
  updateFeishuDepartmentSyncSettings
} from "@/lib/services/feishu-department-tree";
import { toErrorResponse } from "@/lib/services/auth-context";

export async function GET() {
  try {
    const snapshot = await getStoredFeishuDepartmentTreeSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function POST() {
  try {
    const snapshot = await syncFeishuDepartmentTreeSnapshot();

    return NextResponse.json(snapshot);
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { excludedDepartmentIds?: string[] };
    const snapshot = await updateFeishuDepartmentSyncSettings({
      excludedDepartmentIds: Array.isArray(body.excludedDepartmentIds) ? body.excludedDepartmentIds : []
    });

    return NextResponse.json(snapshot);
  } catch (error) {
    const response = toErrorResponse(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}