// Illustrative UI review data, not a verified component specification database.
import {newItem} from "./workshop-base-model.js";
const field = (id, label, type = "text", unit = "", destination = "workshop") => ({id, label, type, unit, destination});
const make = (identity, fields, values, extra = {}) => ({...newItem(identity.category), identity, fields,
  values: Object.fromEntries(Object.entries(values).map(([id, value]) => [id, {value}])), ...extra});
export function exampleItems() {
  return [
    {key: "mosfet", caption: "Purchased component", item: make(
      {name: "2N7000 MOSFET", category: "Switching & Control", mpn: "2N7000", description: "Small through-hole switching transistor"},
      [field("package", "Package"), field("voltage", "Drain-source voltage", "number", "V"), field("designator", "Reference designator", "text", "", "project")],
      {package: "TO-92", voltage: 60}, {notes: "Illustrative ratings only. Verify the chosen manufacturer's datasheet before using this part."})},
    {key: "supply", caption: "Power supply", item: make(
      {name: "LRS-350-24 supply", category: "Power", manufacturer: "Mean Well", mpn: "LRS-350-24"},
      [field("output-voltage", "Output voltage", "number", "V"), field("mounting", "Mounting notes", "text", "", "project")],
      {"output-voltage": 24})},
    {key: "resistor", caption: "Generic component", item: make(
      {name: "¼ W resistor", category: "Basic Components", description: "Choose the resistance for each project"},
      [field("power", "Power rating", "number", "W"), field("resistance", "Resistance", "number", "Ω", "project"), field("designator", "Reference designator", "text", "", "project")],
      {power: 0.25})},
    {key: "bracket", caption: "Custom part", item: make(
      {name: "Motor mounting bracket", category: "Hardware & Materials"},
      [field("material", "Material"), field("thickness", "Thickness", "number", "in")],
      {material: "Aluminum", thickness: 0.125}, {notes: "Made for this fixture. No manufacturer or order number is required."})},
    {key: "tool", caption: "Reusable tool", item: make(
      {name: "Soldering iron", category: "Making & Assembly", isTool: true},
      [field("adjustable", "Adjustable temperature", "checkbox"), field("tip", "Tip shape", "choice")].map(f => f.id === "tip" ? {...f, options: ["Chisel", "Conical", "Bevel"]} : f),
      {adjustable: true, tip: "Chisel"})}
  ];
}
