export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import * as h_enhanced from "@/lib/api-handlers/queue/enhanced";
import * as h_monitor from "@/lib/api-handlers/queue/monitor";
import * as h_notify from "@/lib/api-handlers/queue/notify";
import * as h_pause from "@/lib/api-handlers/queue/pause";
import * as h_position from "@/lib/api-handlers/queue/position";
import * as h_priority from "@/lib/api-handlers/queue/priority";
import * as h_root from "@/lib/api-handlers/queue/root";
import * as h_walk_in from "@/lib/api-handlers/queue/walk-in";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HandlerFn = (req: NextRequest, ctx: any) => any;
type HandlerModule = Record<string, HandlerFn>;

function matchRoute(segments: string[]): { handler: HandlerModule; params: Record<string, string> } | null {
  if (segments.length === 1 && segments[0] === "enhanced") return { handler: h_enhanced as unknown as HandlerModule, params: {} };
  if (segments.length === 1 && segments[0] === "monitor") return { handler: h_monitor as unknown as HandlerModule, params: {} };
  if (segments.length === 1 && segments[0] === "notify") return { handler: h_notify as unknown as HandlerModule, params: {} };
  if (segments.length === 1 && segments[0] === "pause") return { handler: h_pause as unknown as HandlerModule, params: {} };
  if (segments.length === 1 && segments[0] === "position") return { handler: h_position as unknown as HandlerModule, params: {} };
  if (segments.length === 1 && segments[0] === "priority") return { handler: h_priority as unknown as HandlerModule, params: {} };
  if (segments.length === 1 && segments[0] === "walk-in") return { handler: h_walk_in as unknown as HandlerModule, params: {} };
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

export const GET = handle;
export const POST = handle;
