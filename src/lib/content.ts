/**
 * Shared content model for every portfolio section the admin controls.
 *
 * - List sections (certifications, projects, experience, achievements,
 *   skills, about, building): always visible while they hold ≥1 visible
 *   item; seeded with the current site content so the portfolio never
 *   goes empty. Once D1 rows exist for a kind, D1 is the source of truth
 *   (hiding everything hides the section — seeds never resurrect).
 * - Conditional sections (research, blogs): hidden until ≥1 visible item.
 *
 * Kind-specific extras live in `meta` (project demo URL + long text,
 * experience dates, icon names, building card lines/stats). Served via
 * GET /api/content?kind=… and managed from /admin.
 */

export const CONTENT_KINDS = [
  "certification",
  "research",
  "blog",
  "project",
  "experience",
  "achievement",
  "skill",
  "about",
  "building",
] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

export type ContentItem = {
  id: number | string;
  kind: ContentKind;
  title: string;
  /** Issuer / venue / platform / tag line, per-kind documented in docs. */
  subtitle: string;
  description: string;
  /** Primary URL (verify link, repo, article…). */
  url: string;
  image: string;
  tags: string[];
  /** Kind-specific extras, e.g. { long, demo } for projects. */
  meta: Record<string, unknown>;
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
      // not JSON — fall through to comma-separated parsing below
    }
    return tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 24);
  }
  return [];
}

export function parseMeta(meta: unknown): Record<string, unknown> {
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    return meta as Record<string, unknown>;
  }
  if (typeof meta === "string" && meta.trim()) {
    try {
      const parsed: unknown = JSON.parse(meta);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // not a JSON object — fall through to {}
    }
  }
  return {};
}

export function metaString(meta: unknown): string {
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    const entries = Object.entries(meta as Record<string, unknown>);
    if (entries.length === 0) return "";
  }
  return JSON.stringify(meta ?? {});
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
    meta: parseMeta(row.meta),
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
  meta?: Record<string, unknown>;
  sort_order?: number;
  is_visible?: boolean;
};

const MAX_TITLE = 160;
const MAX_SUBTITLE = 160;
const MAX_DESCRIPTION = 4000;
const MAX_URL = 2048;
const MAX_TAGS = 24;
const MAX_TAG_LEN = 48;
const MAX_META_LEN = 4000;

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
    return { ok: false, error: `Invalid kind. Use one of: ${CONTENT_KINDS.join(", ")}.` };
  }
  const title = typeof data.title === "string" ? data.title.trim() : "";
  if (!title) return { ok: false, error: "Title is required." };
  if (title.length > MAX_TITLE) {
    return { ok: false, error: `Title is too long (max ${MAX_TITLE} chars).` };
  }

  const subtitle = typeof data.subtitle === "string" ? data.subtitle.trim() : "";
  if (subtitle.length > MAX_SUBTITLE) {
    return { ok: false, error: `Subtitle is too long (max ${MAX_SUBTITLE} chars).` };
  }
  const description = typeof data.description === "string" ? data.description.trim() : "";
  if (description.length > MAX_DESCRIPTION) {
    return { ok: false, error: `Description is too long (max ${MAX_DESCRIPTION} chars).` };
  }
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
    const cleaned = raw
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter(Boolean);
    const tooLong = cleaned.find((t) => t.length > MAX_TAG_LEN);
    if (tooLong) {
      return {
        ok: false,
        error: `Tag "${tooLong.slice(0, 32)}…" is too long (max ${MAX_TAG_LEN} chars).`,
      };
    }
    tags = cleaned.slice(0, MAX_TAGS);
  }

  let meta: Record<string, unknown> = {};
  if (data.meta !== undefined) {
    if (typeof data.meta === "string") {
      if (data.meta.trim().length > MAX_META_LEN) {
        return { ok: false, error: "Meta JSON is too large (max 4000 chars)." };
      }
      if (data.meta.trim()) {
        try {
          const parsed: unknown = JSON.parse(data.meta);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return { ok: false, error: "Meta must be a JSON object." };
          }
          meta = parsed as Record<string, unknown>;
        } catch {
          return { ok: false, error: "Meta must be valid JSON." };
        }
      }
    } else if (data.meta && typeof data.meta === "object" && !Array.isArray(data.meta)) {
      if (JSON.stringify(data.meta).length > MAX_META_LEN) {
        return { ok: false, error: "Meta JSON is too large (max 4000 chars)." };
      }
      meta = data.meta as Record<string, unknown>;
    } else {
      return { ok: false, error: "Meta must be a JSON object." };
    }
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
      meta,
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
    meta: {},
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
    meta: {},
    sort_order: 2,
    is_visible: true,
  },
];

