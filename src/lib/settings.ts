/**
 * Singleton site settings: hero text, contact details, footer link and
 * per-section visibility flags. Stored as plain strings in D1
 * (`site_settings`), served merged over these defaults via GET /api/settings.
 */

export type SettingType = "text" | "textarea" | "list" | "boolean";

export type SettingDef = {
  key: string;
  label: string;
  type: SettingType;
  def: string;
  hint?: string;
};

export const SECTION_IDS = [
  "about",
  "skills",
  "projects",
  "experience",
  "certifications",
  "achievements",
  "building",
  "research",
  "blogs",
  "contact",
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

const SECTION_LABELS: Record<SectionId, string> = {
  about: "About",
  skills: "Skills",
  projects: "Projects",
  experience: "Experience",
  certifications: "Certifications",
  achievements: "Achievements",
  building: "Currently building",
  research: "Research",
  blogs: "Blogs",
  contact: "Contact",
};

export const DEFAULT_HERO_ROLES = [
  "Cybersecurity Trainee",
  "DevSecOps Practitioner",
  "AI & Cloud Security",
  "Linux & Open Source",
];

export const SETTING_DEFS: SettingDef[] = [
  {
    key: "hero_roles",
    label: "Hero rotating roles (one per line)",
    type: "list",
    def: DEFAULT_HERO_ROLES.join("\n"),
    hint: "First role shows first — keep it punchy.",
  },
  {
    key: "hero_tagline",
    label: "Hero tagline (two lines)",
    type: "textarea",
    def: "Building secure, scalable systems\n— DevSecOps · Linux · Cloud.",
  },
  {
    key: "hero_location",
    label: "Hero location (two lines)",
    type: "textarea",
    def: "Bhopal, India · Open to\ninternships & hackathons",
  },
  {
    key: "about_intro",
    label: "About intro paragraph",
    type: "textarea",
    def: "I'm Divyansh — a B.Tech CSE (Cybersecurity) student at Oriental College of Technology, Bhopal. I'm passionate about Linux, DevSecOps, AI & cloud security, and I learn by building, breaking and shipping.",
  },
  {
    key: "contact_email",
    label: "Contact email",
    type: "text",
    def: "divyanshakya.dev@gmail.com",
  },
  {
    key: "contact_status",
    label: "Contact status line",
    type: "text",
    def: "AVAILABLE · Bhopal, India",
  },
  {
    key: "contact_blurb",
    label: "Contact blurb",
    type: "textarea",
    def: "Open to Cybersecurity and DevSecOps internships, hackathons and meaningful OSS work.",
  },
  {
    key: "social_github",
    label: "GitHub profile URL",
    type: "text",
    def: "https://github.com/divyanshakya966",
  },
  {
    key: "social_linkedin",
    label: "LinkedIn profile URL",
    type: "text",
    def: "https://www.linkedin.com/in/divyanshakya966",
  },
  {
    key: "social_hashnode",
    label: "Hashnode profile URL",
    type: "text",
    def: "https://hashnode.com/@divyanshakya966",
  },
  {
    key: "social_thm",
    label: "TryHackMe profile URL",
    type: "text",
    def: "https://tryhackme.com/p/divyanshakya966",
  },
  {
    key: "social_htb",
    label: "HackTheBox profile URL",
    type: "text",
    def: "https://profile.hackthebox.com/profile/019c5d4a-8b27-718b-baa5-4597358c866b",
  },
  {
    key: "social_leetcode",
    label: "LeetCode profile URL",
    type: "text",
    def: "https://leetcode.com/u/divyanshakya966",
  },
  {
    key: "social_credly",
    label: "Credly profile URL",
    type: "text",
    def: "https://www.credly.com/users/divyansh-shakya.11716562",
  },
  {
    key: "social_x",
    label: "X profile URL",
    type: "text",
    def: "https://x.com/divyanshakya966",
  },
  {
    key: "footer_repo",
    label: "Footer repository URL",
    type: "text",
    def: "https://github.com/divyanshakya966/divyansh.dev",
  },
  ...SECTION_IDS.map(
    (id): SettingDef => ({
      key: `section_${id}_visible`,
      label: `Show "${SECTION_LABELS[id]}" section`,
      type: "boolean",
      def: "1",
      hint:
        id === "research" || id === "blogs"
          ? "Also needs at least one visible item to appear."
          : undefined,
    }),
  ),
];

export const DEFAULT_SETTINGS: Record<string, string> = Object.fromEntries(
  SETTING_DEFS.map((d) => [d.key, d.def]),
);

export function isSettingKey(key: unknown): key is string {
  return typeof key === "string" && SETTING_DEFS.some((d) => d.key === key);
}

export function settingDef(key: string): SettingDef | undefined {
  return SETTING_DEFS.find((d) => d.key === key);
}

const MAX_SETTING_LEN = 2000;

export function validateSettingValue(
  key: string,
  value: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
  const def = settingDef(key);
  if (!def) return { ok: false, error: "Unknown setting key." };
  if (typeof value !== "string") return { ok: false, error: "Value must be a string." };
  if (value.length > MAX_SETTING_LEN) {
    return { ok: false, error: `Value is too long (max ${MAX_SETTING_LEN} chars).` };
  }
  const v = value;
  if (def.type === "boolean" && v !== "0" && v !== "1") {
    return { ok: false, error: "Boolean settings must be 0 or 1." };
  }
  if (key === "contact_email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) {
    return { ok: false, error: "Invalid email address." };
  }
  if (def.type === "list") {
    const lines = v
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return { ok: false, error: "List needs at least one line." };
    if (lines.length > 12) return { ok: false, error: "List is limited to 12 lines." };
  }
  return { ok: true, value: v };
}

export function mergeSettings(overrides: Record<string, string>): Record<string, string> {
  const merged = { ...DEFAULT_SETTINGS };
  for (const [k, v] of Object.entries(overrides)) {
    if (isSettingKey(k)) merged[k] = v;
  }
  return merged;
}

/** Split a list/textarea setting into non-empty lines. */
export function settingLines(settings: Record<string, string>, key: string): string[] {
  const raw = settings[key] ?? DEFAULT_SETTINGS[key] ?? "";
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export function isSectionVisible(settings: Record<string, string>, id: SectionId): boolean {
  return (settings[`section_${id}_visible`] ?? "1") !== "0";
}
