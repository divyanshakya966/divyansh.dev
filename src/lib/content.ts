/**
 * Shared content model for the portfolio's dynamic sections.
 *
 * - Certifications: always visible (seeded with your 2 real certs).
 * - Research + Blogs: hidden on the public site until you publish
 *   at least one visible item from /admin.
 *
 * The same shape is stored in D1 (`content_items`) and served via
 * GET /api/content?kind=certification|research|blog.
 */

export const CONTENT_KINDS = ["certification", "research", "blog"] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

export type ContentItem = {
  id: number | string;
  kind: ContentKind;
  title: string;
  /** Issuer / venue / platform line, e.g. "TryHackMe · 2026" */
  subtitle: string;
  description: string;
  /** Verify / credential / article URL */
  url: string;
  image: string;
  tags: string[];
  sort_order: number;
  is_visible: boolean;
  created_at?: number;
  updated_at?: number;
};

export function isContentKind(value: unknown): value is ContentKind {
  return typeof value === "string" && (CONTENT_KINDS as readonly string[]).includes(value);
}

function parseTags(tags: unknown): string[] {
  if (Array.isArray(tags)) return tags.filter((t): t is string => typeof t === "string");
  if (typeof tags === "string") {
    try {
      const parsed: unknown = JSON.parse(tags);
      if (Array.isArray(parsed)) {
        return parsed.filter((t): t is string => typeof t === "string");
      }
    } catch {
      // fall through — treat as comma-separated below
    }
    return tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 24);
  }
  return [];
}

/** Rows come back from D1 with snake_case + integer booleans. */
export function rowToContentItem(row: Record<string, unknown>): ContentItem {
  const kindRaw = row.kind;
  const kind: ContentKind = isContentKind(kindRaw) ? kindRaw : "blog";
  return {
    id: (row.id as number | string) ?? 0,
    kind,
    title: String(row.title ?? ""),
    subtitle: String(row.subtitle ?? ""),
    description: String(row.description ?? ""),
    url: String(row.url ?? ""),
    image: String(row.image ?? ""),
    tags: parseTags(row.tags),
    sort_order: Number(row.sort_order ?? 0),
    is_visible: row.is_visible === 1 || row.is_visible === true,
    created_at: typeof row.created_at === "number" ? row.created_at : undefined,
    updated_at: typeof row.updated_at === "number" ? row.updated_at : undefined,
  };
}

export type ContentInput = {
  kind: ContentKind;
  title: string;
  subtitle?: string;
  description?: string;
  url?: string;
  image?: string;
  tags?: string[];
  sort_order?: number;
  is_visible?: boolean;
};

const MAX_TITLE = 160;
const MAX_SUBTITLE = 160;
const MAX_DESCRIPTION = 4000;
const MAX_URL = 2048;
const MAX_TAGS = 24;
const MAX_TAG_LEN = 48;

function cleanUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")) {
    return trimmed.slice(0, MAX_URL);
  }
  return "";
}

export function validateContentInput(
  input: unknown,
): { ok: true; value: ContentInput } | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Invalid payload" };
  }
  const data = input as Record<string, unknown>;

  if (!isContentKind(data.kind)) {
    return { ok: false, error: "Invalid kind. Use certification, research or blog." };
  }
  const title = typeof data.title === "string" ? data.title.trim() : "";
  if (!title || title.length > MAX_TITLE) {
    return { ok: false, error: "Title is required (max 160 chars)." };
  }

  const subtitle =
    typeof data.subtitle === "string" ? data.subtitle.trim().slice(0, MAX_SUBTITLE) : "";
  const description =
    typeof data.description === "string" ? data.description.trim().slice(0, MAX_DESCRIPTION) : "";
  const url = typeof data.url === "string" ? cleanUrl(data.url) : "";
  const image = typeof data.image === "string" ? cleanUrl(data.image) : "";

  let tags: string[] = [];
  if (data.tags !== undefined) {
    const raw = Array.isArray(data.tags)
      ? data.tags
      : typeof data.tags === "string"
        ? data.tags.split(",")
        : null;
    if (raw === null)
      return { ok: false, error: "Tags must be an array or comma-separated string." };
    tags = raw
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, MAX_TAGS)
      .map((t) => t.slice(0, MAX_TAG_LEN));
  }

  let sort_order = 0;
  if (data.sort_order !== undefined) {
    const n = typeof data.sort_order === "string" ? Number(data.sort_order) : data.sort_order;
    if (typeof n !== "number" || !Number.isFinite(n)) {
      return { ok: false, error: "sort_order must be a number." };
    }
    sort_order = Math.trunc(Math.min(1_000_000, Math.max(-1_000_000, n)));
  }

  const is_visible = data.is_visible === undefined ? true : data.is_visible === true;

  return {
    ok: true,
    value: {
      kind: data.kind,
      title,
      subtitle,
      description,
      url,
      image,
      tags,
      sort_order,
      is_visible,
    },
  };
}

/**
 * Seed certifications — your two real credentials. Served as a fallback
 * when D1 has no visible certifications yet, so the section is never empty.
 */
export const SEED_CERTIFICATIONS: ContentItem[] = [
  {
    id: "seed-thm-sec1",
    kind: "certification",
    title: "Cyber Security 101 (SEC1)",
    subtitle: "TryHackMe · Security Operations",
    description:
      "Core security analyst path covering operating systems fundamentals, network traffic analysis, web application security, security operations, password attacks & credential security, and malware analysis fundamentals.",
    url: "https://assets.tryhackme.com/certification-certificate/6ab109ebefdaccb1c3ac95a3.pdf",
    image: "",
    tags: [
      "OS Fundamentals",
      "Network Analysis",
      "Web App Security",
      "SOC",
      "Password Attacks",
      "Malware Analysis",
    ],
    sort_order: 1,
    is_visible: true,
  },
  {
    id: "seed-lf-lfs16",
    kind: "certification",
    title: "LFS16: Intro to DevOps & Site Reliability Engineering",
    subtitle: "The Linux Foundation · DevOps / SRE",
    description:
      "Foundations of DevOps and SRE: DevOps culture & CI/CD, infrastructure as code, cloud computing, containerization, Kubernetes basics, and site reliability engineering principles.",
    url: "https://ti-user-certificates.s3.us-east-1.amazonaws.com/e0df7fbf-a057-42af-8a1f-590912be5460/261590d6-fe75-4857-b1e2-4dc31d7b1a8c-divyansh-shakya-21b376ed-85e8-41f0-952e-5bcb552ef828-certificate.pdf",
    image: "",
    tags: ["DevOps", "CI/CD", "IaC", "Cloud", "Containers", "Kubernetes", "SRE"],
    sort_order: 2,
    is_visible: true,
  },
];

export function sortContent(items: ContentItem[]): ContentItem[] {
  return [...items].sort(
    (a, b) => a.sort_order - b.sort_order || String(a.id).localeCompare(String(b.id)),
  );
}
