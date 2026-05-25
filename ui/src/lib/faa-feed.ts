/**
 * Federal Register API client for recent FAA Airworthiness Directives.
 *
 * Public, no auth. We pull the latest FAA RULE-type documents and
 * filter to those whose title contains "airworthiness directive"
 * (case-insensitive). ADs are by far the most common FAA rule type
 * but the Federal Register feed also includes operating-rule updates,
 * delegations, etc., which we want to exclude here.
 *
 * Each AD is mapped onto the reviewer's CertificationChange shape so
 * the existing review pipeline can read it without modification. The
 * numerical / boolean risk fields don't have direct analogues in the
 * Federal Register payload — the AD prose is what the reviewer is
 * actually meant to read — so they get conservative defaults.
 *
 * Cached for 6h via Next's `revalidate`. ADs publish daily at most;
 * staleness on that horizon is well within acceptable for a demo.
 */

import type { CertificationChange } from "./aviation-scenario";

const FED_REGISTER_API = "https://www.federalregister.gov/api/v1/documents.json";

/** A single AD trimmed down to the fields the UI actually displays. */
export interface FaaAirworthinessDirective {
  documentNumber: string;
  title: string;
  abstract: string;
  publicationDate: string;
  effectiveDate: string;
  htmlUrl: string;
  /** Aircraft family / make extracted from the title (best-effort). */
  aircraftFamily: string;
}

/** Live AD wrapped with the reviewer's input shape. */
export interface LiveAirworthinessDirective {
  documentNumber: string;
  htmlUrl: string;
  publicationDate: string;
  effectiveDate: string;
  title: string;
  abstract: string;
  aircraftFamily: string;
  /** The same CertificationChange the four synthetic presets produce. */
  change: CertificationChange;
}

/** Raw Federal Register document fields we care about. The API returns
 *  many more fields; declared loosely so we don't tie ourselves to
 *  schema changes we don't depend on. */
interface FederalRegisterDocument {
  title?: string;
  abstract?: string | null;
  publication_date?: string;
  effective_on?: string | null;
  html_url?: string;
  document_number?: string;
  type?: string;
}

interface FederalRegisterResponse {
  results?: FederalRegisterDocument[];
}

/** Build the FR query URL. Kept as a function so tests / callers can
 *  override per_page without touching the rest. */
function buildUrl(perPage: number): string {
  const params = new URLSearchParams();
  params.append("conditions[agencies][]", "federal-aviation-administration");
  params.append("conditions[type][]", "RULE");
  params.append("order", "newest");
  params.append("per_page", String(perPage));
  return `${FED_REGISTER_API}?${params.toString()}`;
}

/** Federal Register titles look like:
 *    "Airworthiness Directives; The Boeing Company Airplanes"
 *    "Airworthiness Directives; Airbus SAS Airplanes"
 *    "Airworthiness Directives; Various Restricted Category Helicopters"
 *  After the semicolon is a free-text manufacturer / model phrase. We
 *  return that, trimmed to a reasonable length. Falls back to "" if no
 *  semicolon is present. */
function extractAircraftFamily(title: string): string {
  const idx = title.indexOf(";");
  if (idx < 0) return "";
  const rest = title.slice(idx + 1).trim();
  // Drop a trailing "Airplanes" / "Helicopters" if it makes the string
  // shorter and clearer. Keep it if it's the only word.
  return rest.slice(0, 120);
}

/** True if the document is an Airworthiness Directive based on title. */
function isAirworthinessDirective(doc: FederalRegisterDocument): boolean {
  const t = (doc.title ?? "").toLowerCase();
  return t.includes("airworthiness directive");
}

