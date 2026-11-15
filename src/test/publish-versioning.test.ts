import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/pages.yml", "utf8");
const PAGES = ["public/game.html", "public/index.html", "public/m1/pairs.html"];
const TOKEN = "deadbeef";

// كل قاعدة sed في خطوة النشر: s|from|to|g
const mappings: Array<[string, string]> = [...workflow.matchAll(/s\|([^|]+)\|([^|]+)\|g/g)].map(
  (m) => [
    (m[1] ?? "").replace(/\\\./g, "."),
    (m[2] ?? "").replace(/\\\./g, ".").replace(/\$V/g, TOKEN),
  ],
);

// المراجع المحلية لسكربت أو ستايل (تُستثنى الروابط الخارجية بما فيها ':').
const LOCAL_ASSET = /(?:src|href)="([^":]*\.(?:js|css))"/g;

const refsOf = (html: string) => [...html.matchAll(LOCAL_ASSET)].map((m) => m[1]);

const versioned = (html: string) =>
  mappings.reduce((out, [from, to]) => out.split(from).join(to), html);

describe("Published asset versioning", () => {
  it("versions every local script and stylesheet the site loads", () => {
    for (const file of PAGES) {
      const html = readFileSync(file, "utf8");
      const refs = refsOf(html);
      const out = versioned(html);
      // بعد الـ sed لا يجوز أن يبقى مرجع محلي بلا ?v=، وإلا خدمه الكاش القديم.
      expect(refsOf(out), `unversioned asset in ${file}`).toEqual([]);
      for (const ref of refs) {
        expect(out, `${file} does not version ${ref}`).toContain(`${ref}?v=${TOKEN}`);
      }
    }
  });

  it("covers the shared bundles a stale cache would mix with a new game.js", () => {
    const html = readFileSync("public/game.html", "utf8");
    const out = versioned(html);
    for (const ref of [
      "game/game-rules.js",
      "game/game-hub.js",
      "game/i18n.js",
      "vendor/three.min.js",
    ]) {
      expect(out).toContain(`${ref}?v=${TOKEN}`);
    }
  });

  it("rewrites the picture-clues page, which loads the hub through ../game/", () => {
    expect(workflow).toContain("_site/m1/pairs.html");
    expect(versioned(readFileSync("public/m1/pairs.html", "utf8"))).toContain(
      `../game/game-hub.js?v=${TOKEN}`,
    );
  });

  it("renames the cache on every deploy so activate drops the old one", () => {
    const sw = readFileSync("public/sw.js", "utf8");
    const version = sw.match(/const VERSION = "([^"]+)"/)?.[1];
    expect(version).toBeTruthy();

    // شغّل قاعدة الـ sed نفسها من ملف النشر على sw.js، بدل تكرار المنطق في الاختبار.
    const line = workflow.split("\n").find((l) => l.includes("const VERSION")) ?? "";
    const rule = line.match(/s\|(.*?)\|(.*?)\|"/);
    expect(rule, "the deploy step must rewrite the service-worker cache name").toBeTruthy();
    const [, from = "", to = ""] = rule ?? [];
    const bashToJs = (s: string) =>
      s.replace(/\\"/g, '"').replace(/\\1/g, "$1").replace(/\$V/g, TOKEN);
    const bumped = sw.replace(new RegExp(bashToJs(from)), bashToJs(to));

    expect(bumped).toContain(`const VERSION = "${version}-${TOKEN}"`);
    expect(bumped).not.toBe(sw);
  });
});
