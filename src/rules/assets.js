import { existsSync } from "node:fs";
import { join } from "node:path";
import { imageSize } from "../lib/imagesize.js";
import { result, PASS, FAIL, WARN, SKIP } from "../lib/report.js";

const MB = 1024 * 1024;

export default {
  id: "assets",
  question: "Graphic asset dimensions and limits",
  console_path: "Grow > Store presence > Main store listing",
  why:
    "Play validates dimensions, byte size and aspect ratio on upload. Phone " +
    "screenshots are the usual casualty: modern handsets shoot taller than " +
    "the stated 9:16, so a straight device capture can sit outside the rule " +
    "even though it looks right.",
  verify(m, root) {
    const a = m.assets;
    if (!a) return result(SKIP, this.id, "no assets in the manifest");
    const problems = [];
    const notes = [];
    let checked = 0;

    const look = (rel) => {
      const p = join(root, rel);
      if (!existsSync(p)) {
        problems.push(`${rel}: missing`);
        return null;
      }
      const s = imageSize(p);
      if (!s) {
        problems.push(`${rel}: not a readable PNG or JPEG`);
        return null;
      }
      checked++;
      return s;
    };

    if (a.icon_512) {
      const s = look(a.icon_512);
      if (s && (s.width !== 512 || s.height !== 512)) {
        problems.push(`${a.icon_512}: ${s.width}x${s.height}, must be 512x512`);
      }
      if (s && s.bytes > MB) problems.push(`${a.icon_512}: ${(s.bytes / MB).toFixed(1)}MB, max 1MB`);
    }

    if (a.feature_graphic_1024x500) {
      const s = look(a.feature_graphic_1024x500);
      if (s && (s.width !== 1024 || s.height !== 500)) {
        problems.push(`${a.feature_graphic_1024x500}: ${s.width}x${s.height}, must be 1024x500`);
      }
      if (s && s.bytes > 15 * MB) problems.push(`${a.feature_graphic_1024x500}: over 15MB`);
    }

    const shots = a.phone_screenshots ?? [];
    if (shots.length && (shots.length < 2 || shots.length > 8)) {
      problems.push(`phone_screenshots: ${shots.length}, must be 2 to 8`);
    }
    let promotable = 0;
    for (const rel of shots) {
      const s = look(rel);
      if (!s) continue;
      const lo = Math.min(s.width, s.height), hi = Math.max(s.width, s.height);
      if (lo < 320 || hi > 3840) problems.push(`${rel}: ${s.width}x${s.height}, each side must be 320-3840`);
      if (s.bytes > 8 * MB) problems.push(`${rel}: over 8MB`);
      const ratio = hi / lo;
      // Play states 16:9 or 9:16. Its validator has accepted taller in
      // practice, so this warns rather than fails: a hard fail here would
      // block a listing Play is willing to take.
      if (ratio > 2.0) notes.push(`${rel}: 1:${ratio.toFixed(3)}, outside the stated 9:16`);
      if (lo >= 1080) promotable++;
    }
    if (shots.length && promotable < 4) {
      notes.push(`only ${promotable} screenshot(s) at 1080px+ on the short side; 4 are needed for promotion`);
    }

    if (!checked) return result(SKIP, this.id, "no assets to check");
    if (problems.length) return result(FAIL, this.id, `${problems.length} asset problem(s)`, problems);
    if (notes.length) return result(WARN, this.id, `${checked} assets within limits, with notes`, notes);
    return result(PASS, this.id, `${checked} assets within Play's limits`);
  },
};
