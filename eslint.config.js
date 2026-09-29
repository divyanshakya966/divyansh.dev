import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // TanStack route modules must export Route alongside components —
    // the fast-refresh rule can't apply to them.
    files: ["src/routes/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    // eslint-plugin-react-hooks v7 newly reports intentional sync patterns
    // (reset on dialog open, mount feature-detect, latest-ref) as errors.
    // Triaged: each site is deliberate and covered by component tests.
    // Follow-up: refactor toward derived state / useEffectEvent, then
    // re-enable these as errors.
    files: [
      "src/components/portfolio/CommandPalette.tsx",
      "src/components/portfolio/Contact.tsx",
      "src/components/portfolio/Cursor.tsx",
      "src/components/portfolio/IntroBoot.tsx",
      "src/components/portfolio/Reveal.tsx",
      "src/components/portfolio/Terminal.tsx",
      "src/routes/admin.tsx",
      "src/routes/index.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
  eslintPluginPrettier,
);