/** Seed projects — mirrors the portfolio's selected work. meta: { long, demo? }. */
export const SEED_PROJECTS: ContentItem[] = [
  {
    id: "seed-project-aegisstack",
    kind: "project",
    title: "AegisStack",
    subtitle: "DevSecOps",
    description:
      "A DevSecOps assistant that helps developers shift security left across the pipeline.",
    url: "https://github.com/divyanshakya966/AegisStack",
    image: "",
    tags: ["Python", "Docker", "K8s", "DevSecOps"],
    meta: {
      long: "AegisStack is a DevSecOps assistant focused on baking security into every stage of the software delivery pipeline — dependency scanning, secret detection, container hardening checks, and policy-as-code guidance. Designed to give developers actionable, contextual security feedback without slowing them down.",
    },
    sort_order: 1,
    is_visible: true,
  },
  {
    id: "seed-project-securecontent",
    kind: "project",
    title: "SecureContent AI",
    subtitle: "GenAI Security",
    description:
      "A GenAI security control plane that protects all inputs, outputs, and training data.",
    url: "https://github.com/divyanshakya966/SecureContent-AI",
    image: "",
    tags: ["Next.js", "TypeScript", "Prisma", "Docker"],
    meta: {
      long: "SecureContent AI treats every upload as untrusted data until verified: Ingest → Scan → Classify → Sanitize → Transform → Validate → Deliver. Detects PII, secrets, prompt injection and unsafe URLs, enforces 5 audience-aware policies plus custom OWASP / GDPR / HIPAA / PCI templates, and transforms sources into 15 artefact types (executive summaries, incident reports, policy briefs & more) with output DLP re-validation. Built with Next.js, Prisma, Gemini/Groq and Docker.",
    },
    sort_order: 2,
    is_visible: true,
  },
  {
    id: "seed-project-smartcampus",
    kind: "project",
    title: "SmartCampus",
    subtitle: "Full Stack",
    description: "A campus marketplace where students can buy, sell and exchange items safely.",
    url: "https://github.com/divyanshakya966/SmartCampus",
    image: "",
    tags: ["Node.js", "Express", "MongoDB", "React"],
    meta: {
      long: "SmartCampus is a closed-campus marketplace: verified student accounts, listings with images, chat, and a clean mobile-first UX. Built to solve a real problem on my own campus — secure, simple, and fast.",
    },
    sort_order: 3,
    is_visible: true,
  },
  {
    id: "seed-project-skillforge",
    kind: "project",
    title: "Next-Gen Skillforge",
    subtitle: "Full Stack",
    description:
      "An AI dashboard that analyzes resumes to generate personalized learning roadmaps.",
    url: "https://github.com/divyanshakya966/Next-Gen-Skillforge",
    image: "",
    tags: ["Next.js", "React", "Tailwind CSS", "Recharts"],
    meta: {
      long: "Next-Gen Skillforge is an AI-powered career intelligence dashboard built with Next.js. It analyzes public profile links and resume content, extracts skill signals, generates role-fit insights, and creates a personalized learning roadmap.",
    },
    sort_order: 4,
    is_visible: true,
  },
  {
    id: "seed-project-discord",
    kind: "project",
    title: "Discord AI ChatBot",
    subtitle: "Bots / AI",
    description: "Multipurpose Discord bot with AI chat, moderation utilities and server commands.",
    url: "https://github.com/divyanshakya966/Discord-Bot",
    image: "",
    tags: ["Node.js", "TypeScript", "discord.js", "OpenAI"],
    meta: {
      long: "A multipurpose Discord bot built with Node.js — AI-powered conversational responses, slash commands, moderation utilities, and quality-of-life server tools. Modular command architecture, easy to extend.",
    },
    sort_order: 5,
    is_visible: true,
  },
  {
    id: "seed-project-telegram",
    kind: "project",
    title: "Telegram Mod Bot",
    subtitle: "Bots",
    description: "Group moderation bot for Telegram — anti-spam, warnings, and admin tooling.",
    url: "https://github.com/divyanshakya966/Telegram-Bot",
    image: "",
    tags: ["Python", "python-telegram-bot", "Docker"],
    meta: {
      long: "A Telegram group moderation bot covering anti-spam filters, warning/ban systems, welcome flows, and admin utilities. Lightweight, configurable, and easy to self-host.",
    },
    sort_order: 6,
    is_visible: true,
  },
];

