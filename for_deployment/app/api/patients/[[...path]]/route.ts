export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import * as h_bulk_delete from "@/lib/api-handlers/patients/bulk-delete";
import * as h_export from "@/lib/api-handlers/patients/export";
import * as h_id from "@/lib/api-handlers/patients/id";
import * as h_id_ai_summary from "@/lib/api-handlers/patients/id-ai-summary";
import * as h_id_audit_log from "@/lib/api-handlers/patients/id-audit-log";
import * as h_id_chart_entries from "@/lib/api-handlers/patients/id-chart-entries";
import * as h_id_chart_entries_entryId from "@/lib/api-handlers/patients/id-chart-entries-entryId";
import * as h_id_charts from "@/lib/api-handlers/patients/id-charts";
import * as h_id_charts_versionId from "@/lib/api-handlers/patients/id-charts-versionId";
import * as h_id_consents from "@/lib/api-handlers/patients/id-consents";
import * as h_id_consents_consentId from "@/lib/api-handlers/patients/id-consents-consentId";
import * as h_id_consents_consentId_send_email from "@/lib/api-handlers/patients/id-consents-consentId-send-email";
import * as h_id_coverage_check from "@/lib/api-handlers/patients/id-coverage-check";
import * as h_id_forms_history from "@/lib/api-handlers/patients/id-forms-history";
import * as h_id_notes from "@/lib/api-handlers/patients/id-notes";
import * as h_id_packages from "@/lib/api-handlers/patients/id-packages";
import * as h_id_packages_packageId from "@/lib/api-handlers/patients/id-packages-packageId";
import * as h_id_packages_packageId_items from "@/lib/api-handlers/patients/id-packages-packageId-items";
import * as h_id_packages_packageId_revise from "@/lib/api-handlers/patients/id-packages-packageId-revise";
import * as h_id_patient_payments from "@/lib/api-handlers/patients/id-patient-payments";
import * as h_id_procedures from "@/lib/api-handlers/patients/id-procedures";
import * as h_id_profile_picture from "@/lib/api-handlers/patients/id-profile-picture";
import * as h_id_records from "@/lib/api-handlers/patients/id-records";
import * as h_id_records_export from "@/lib/api-handlers/patients/id-records-export";
import * as h_id_send_form from "@/lib/api-handlers/patients/id-send-form";
import * as h_id_smart_upload from "@/lib/api-handlers/patients/id-smart-upload";
import * as h_id_smart_upload_uploadId from "@/lib/api-handlers/patients/id-smart-upload-uploadId";
import * as h_id_smart_upload_uploadId_save_to_records from "@/lib/api-handlers/patients/id-smart-upload-uploadId-save-to-records";
import * as h_id_smart_upload_uploadId_ocr from "@/lib/api-handlers/patients/id-smart-upload-uploadId-ocr";
import * as h_id_stats from "@/lib/api-handlers/patients/id-stats";
import * as h_id_timeline from "@/lib/api-handlers/patients/id-timeline";
import * as h_id_treatment_flow from "@/lib/api-handlers/patients/id-treatment-flow";
import * as h_id_treatment_plans from "@/lib/api-handlers/patients/id-treatment-plans";
import * as h_id_treatment_plans_planId from "@/lib/api-handlers/patients/id-treatment-plans-planId";
import * as h_id_visits from "@/lib/api-handlers/patients/id-visits";
import * as h_id_visits_visitId from "@/lib/api-handlers/patients/id-visits-visitId";
import * as h_id_workflow_status from "@/lib/api-handlers/patients/id-workflow-status";
import * as h_match from "@/lib/api-handlers/patients/match";
import * as h_root from "@/lib/api-handlers/patients/root";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HandlerFn = (req: NextRequest, ctx: any) => any;
type HandlerModule = Record<string, HandlerFn>;