function buildCalldataSummary(ad: {
  documentNumber: string;
  effectiveDate: string;
  publicationDate: string;
  htmlUrl: string;
  abstract: string;
}): string {
  const effective = ad.effectiveDate || "not specified";
  const published = ad.publicationDate || "not specified";
  return [
    `Federal Register Airworthiness Directive ${ad.documentNumber}.`,
    `Published ${published}. Effective ${effective}.`,
    `Full rule text at ${ad.htmlUrl}.`,
    "",
    "Abstract (as filed by the FAA):",
    ad.abstract || "(no abstract published)",
  ].join("\n");
}

/** Derive a stable numeric id from the document number ("2026-12345").
 *  Falls back to FNV-1a if the document number isn't strictly numeric. */
function changeIdFromDocumentNumber(documentNumber: string): number {
  const digits = documentNumber.replace(/[^0-9]/g, "");
  if (digits.length > 0 && digits.length <= 9) {
    return Number(digits);
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < documentNumber.length; i++) {
    h ^= documentNumber.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Map a Federal Register AD onto our CertificationChange shape.
 *
 *  The AD prose is the load-bearing input — the reviewer is meant to
 *  read it and reason. The numeric / boolean fields don't have an
 *  obvious analogue in the AD payload (the Federal Register doesn't
 *  publish "primary trigger sensor count" or "can override pilot
 *  input"). We give them conservative, non-misleading defaults:
 *    - canActuateFlightControls: false (we can't tell from prose)
 *    - primaryTriggerSensorCount: 0 (unknown, not 1 — don't fake MCAS-shape)
 *    - canOverridePilotInput: false (unknown)
 *    - proposedTrainingClass: "none" (ADs usually mandate maintenance, not training)
 *    - disclosedInFCOM: true (ADs ARE the disclosure)
 *    - similarChangesRequiredSimAfterEvents: 0
 *    - fleetSize: 0 (FR doesn't publish this in the doc payload)
 */
function mapAdToChange(ad: FaaAirworthinessDirective): CertificationChange {
  return {
    changeId: changeIdFromDocumentNumber(ad.documentNumber),
    aircraftModel: ad.aircraftFamily || "see AD text",
    title: ad.title,
    summary: ad.abstract || "No abstract published with this AD.",
    technicalSummary: buildCalldataSummary(ad),
    canActuateFlightControls: false,
    primaryTriggerSensorCount: 0,
    canOverridePilotInput: false,
    proposedTrainingClass: "none",
    disclosedInFCOM: true,
    similarChangesRequiredSimAfterEvents: 0,
    fleetSize: 0,
  };
}

/** Fetch the most recent FAA Airworthiness Directives from the
 *  Federal Register and return them mapped onto the reviewer's
 *  input shape. */
export async function fetchRecentADs(
  limit: number = 6,
): Promise<LiveAirworthinessDirective[]> {
  // Pull more than we need; we'll filter by title to AD-only.
  const fetchSize = Math.max(limit * 4, 20);
  const res = await fetch(buildUrl(fetchSize), {
    headers: {
      accept: "application/json",
      "user-agent":
        "TheseusOraclePoC/1.0 (+https://theseus.network) AviationSafety-live",
    },
    next: { revalidate: 60 * 60 * 6 }, // 6h server cache
  });
  if (!res.ok) {
    throw new Error(`federal-register ${res.status}`);
  }
  const json = (await res.json()) as FederalRegisterResponse;
  const docs = json.results ?? [];
  const ads: LiveAirworthinessDirective[] = [];
  for (const d of docs) {
    if (!isAirworthinessDirective(d)) continue;
    if (!d.title || !d.document_number || !d.html_url) continue;
    const ad: FaaAirworthinessDirective = {
      documentNumber: d.document_number,
      title: d.title,
      abstract: d.abstract ?? "",
      publicationDate: d.publication_date ?? "",
      effectiveDate: d.effective_on ?? "",
      htmlUrl: d.html_url,
      aircraftFamily: extractAircraftFamily(d.title),
    };
    ads.push({
      ...ad,
      change: mapAdToChange(ad),
    });
    if (ads.length >= limit) break;
  }
  return ads;
}
