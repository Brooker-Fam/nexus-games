// Which (unit, skin) pairs are paid alternate liveries, and what each one
// costs — the single source of truth the checkout and webhook endpoints
// validate against, mirroring js/rts/skins.js's UNIT_SKIN_CFG/ALT_SKIN_THEME
// (kept separate since the frontend has no build step to share modules with
// these serverless functions).
export const PAID_SKINS = {
  arkship: "royal-vanguard",
  capitalship: "ironcrown",
  witch: "royal-vanguard",
  swordsman: "crimson-covenant",
  gunbot: "ironcrown",
  legionnaire: "royal-vanguard",
  warbot: "ironcrown",
  oracle: "royal-vanguard",
  darkwarrior: "crimson-covenant",
  shockbot: "ironcrown",
  wizard: "royal-vanguard",
  necromancer: "crimson-covenant",
  tank: "ironcrown",
  "wardrone-prism": "royal-vanguard",
  "wardrone-shadow": "crimson-covenant",
  "wardrone-roboto": "ironcrown",
  lightfighter: "royal-vanguard",
  destroyer: "crimson-covenant",
  warship: "ironcrown",
  prism: "royal-vanguard",
  vanthel: "crimson-covenant",
  gongui: "ironcrown",
};

export function isValidPaidSkin(unit, skin) {
  return typeof unit === "string" && typeof skin === "string" && PAID_SKINS[unit] === skin;
}