function matchRoute(segments: string[]): { handler: HandlerModule; params: Record<string, string> } | null {
  if (segments.length === 4 && segments[1] === "consents" && segments[3] === "send-email") return { handler: h_id_consents_consentId_send_email as unknown as HandlerModule, params: { id: segments[0], consentId: segments[2] } };
  if (segments.length === 4 && segments[1] === "packages" && segments[3] === "items") return { handler: h_id_packages_packageId_items as unknown as HandlerModule, params: { id: segments[0], packageId: segments[2] } };
  if (segments.length === 4 && segments[1] === "packages" && segments[3] === "revise") return { handler: h_id_packages_packageId_revise as unknown as HandlerModule, params: { id: segments[0], packageId: segments[2] } };
  if (segments.length === 4 && segments[1] === "smart-upload" && segments[3] === "save-to-records") return { handler: h_id_smart_upload_uploadId_save_to_records as unknown as HandlerModule, params: { id: segments[0], uploadId: segments[2] } };
  if (segments.length === 4 && segments[1] === "smart-upload" && segments[3] === "ocr") return { handler: h_id_smart_upload_uploadId_ocr as unknown as HandlerModule, params: { id: segments[0], uploadId: segments[2] } };
  if (segments.length === 3 && segments[1] === "records" && segments[2] === "export") return { handler: h_id_records_export as unknown as HandlerModule, params: { id: segments[0] } };
  if (segments.length === 3 && segments[1] === "charts") return { handler: h_id_charts_versionId as unknown as HandlerModule, params: { id: segments[0], versionId: segments[2] } };
  if (segments.length === 3 && segments[1] === "consents") return { handler: h_id_consents_consentId as unknown as HandlerModule, params: { id: segments[0], consentId: segments[2] } };
  if (segments.length === 3 && segments[1] === "packages") return { handler: h_id_packages_packageId as unknown as HandlerModule, params: { id: segments[0], packageId: segments[2] } };
  if (segments.length === 3 && segments[1] === "smart-upload") return { handler: h_id_smart_upload_uploadId as unknown as HandlerModule, params: { id: segments[0], uploadId: segments[2] } };
  if (segments.length === 3 && segments[1] === "treatment-plans") return { handler: h_id_treatment_plans_planId as unknown as HandlerModule, params: { id: segments[0], planId: segments[2] } };
  if (segments.length === 3 && segments[1] === "visits") return { handler: h_id_visits_visitId as unknown as HandlerModule, params: { id: segments[0], visitId: segments[2] } };
  if (segments.length === 2 && segments[1] === "ai-summary") return { handler: h_id_ai_summary as unknown as HandlerModule, params: { id: segments[0] } };
  if (segments.length === 2 && segments[1] === "audit-log") return { handler: h_id_audit_log as unknown as HandlerModule, params: { id: segments[0] } };
  if (segments.length === 2 && segments[1] === "chart-entries") return { handler: h_id_chart_entries as unknown as HandlerModule, params: { id: segments[0] } };
  if (segments.length === 3 && segments[1] === "chart-entries") return { handler: h_id_chart_entries_entryId as unknown as HandlerModule, params: { id: segments[0], entryId: segments[2] } };
  if (segments.length === 2 && segments[1] === "charts") return { handler: h_id_charts as unknown as HandlerModule, params: { id: segments[0] } };
  if (segments.length === 2 && segments[1] === "consents") return { handler: h_id_consents as unknown as HandlerModule, params: { id: segments[0] } };
  if (segments.length === 2 && segments[1] === "coverage-check") return { handler: h_id_coverage_check as unknown as HandlerModule, params: { id: segments[0] } };
  if (segments.length === 2 && segments[1] === "forms-history") return { handler: h_id_forms_history as unknown as HandlerModule, params: { id: segments[0] } };
  if (segments.length === 2 && segments[1] === "notes") return { handler: h_id_notes as unknown as HandlerModule, params: { id: segments[0] } };
  if (segments.length === 2 && segments[1] === "packages") return { handler: h_id_packages as unknown as HandlerModule, params: { id: segments[0] } };
  if (segments.length === 2 && segments[1] === "patient-payments") return { handler: h_id_patient_payments as unknown as HandlerModule, params: { id: segments[0] } };
  if (segments.length === 2 && segments[1] === "procedures") return { handler: h_id_procedures as unknown as HandlerModule, params: { id: segments[0] } };
  if (segments.length === 2 && segments[1] === "profile-picture") return { handler: h_id_profile_picture as unknown as HandlerModule, params: { id: segments[0] } };
  if (segments.length === 2 && segments[1] === "records") return { handler: h_id_records as unknown as HandlerModule, params: { id: segments[0] } };
  if (segments.length === 2 && segments[1] === "send-form") return { handler: h_id_send_form as unknown as HandlerModule, params: { id: segments[0] } };
  if (segments.length === 2 && segments[1] === "smart-upload") return { handler: h_id_smart_upload as unknown as HandlerModule, params: { id: segments[0] } };
  if (segments.length === 2 && segments[1] === "stats") return { handler: h_id_stats as unknown as HandlerModule, params: { id: segments[0] } };
  if (segments.length === 2 && segments[1] === "timeline") return { handler: h_id_timeline as unknown as HandlerModule, params: { id: segments[0] } };
  if (segments.length === 2 && segments[1] === "treatment-flow") return { handler: h_id_treatment_flow as unknown as HandlerModule, params: { id: segments[0] } };
  if (segments.length === 2 && segments[1] === "treatment-plans") return { handler: h_id_treatment_plans as unknown as HandlerModule, params: { id: segments[0] } };
  if (segments.length === 2 && segments[1] === "visits") return { handler: h_id_visits as unknown as HandlerModule, params: { id: segments[0] } };
  if (segments.length === 2 && segments[1] === "workflow-status") return { handler: h_id_workflow_status as unknown as HandlerModule, params: { id: segments[0] } };
  if (segments.length === 1 && segments[0] === "bulk-delete") return { handler: h_bulk_delete as unknown as HandlerModule, params: {} };
  if (segments.length === 1 && segments[0] === "export") return { handler: h_export as unknown as HandlerModule, params: {} };
  if (segments.length === 1 && segments[0] === "match") return { handler: h_match as unknown as HandlerModule, params: {} };
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
