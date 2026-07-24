type Region = "na" | "eu" | "fe";

const REGION_BY_MARKETPLACE: Record<string, Region> = {
  ATVPDKIKX0DER: "na",
  A2EUQ1WTGCTBG2: "na",
  A1AM78C64UM0Y8: "na",
  A1F83G8C2ARO7P: "eu",
  A1PA6795UKMFR9: "eu",
  APJ6JRA9NG5V4: "fe",
  A1VC38T7YXB528: "fe",
};

export function inferRegionFromMarketplaces(marketplaceIds: string[]): Region {
  for (const id of marketplaceIds) {
    const normalized = id.trim().toUpperCase();
    if (REGION_BY_MARKETPLACE[normalized]) {
      return REGION_BY_MARKETPLACE[normalized];
    }
  }
  return "na";
}