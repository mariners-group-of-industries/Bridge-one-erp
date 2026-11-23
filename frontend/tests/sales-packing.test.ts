import { describe, expect, it } from "vitest";
import { packSizeFromName, packingOf } from "../src/features/sales/orders/lib/packing";

describe("pack size from item name", () => {
  it.each([
    ["IRICH Vermicilli 200gm (1x48)", 48],
    ["IRICH Lachcha Semai 180g (1x20)", 20],
    ["Bonruti 120 gm (1 x 120)", 120],
    ["Marine Bar-B-Q Biriyani Chanachur 12gm (24x36)", 864],
    ["Marine Milk Cookies 500gx8", 8],
    ["Marine Milk Cookies 750gx6", 6],
    ["Peawal Pip-Pip Biscuits 48x15gm", 48],
    ["Peawal Nut-Birali 24x35gm Nutty Chocolate Cream Biscuits", 24],
    ["Marine Pulse Masala Candy -Mango (150x1x6)", 6],
  ])("%s → %i", (name, size) => {
    expect(packSizeFromName(name)).toBe(size);
  });

  it.each(["Mariners Juice", "iRICH Vermicilli 200gm (Foil)", "Something (1x1)"])("%s is sold loose", (name) => {
    expect(packSizeFromName(name)).toBeNull();
  });

  it("prefers the item master's own Alt. UoM", () => {
    expect(packingOf({ name: "X (1x48)", altUom: "Bag", altUomFactor: 40 })).toEqual({ altUom: "Bag", altUomFactor: 40 });
    expect(packingOf({ name: "X (1x48)", altUom: null, altUomFactor: null })).toEqual({ altUom: "CTN", altUomFactor: 48 });
    expect(packingOf({ name: "Mariners Juice", altUom: null, altUomFactor: null })).toEqual({ altUom: null, altUomFactor: null });
  });
});
