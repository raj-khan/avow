// End-to-end: loads the unpacked extension into headless Chrome, serves a
// fixture at a real https://play.google.com/console/ URL through the DevTools
// Fetch domain, and checks that the content script injects and fills.
//
// Opt-in and not part of `npm test`: it needs a local Chrome 126+. No
// dependencies.
//
//   node test/e2e.js                 # uses google-chrome on PATH
//   CHROME=/path/to/chrome node test/e2e.js
//
// Branded Chrome 137+ ignores --load-extension, so the extension is loaded
// with the DevTools Extensions.loadUnpacked command instead, which needs the
// pipe transport and --enable-unsafe-extension-debugging. The profile is a
// throwaway temp dir, so nothing touches your own Chrome.

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname;
const EXT = join(ROOT, "extension");
const FIXTURE = readFileSync(join(ROOT, "test/fixtures/console-ads.html"));
const URL_UNDER_TEST = "https://play.google.com/console/u/0/developers/0/app/0/app-content/ads";
const profile = mkdtempSync(join(tmpdir(), "avow-e2e-"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(process.env.CHROME || "google-chrome", [
  "--headless=new",
  "--no-first-run",
  "--no-default-browser-check",
  "--remote-debugging-pipe",
  "--enable-unsafe-extension-debugging",
  `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"], detached: true });

async function cleanup() {
  // Chrome runs as its own process group (detached), so its renderer and
  // utility processes go down with it instead of writing to the profile
  // while it is being removed.
  if (chrome.exitCode === null && chrome.signalCode === null) {
    const exited = new Promise((r) => chrome.once("exit", r));
    try { process.kill(-chrome.pid, "SIGTERM"); } catch {}
    await exited;
  }
  for (let i = 0; i < 20; i++) {
    try {
      rmSync(profile, { recursive: true, force: true });
      return;
    } catch {
      await sleep(250);
    }
  }
  console.error(`could not remove ${profile}`);
}

// A minimal CDP client over the pipe: Chrome reads NUL-terminated JSON on
// fd 3 and writes it on fd 4. Flattened sessions carry a sessionId.
function cdp(input, output) {
  let id = 0, buf = "";
  const pending = new Map();
  const listeners = [];
  output.setEncoding("utf8");
  output.on("data", (chunk) => {
    buf += chunk;
    let end;
    while ((end = buf.indexOf("\0")) >= 0) {
      const msg = JSON.parse(buf.slice(0, end));
      buf = buf.slice(end + 1);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const l of listeners) l(msg);
      }
    }
  });
  return {
    send: (method, params = {}, sessionId) =>
      new Promise((resolve, reject) => {
        const n = ++id;
        pending.set(n, { resolve, reject });
        input.write(JSON.stringify({ id: n, method, params, sessionId }) + "\0");
      }),
    on: (fn) => listeners.push(fn),
  };
}

async function main() {
  const c = cdp(chrome.stdio[3], chrome.stdio[4]);
  await c.send("Extensions.loadUnpacked", { path: EXT });

  const { targetId } = await c.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await c.send("Target.attachToTarget", { targetId, flatten: true });
  const s = (method, params) => c.send(method, params, sessionId);

  // Serve the fixture for any Console URL, so the manifest's real `matches`
  // pattern decides whether the content script runs.
  const contexts = [];
  c.on((msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === "Fetch.requestPaused") {
      s("Fetch.fulfillRequest", {
        requestId: msg.params.requestId,
        responseCode: 200,
        responseHeaders: [{ name: "Content-Type", value: "text/html; charset=utf-8" }],
        body: FIXTURE.toString("base64"),
      });
    }
    if (msg.method === "Runtime.executionContextCreated") contexts.push(msg.params.context);
  });
  await s("Fetch.enable", { patterns: [{ urlPattern: "https://play.google.com/console/*" }] });
  await s("Runtime.enable");
  await s("Page.enable");
  await s("Page.navigate", { url: URL_UNDER_TEST });

  // The content script runs at document_idle in its own isolated world.
  let world;
  for (let i = 0; i < 50 && !world; i++) {
    await sleep(100);
    world = contexts.find((x) => x.auxData?.type === "isolated" && x.name === "avow");
  }
  assert.ok(world, "content script did not inject on the Console URL");

  const evalIn = async (expression, contextId) => {
    const { result, exceptionDetails } = await s("Runtime.evaluate", { expression, contextId, returnByValue: true });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
    return result.value;
  };

  const panel = await evalIn(`!!document.getElementById("avow-panel-host")`);
  assert.ok(panel, "panel host is not in the page");

  const report = await evalIn(`(() => {
    avow.manifest = avow.readManifest(JSON.stringify({ schema: 1, declarations: {
      ads: { source: "answered", contains_ads: false },
      advertising_id: { source: "answered", uses_advertising_id: false },
    } })).manifest;
    avow.ui.$("fill").disabled = false;
    avow.ui.$("fill").click();
    return avow.ui.$("summary").textContent;
  })()`, world.id);
  assert.match(report, /^Filled 2, left 0/);

  const state = await evalIn(`[
    document.querySelector('input[value="no"]').checked,
    document.querySelector('[aria-label="No"]').getAttribute("aria-checked"),
  ]`);
  assert.deepEqual(state, [true, "true"]);
  console.log("✓ e2e: injected on the Console URL, filled 2 questions, controls read back as set");
}

let failed = false;
try {
  await main();
} catch (e) {
  failed = true;
  console.error(`✗ e2e: ${e.message}`);
} finally {
  await cleanup();
}
process.exit(failed ? 1 : 0);
