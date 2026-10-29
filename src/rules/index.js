import advertisingId from "./advertising-id.js";
import permissionsInventory from "./permissions-inventory.js";
import dataSafety from "./data-safety.js";
import contentRating from "./content-rating.js";
import listingLimits from "./listing-limits.js";
import assets from "./assets.js";
import claims from "./claims.js";
import completeness from "./completeness.js";
import schema from "./schema.js";

export const rules = [schema, completeness, advertisingId, permissionsInventory, dataSafety, contentRating, listingLimits, assets, claims];
export const byId = new Map(rules.map((r) => [r.id, r]));
