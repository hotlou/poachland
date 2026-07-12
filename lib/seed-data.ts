/**
 * Compatibility shim. The domain model now lives in lib/types.ts, display
 * constants in lib/constants.ts, live data in the engine (lib/engine.ts via
 * lib/store-context.tsx), and seed records in lib/seed.ts. Import from those
 * modules directly in new code.
 */

export type {
  Badge,
  Condition,
  Division,
  ISOPost,
  ItemType,
  Level,
  Listing,
  ListingType,
  Message,
  Notification,
  User,
} from "./types";

export {
  CONDITION_COLORS,
  LISTING_TYPE_COLORS,
  LISTING_TYPE_LABELS,
} from "./constants";