/** Seed experience — subtitle is the venue, meta holds { when, tag }. */
export const SEED_EXPERIENCE: ContentItem[] = [
  {
    id: "seed-exp-htb",
    kind: "experience",
    title: "Cybersecurity Trainee",
    subtitle: "HackTheBox",
    description:
      "Doing hands-on cybersecurity training on HackTheBox across red teaming and penetration testing with continuously advancing skills through ongoing labs/machines and challenges.",
    url: "",
    image: "",
    tags: ["Cybersecurity"],
    meta: { when: "August 2026 – Present", tag: "Cybersecurity" },
    sort_order: 1,
    is_visible: true,
  },
  {
    id: "seed-exp-gssoc",
    kind: "experience",
    title: "Open Source Contributor",
    subtitle: "GSSoC 2026",
    description:
      "Contributing code, documentation, testing and feature improvements across open-source projects. Collaborating with maintainers via Git, GitHub, issues and PRs.",
    url: "",
    image: "",
    tags: ["Open Source"],
    meta: { when: "May 2026 – July 2026", tag: "Open Source" },
    sort_order: 2,
    is_visible: true,
  },
  {
    id: "seed-exp-hackathon",
    kind: "experience",
    title: "National Hackathon Finalist · 2x",
    subtitle: "National Level Hackathons",
    description:
      "Reached the finals at two national-level student hackathons — shipping secure, full-stack prototypes under tight deadlines with cross-functional teams.",
    url: "",
    image: "",
    tags: ["Hackathon"],
    meta: { when: "Apr 2026 – Present", tag: "Hackathon" },
    sort_order: 3,
    is_visible: true,
  },
  {
    id: "seed-exp-thm",
    kind: "experience",
    title: "Security Trainee",
    subtitle: "TryHackMe",
    description:
      "Hands-on training across DevSecOps, security engineering, AI security, penetration testing and web application security. Active labs in reconnaissance, vulnerability assessment and controlled exploitation.",
    url: "",
    image: "",
    tags: ["Cybersecurity"],
    meta: { when: "Feb 2026 – Present", tag: "Cybersecurity" },
    sort_order: 4,
    is_visible: true,
  },
  {
    id: "seed-exp-edu",
    kind: "experience",
    title: "B.Tech CSE — Cybersecurity",
    subtitle: "Oriental College of Technology, Bhopal",
    description:
      "Pursuing Bachelor of Technology in Computer Science with a Cybersecurity specialization. Focusing on Linux, systems, secure software and cloud security fundamentals.",
    url: "",
    image: "",
    tags: ["Education"],
    meta: { when: "2025 – Present", tag: "Education" },
    sort_order: 5,
    is_visible: true,
  },
];

/** Seed achievements — subtitle is the sub-line, meta holds { icon }. */
export const SEED_ACHIEVEMENTS: ContentItem[] = [
  {
    id: "seed-ach-thm",
    kind: "achievement",
    title: "Top 1% — TryHackMe",
    subtitle: "Global ranking · ongoing",
    description: "",
    url: "",
    image: "",
    tags: [],
    meta: { icon: "trophy" },
    sort_order: 1,
    is_visible: true,
  },
  {
    id: "seed-ach-hack",
    kind: "achievement",
    title: "2x National Hackathon Finalist",
    subtitle: "National level · 2025 / 2026",
    description: "",
    url: "",
    image: "",
    tags: [],
    meta: { icon: "award" },
    sort_order: 2,
    is_visible: true,
  },
  {
    id: "seed-ach-gssoc",
    kind: "achievement",
    title: "GSSoC 2026 Contributor",
    subtitle: "Open source · 2026",
    description: "",
    url: "",
    image: "",
    tags: [],
    meta: { icon: "badge" },
    sort_order: 3,
    is_visible: true,
  },
  {
    id: "seed-ach-oss",
    kind: "achievement",
    title: "Active Open Source Dev",
    subtitle: "GitHub @divyanshakya966",
    description: "",
    url: "",
    image: "",
    tags: [],
    meta: { icon: "star" },
    sort_order: 4,
    is_visible: true,
  },
];

