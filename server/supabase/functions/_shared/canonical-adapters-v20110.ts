// Powder 20.11.0 canonical mutation adapter contract.
// Player writes must enter through powder-mutation-gateway. Legacy Edge targets are
// server-to-server compatibility bridges only until their business atomicity,
// txKey idempotency and direct-write lock are verified with evidence.
export const CANONICAL_ADAPTER_VERSION='20.11.0';
export const CANONICAL_TARGET_ALLOWLIST=Object.freeze([
  'powder-economy','powder-inventory','powder-liveops','powder-learning-events'
] as const);
export type CanonicalScope='economy'|'inventory'|'reward'|'mail'|'event'|'purchase'|'support';
export type CanonicalAdapterRoute={scope:CanonicalScope;action:string;routeKind:'legacy_edge_bridge'|'sql_atomic';targetEdge?:string;legacyAction?:string};
export const CANONICAL_ACTIONS=Object.freeze([
 ['economy','buy_candy'],['economy','consume_candy'],['economy','feed_candy'],['economy','open_powball'],['economy','upgrade_pow'],['reward','claim_daily'],['economy','daily_boss_entry'],
 ['inventory','equipment_equip'],['inventory','equipment_unequip'],['inventory','artifact_equip'],['inventory','artifact_unequip'],['inventory','item_lock'],
 ['mail','claim_mail'],['reward','claim_daily_login'],['event','claim_mission'],['event','claim_completion'],['purchase','event_buy'],['event','finish_combat']
] as const);
