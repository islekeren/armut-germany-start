import { EventEmitter } from "node:events";

// Local gateways are notified only after account deletion commits. Gateways
// also recheck the database on every event; no JWT alone grants socket access.
export const accountEvents = new EventEmitter();
