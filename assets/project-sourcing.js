// Older Workshop-linked items predate the explicit source choice. Treat their
// existing selection as purchased unless the owner explicitly chose otherwise.
export const itemSupply = (item, selection = null) =>
  item.fields?.supply || (selection ? "purchased" : "made");
export const hasManufacturerFields = (item, selection = null) =>
  item.kind === "part" &&
  !item.is_assembly &&
  itemSupply(item, selection) === "purchased";
