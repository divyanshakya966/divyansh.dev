#!/usr/bin/env node
/**
 * Create / rotate the portfolio admin user.
 *
 * Uses the SAME PBKDF2-SHA256 parameters as src/lib/admin-auth.ts
 * (WebCrypto, 100k iterations — the Cloudflare Workers maximum) so hashes
 * verify on Workers.
 *
 * Usage:
 *   npm run admin:create -- --username divyansh
 *   # prompts for password (12+ chars), prints:
 *   #  1. SQL for D1 (production, recommended)
 *   #  2. .dev.vars values (local dev fallback, no D1 needed)
 *
 * To apply directly to local D1 (after `npx wrangler d1 create` + migrate):
 *   npm run admin:create -- --username divyansh --apply-local
 * To apply to remote D1:
 *   npm run admin:create -- --username divyansh --apply-remote
 *
 * To bypass the hidden prompt (byte-exact, avoids terminal/paste quirks):
 *    ADMIN_PASSWORD='your-passphrase' npm run admin:create -- --username divyansh --apply-remote
 * (prefix a space so it stays out of shell history; `unset ADMIN_PASSWORD` after)
 *
 * To have the script generate a strong password and print it (no typing at all):
 *   npm run admin:create -- --username divyansh --apply-remote --generate
 */
import { execSync } from "node:child_process";
import readline from "node:readline";

const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { username: "", applyLocal: false, applyRemote: false, generate: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--username" && args[i + 1]) out.username = args[++i].toLowerCase();
    else if (args[i] === "--apply-local") out.applyLocal = true;
    else if (args[i] === "--apply-remote") out.applyRemote = true;
    else if (args[i] === "--generate") out.generate = true;
    else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`Usage:
  npm run admin:create -- --username <name> [--apply-local|--apply-remote] [--generate]
  ADMIN_PASSWORD='...' npm run admin:create -- --username <name> --apply-remote

Options:
  --username <name>  admin login (a-z 0-9 . _ -, 3-32 chars)
  --apply-local      write to local D1 (needs migrate + database_id)
  --apply-remote     write to production D1
  --generate         print a strong random password instead of prompting
  ADMIN_PASSWORD env bypasses the hidden prompt (byte-exact)

Without --apply-*, prints SQL + .dev.vars values without writing anything.`);
      process.exit(0);
    }
  }
  return out;
}

const GENERATED_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function randomPassword(length = 20) {
  // Unambiguous, shell-safe charset: no 0/O, 1/l/I, quotes, $ or !.
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (const b of bytes) out += GENERATED_ALPHABET[b % GENERATED_ALPHABET.length];
  return out;
}

function normalizeUsername(v) {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  return /^[a-z0-9._-]{3,32}$/.test(s) ? s : null;
}

function promptSecret(question) {
  // Suppress echo via readline's own output hook only — extra 'data'
  // listeners on stdin race its raw-mode reader and corrupt pasted input.
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    const originalWrite = rl._writeToOutput.bind(rl);
    rl._writeToOutput = (chunk) => {
      const s = chunk.toString();
      if (s === "\r\n" || s === "\n" || s === "\r") originalWrite(chunk);
      // else: swallow (keeps the password hidden without touching the stream)
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

function bytesToHex(bytes) {
  return Buffer.from(bytes).toString("hex");
}

async function hashPassword(password, saltHex) {
  const salt = saltHex
    ? Buffer.from(saltHex, "hex")
    : crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt, iterations: ITERATIONS },
    key,
    HASH_BYTES * 8,
  );
  return { hash: bytesToHex(new Uint8Array(bits)), salt: bytesToHex(salt) };
}

function sqlEscape(s) {
  return s.replace(/'/g, "''");
}

async function main() {
  const { username: flagUser, applyLocal, applyRemote, generate } = parseArgs();
  let username = normalizeUsername(flagUser);
  if (!username) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((r) =>
      rl.question("Admin username [a-z0-9._- 3-32 chars]: ", r),
    );
    rl.close();
    username = normalizeUsername(answer);
    if (!username) {
      console.error("Invalid username.");
      process.exit(1);
    }
  }

  const passwordFromEnv = process.env.ADMIN_PASSWORD;
  let password;
  let generated = false;
  if (generate) {
    // Machine-generated: no typing, no shell quoting, no paste quirks on the
    // creation side. Printed visibly so you can copy it into the browser.
    password = randomPassword(20);
    generated = true;
    console.log("\nGenerated admin password (copy it now, store in a password manager):");
    console.log(`  ${password}\n`);
  } else if (typeof passwordFromEnv === "string" && passwordFromEnv.length > 0) {
    // Byte-exact path: bypasses terminal input entirely (no masking, no
    // pasting quirks). Run as: `ADMIN_PASSWORD='...' npm run admin:create ...`
    // with a leading space so it stays out of shell history, then unset it.
    password = passwordFromEnv;
    console.log("Using password from ADMIN_PASSWORD env (unset it afterwards).");
  } else {
    password = await promptSecret("Admin password (12+ chars, hidden): ");
  }
  if (typeof password !== "string" || password.length < 12 || password.length > 256) {
    console.error("Password must be 12–256 characters.");
    process.exit(1);
  }
  if (generated || (typeof passwordFromEnv === "string" && passwordFromEnv.length > 0)) {
    console.log("Skipping confirmation (generated/env-provided password).");
  } else {
    const confirm = await promptSecret("Confirm password: ");
    if (confirm !== password) {
      console.error("Passwords do not match.");
      process.exit(1);
    }
  }

  const { hash, salt } = await hashPassword(password);
  const now = Date.now();
  const sql = `INSERT INTO admin_users (username, password_hash, salt, created_at) VALUES ('${sqlEscape(username)}', '${hash}', '${salt}', ${now}) ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash, salt=excluded.salt;`;

  console.log("\n— D1 SQL (production, recommended) —");
  console.log(sql);
  console.log("\n— .dev.vars fallback (local dev without D1) —");
  console.log(`ADMIN_USERNAME=${username}`);
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log(`ADMIN_PASSWORD_SALT=${salt}`);

  const target = applyRemote ? "--remote" : applyLocal ? "--local" : null;
  if (target) {
    console.log(`\nApplying to D1 ${target}…`);
    try {
      execSync(`npx wrangler d1 execute portfolio-db ${target} --command "${sql}"`, {
        stdio: "inherit",
      });
      console.log("Done. Sign in at /admin.");
    } catch {
      console.error("Wrangler apply failed. Run the SQL manually (see docs/ADMIN_SETUP.md).");
      process.exit(1);
    }
  } else {
    console.log("\nNext:");
    console.log('  1. npx wrangler d1 execute portfolio-db --local --command "<SQL above>"');
    console.log("     (or --remote for production, after creating + migrating the DB)");
    console.log("  2. Open /admin and sign in.");
    console.log("  Full guide: docs/ADMIN_SETUP.md");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
