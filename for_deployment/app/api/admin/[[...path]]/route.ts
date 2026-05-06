export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import * as h_audit_log from "@/lib/api-handlers/admin/audit-log";
import * as h_insights from "@/lib/api-handlers/admin/insights";
import * as h_migration from "@/lib/api-handlers/admin/migration";
import * as h_modules from "@/lib/api-handlers/admin/modules";
import * as h_modules_features from "@/lib/api-handlers/admin/modules-features";
import * as h_modules_toggle from "@/lib/api-handlers/admin/modules-toggle";
import * as h_services from "@/lib/api-handlers/admin/services";
import * as h_services_image_preview from "@/lib/api-handlers/admin/services-image-preview";
import * as h_services_upload_image from "@/lib/api-handlers/admin/services-upload-image";
import * as h_users from "@/lib/api-handlers/admin/users";
import * as h_announcements from "@/lib/api-handlers/admin/announcements";
import * as h_announcements_id from "@/lib/api-handlers/admin/announcements-id";
import * as h_announcements_upload_image from "@/lib/api-handlers/admin/announcements-upload-image";
import * as h_branding_upload from "@/lib/api-handlers/admin/branding-upload";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HandlerFn = (req: NextRequest, ctx: any) => any;
type HandlerModule = Record<string, HandlerFn>;

function matchRoute(segments: string[]): { handler: HandlerModule; params: Record<string, string> } | null {
  if (segments.length === 2 && segments[0] === "announcements" && segments[1] === "upload-image") return { handler: h_announcements_upload_image as unknown as HandlerModule, params: {} };
  if (segments.length === 2 && segments[0] === "announcements" && segments[1] !== "upload-image") return { handler: h_announcements_id as unknown as HandlerModule, params: { id: segments[1] } };
  if (segments.length === 2 && segments[0] === "branding" && segments[1] === "upload") return { handler: h_branding_upload as unknown as HandlerModule, params: {} };
  if (segments.length === 2 && segments[0] === "modules" && segments[1] === "features") return { handler: h_modules_features as unknown as HandlerModule, params: {} };
  if (segments.length === 2 && segments[0] === "modules" && segments[1] === "toggle") return { handler: h_modules_toggle as unknown as HandlerModule, params: {} };
  if (segments.length === 2 && segments[0] === "services" && segments[1] === "image-preview") return { handler: h_services_image_preview as unknown as HandlerModule, params: {} };
  if (segments.length === 2 && segments[0] === "services" && segments[1] === "upload-image") return { handler: h_services_upload_image as unknown as HandlerModule, params: {} };
  if (segments.length === 1 && segments[0] === "announcements") return { handler: h_announcements as unknown as HandlerModule, params: {} };
  if (segments.length === 1 && segments[0] === "audit-log") return { handler: h_audit_log as unknown as HandlerModule, params: {} };
  if (segments.length === 1 && segments[0] === "insights") return { handler: h_insights as unknown as HandlerModule, params: {} };
  if (segments.length === 1 && segments[0] === "migration") return { handler: h_migration as unknown as HandlerModule, params: {} };
  if (segments.length === 1 && segments[0] === "modules") return { handler: h_modules as unknown as HandlerModule, params: {} };
  if (segments.length === 1 && segments[0] === "services") return { handler: h_services as unknown as HandlerModule, params: {} };
  if (segments.length === 1 && segments[0] === "users") return { handler: h_users as unknown as HandlerModule, params: {} };
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
