import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getSiteUrl } from "./site-url.ts";

const envKeys = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_VERCEL_URL",
  "VERCEL_URL",
] as const;
const testGlobal = globalThis as any;

function snapshotEnv() {
  return Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const key of envKeys) {
    const value = snapshot[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("getSiteUrl", () => {
  it("prefers the browser origin when available", () => {
    const previousWindow = testGlobal.window;
    const previousEnv = snapshotEnv();

    try {
      testGlobal.window = {
        location: { origin: "https://rapidohelp.com" },
      };
      delete process.env.NEXT_PUBLIC_SITE_URL;
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.NEXT_PUBLIC_VERCEL_URL;
      delete process.env.VERCEL_URL;

      assert.equal(getSiteUrl(), "https://rapidohelp.com");
    } finally {
      if (previousWindow === undefined) {
        delete testGlobal.window;
      } else {
        testGlobal.window = previousWindow;
      }
      restoreEnv(previousEnv);
    }
  });

  it("falls back to the configured public site URL when the browser origin is unavailable", () => {
    const previousWindow = testGlobal.window;
    const previousEnv = snapshotEnv();

    try {
      delete testGlobal.window;
      process.env.NEXT_PUBLIC_SITE_URL = "https://staging.rapidohelp.com/";
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.NEXT_PUBLIC_VERCEL_URL;
      delete process.env.VERCEL_URL;

      assert.equal(getSiteUrl(), "https://staging.rapidohelp.com");
    } finally {
      if (previousWindow === undefined) {
        delete testGlobal.window;
      } else {
        testGlobal.window = previousWindow;
      }
      restoreEnv(previousEnv);
    }
  });
});
