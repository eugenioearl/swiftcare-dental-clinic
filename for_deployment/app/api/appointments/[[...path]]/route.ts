export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import * as h_available_slots from "@/lib/api-handlers/appointments/available-slots";
import * as h_generate_checkin_token from "@/lib/api-handlers/appointments/generate-checkin-token";
import * as h_id from "@/lib/api-handlers/appointments/id";
import * as h_id_calendar from "@/lib/api-handlers/appointments/id-calendar";
import * as h_id_qr_code from "@/lib/api-handlers/appointments/id-qr-code";
import * as h_id_readiness from "@/lib/api-handlers/appointments/id-readiness";
import * as h_id_status from "@/lib/api-handlers/appointments/id-status";
import * as h_pending from "@/lib/api-handlers/appointments/pending";
import * as h_recent_checkins from "@/lib/api-handlers/appointments/recent-checkins";
import * as h_root from "@/lib/api-handlers/appointments/root";
import * as h_verify_checkin from "@/lib/api-handlers/appointments/verify-checkin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HandlerFn = (req: NextRequest, ctx: any) => any;
type HandlerModule = Record<string, HandlerFn>;

function matchRoute(segments: string[]): { handler: HandlerModule; params: Record<string, string> } | null {
  if (segments.length === 2 && segments[1] === "calendar") return { handler: h_id_calendar as unknown as HandlerModule, params: { id: segments[0] } };
  if (segments.length === 2 && segments[1] === "qr-code") return { handler: h_id_qr_code as unknown as HandlerModule, params: { id: segments[0] } };
  if (segments.length === 2 && segments[1] === "readiness") return { handler: h_id_readiness as unknown as HandlerModule, params: { id: segments[0] } };
  if (segments.length === 2 && segments[1] === "status") return { handler: h_id_status as unknown as HandlerModule, params: { id: segments[0] } };
  if (segments.length === 1 && segments[0] === "available-slots") return { handler: h_available_slots as unknown as HandlerModule, params: {} };
  if (segments.length === 1 && segments[0] === "generate-checkin-token") return { handler: h_generate_checkin_token as unknown as HandlerModule, params: {} };
  if (segments.length === 1 && segments[0] === "pending") return { handler: h_pending as unknown as HandlerModule, params: {} };
  if (segments.length === 1 && segments[0] === "recent-checkins") return { handler: h_recent_checkins as unknown as HandlerModule, params: {} };
  if (segments.length === 1 && segments[0] === "verify-checkin") return { handler: h_verify_checkin as unknown as HandlerModule, params: {} };
  if (segments.length === 1) return { handler: h_id as unknown as HandlerModule, params: { id: segments[0] } };
  if (segments.length === 0) return { handler: h_root as unknown as HandlerModule, params: {} };
  return null;
}

async function handle(req: NextRequest, { params: rawParams }: { params: Promise<{ path?: string[] }> }) {
  const resolved = await rawParams;
  const segments = resolved?.path || [];
  const matched = matchRoute(segments);
  if (!matched) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const method = req.method;
  const fn = matched.handler[method];
  if (!fn) return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  return fn(req, { params: matched.params });
}

export const DELETE = handle;
export const GET = handle;
export const PATCH = handle;
export const POST = handle;
export const PUT = handle;
