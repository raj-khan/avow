import advertisingId from "./advertising-id.js";
import dataSafety from "./data-safety.js";
import listingLimits from "./listing-limits.js";
import assets from "./assets.js";
import claims from "./claims.js";
import completeness from "./completeness.js";

export const rules = [completeness, advertisingId, dataSafety, listingLimits, assets, claims];
export const byId = new Map(rules.map((r) => [r.id, r]));
