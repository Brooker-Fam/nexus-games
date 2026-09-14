// Server-side allowlist of purchasable (unit, skin) pairs — mirrors the
// alt-livery entries in js/rts/skins.js (UNIT_SKIN_CFG + ALT_SKIN_THEME).
// Kept independent of the browser bundle since this only needs to validate
// checkout/webhook requests, not render anything.
const PAID_SKINS = new Set([
  "arkship:royal-vanguard",
  "capitalship:ironcrown",
  "witch:royal-vanguard",
  "swordsman:crimson-covenant",
  "gunbot:ironcrown",
  "legionnaire:royal-vanguard",
  "warbot:ironcrown",
  "oracle:royal-vanguard",
  "darkwarrior:crimson-covenant",
  "shockbot:ironcrown",
  "wizard:royal-vanguard",
  "necromancer:crimson-covenant",
  "tank:ironcrown",
  "wardrone-prism:royal-vanguard",
  "wardrone-shadow:crimson-covenant",
  "wardrone-roboto:ironcrown",
  "lightfighter:royal-vanguard",
  "destroyer:crimson-covenant",
  "warship:ironcrown",
  "prism:royal-vanguard",
  "vanthel:crimson-covenant",
  "gongui:ironcrown",
]);

export function isPaidSkin(unit, skin) {
  return PAID_SKINS.has(`${unit}:${skin}`);
}
