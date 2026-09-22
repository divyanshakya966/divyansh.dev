import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  SETTING_DEFS,
  isSectionVisible,
  mergeSettings,
  settingLines,
  validateSettingValue,
} from "@/lib/settings";

describe("site settings", () => {
  it("covers every section with a visibility flag defaulting to shown", () => {
    for (const id of [
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
    ]) {
      expect(DEFAULT_SETTINGS[`section_${id}_visible`]).toBe("1");
      expect(isSectionVisible(DEFAULT_SETTINGS, id as never)).toBe(true);
    }
  });

  it("keeps hero/social/contact defaults matching the static site", () => {
    expect(settingLines(DEFAULT_SETTINGS, "hero_roles")[0]).toMatch(/^C/);
    expect(DEFAULT_SETTINGS.contact_email).toBe("divyanshakya.dev@gmail.com");
    expect(DEFAULT_SETTINGS.social_github).toBe("https://github.com/divyanshakya966");
    expect(DEFAULT_SETTINGS.footer_repo).toContain("divyansh.dev");
  });

  it("merges overrides and ignores unknown keys", () => {
    const merged = mergeSettings({ contact_email: "a@b.co", evil: "x" });
    expect(merged.contact_email).toBe("a@b.co");
    expect("evil" in merged).toBe(false);
    expect(isSectionVisible(merged, "projects")).toBe(true);
    expect(isSectionVisible({ ...merged, section_projects_visible: "0" }, "projects")).toBe(false);
  });

  it("validates values strictly", () => {
    expect(validateSettingValue("nope", "x").ok).toBe(false);
    expect(validateSettingValue("section_blogs_visible", "2").ok).toBe(false);
    expect(validateSettingValue("section_blogs_visible", "0").ok).toBe(true);
    expect(validateSettingValue("contact_email", "bad").ok).toBe(false);
    expect(validateSettingValue("contact_email", "a@b.co").ok).toBe(true);
    expect(validateSettingValue("hero_roles", "  \n ").ok).toBe(false);
    expect(SETTING_DEFS.length).toBeGreaterThan(15);
  });
});
