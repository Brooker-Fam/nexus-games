import { Polar } from "@polar-sh/sdk";

let _polar = null;

export function getPolar() {
  if (_polar) return _polar;
  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("POLAR_ACCESS_TOKEN is not set");
  }
  _polar = new Polar({
    accessToken,
    server: process.env.POLAR_SERVER === "sandbox" ? "sandbox" : "production",
  });
  return _polar;
}

// "Alternate Skin Unlock" — one product reused for every priced skin;
// which unit/skin was bought is carried as checkout metadata instead of
// having a separate Polar product per skin.
export const DEFAULT_SKIN_UNLOCK_PRODUCT_ID = "8aa992b2-b28c-4ec1-a637-8533f64de1be";

// "Nexus Pro" — $20/mo recurring subscription (all skins unlocked + full
// book access). No hardcoded default: unlike the skin unlock product this
// one hasn't been created in the Polar dashboard yet, so it must be
// configured via POLAR_MEMBERSHIP_PRODUCT_ID before checkout can run.
export function getMembershipProductId() {
  const id = process.env.POLAR_MEMBERSHIP_PRODUCT_ID;
  if (!id) {
    throw new Error("POLAR_MEMBERSHIP_PRODUCT_ID is not set");
  }
  return id;
}