/** Seed skills — title is the group name, tags are the skills. */
export const SEED_SKILLS: ContentItem[] = [
  {
    id: "seed-skill-lang",
    kind: "skill",
    title: "Languages",
    subtitle: "",
    description: "",
    url: "",
    image: "",
    tags: ["C/C++", "Python", "Bash"],
    meta: {},
    sort_order: 1,
    is_visible: true,
  },
  {
    id: "seed-skill-web",
    kind: "skill",
    title: "Web & Backend",
    subtitle: "",
    description: "",
    url: "",
    image: "",
    tags: ["AI assisted frontend development", "Backend/API fundamentals"],
    meta: {},
    sort_order: 2,
    is_visible: true,
  },
  {
    id: "seed-skill-devsecops",
    kind: "skill",
    title: "DevSecOps & Cloud",
    subtitle: "",
    description: "",
    url: "",
    image: "",
    tags: ["Linux", "Docker", "Kubernetes", "Git & GitHub", "CI/CD", "Cloud Security"],
    meta: {},
    sort_order: 3,
    is_visible: true,
  },
  {
    id: "seed-skill-sec",
    kind: "skill",
    title: "Security",
    subtitle: "",
    description: "",
    url: "",
    image: "",
    tags: [
      "DevSecOps",
      "Pentesting",
      "Web App Security",
      "AI Security",
      "Recon",
      "TryHackMe",
      "HackTheBox",
    ],
    meta: {},
    sort_order: 4,
    is_visible: true,
  },
];

/** Seed about cards — description is the body, meta holds { icon }. */
export const SEED_ABOUT: ContentItem[] = [
  {
    id: "seed-about-sec",
    kind: "about",
    title: "Security First",
    subtitle: "",
    description:
      "Aspiring security engineer — DevSecOps, Pentesting, AI & Cloud Security via hands-on TryHackMe and HackTheBox labs.",
    url: "",
    image: "",
    tags: [],
    meta: { icon: "shield" },
    sort_order: 1,
    is_visible: true,
  },
  {
    id: "seed-about-cloud",
    kind: "about",
    title: "Cloud & DevSecOps",
    subtitle: "",
    description:
      "Docker, Kubernetes, CI/CD and Cloud Security fundamentals — shipping safer, faster.",
    url: "",
    image: "",
    tags: [],
    meta: { icon: "cloud" },
    sort_order: 2,
    is_visible: true,
  },
  {
    id: "seed-about-builder",
    kind: "about",
    title: "Builder",
    subtitle: "",
    description:
      "Full-stack apps, Discord & Telegram bots, and DevSecOps tooling — JS/TS, C/C++, Python.",
    url: "",
    image: "",
    tags: [],
    meta: { icon: "code" },
    sort_order: 3,
    is_visible: true,
  },
  {
    id: "seed-about-linux",
    kind: "about",
    title: "Linux Native",
    subtitle: "",
    description: "Lives in the terminal — Git/GitHub workflows, scripting, and constant tinkering.",
    url: "",
    image: "",
    tags: [],
    meta: { icon: "terminal" },
    sort_order: 4,
    is_visible: true,
  },
];

/**
 * Seed status cards — meta.card is build|learn|now, meta.icon the icon name,
 * meta.lines the bullet list (learn), meta.stats [{l, v}] (now).
 */
export const SEED_BUILDING: ContentItem[] = [
  {
    id: "seed-building-now",
    kind: "building",
    title: "Building",
    subtitle: "",
    description:
      "AegisStack — a DevSecOps assistant that shifts security left across the developer pipeline.",
    url: "",
    image: "",
    tags: [],
    meta: { card: "build", icon: "hammer" },
    sort_order: 1,
    is_visible: true,
  },
  {
    id: "seed-building-learn",
    kind: "building",
    title: "Learning",
    subtitle: "",
    description: "",
    url: "",
    image: "",
    tags: [],
    meta: {
      card: "learn",
      icon: "book",
      lines: [
        "DevSecOps & pipeline security",
        "Kubernetes & container hardening",
        "AI & cloud security fundamentals",
      ],
    },
    sort_order: 2,
    is_visible: true,
  },
  {
    id: "seed-building-stats",
    kind: "building",
    title: "Right now",
    subtitle: "",
    description: "",
    url: "",
    image: "",
    tags: [],
    meta: {
      card: "now",
      icon: "activity",
      stats: [
        { l: "TryHackMe rank", v: "Top 1%" },
        { l: "Open Source", v: "Contributing" },
        { l: "Hackathon finals", v: "2x" },
      ],
    },
    sort_order: 3,
    is_visible: true,
  },
];

/** All seeds by kind. Research + blogs intentionally start empty (hidden). */
export const SEEDS: Record<ContentKind, ContentItem[]> = {
  certification: SEED_CERTIFICATIONS,
  research: [],
  blog: [],
  project: SEED_PROJECTS,
  experience: SEED_EXPERIENCE,
  achievement: SEED_ACHIEVEMENTS,
  skill: SEED_SKILLS,
  about: SEED_ABOUT,
  building: SEED_BUILDING,
};

export function sortContent(items: ContentItem[]): ContentItem[] {
  return [...items].sort(
    (a, b) => a.sort_order - b.sort_order || String(a.id).localeCompare(String(b.id)),
  );
}
