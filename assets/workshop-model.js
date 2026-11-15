/* Workshop domain model: classification, shared/personal matching and labels.
 * Pure with respect to the UI; state is provided by read-only selectors.
 */
(function(){
 "use strict";
 function create({standards,families,categoryFor,getItems}){
  const normalizeName=value=>String(value||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
  const stockLabels={in_stock:"In stock",in_use_reusable:"In use · reusable",committed:"Committed"};
  const matchingReference=item=>standards().find(ref=>ref.id===item.catalogId)||
   standards().find(ref=>normalizeName(ref.name)===normalizeName(item.name));
  const familyOfPersonal=item=>{
   const linked=matchingReference(item);
   if(linked)return families().find(group=>group.items.includes(linked.id))?.id||"";
   const str=[item.name,item.category,item.kind].join(" ").toLowerCase();
   const patterns=[
    ["power-supplies",/power supply|converter|regulator|\bbuck\b|\bpsu\b/],
    ["wire-termination",/ferrule|terminal|crimp/],
    ["heat-shrink",/heat.?shrink|shrink tubing/],
    ["soldering",/solder|rework|heat gun/],
    ["measurement",/multimeter|oscilloscope|scope|logic analyzer|meter|probe/],
    ["wire-tools",/stripper|wire cutter/],
    ["wire",/\bwire\b|\bcable\b/],
    ["semiconductors",/mosfet|resistor|capacitor|transistor|diode/],
    ["controllers",/arduino|microcontroller|sensor|\bplc\b/],
    ["prototyping",/breadboard|jumper/],
    ["fasteners",/screw|washer|nut|bolt|fastener/],
    ["raw-materials",/aluminum|plastic stock|sheet metal/],
    ["safety",/safety|glasses|ventilation/]
   ];
   return patterns.find(([,pattern])=>pattern.test(str))?.[0]||"";
  };
  const categoryOfPersonal=item=>{
   const linked=matchingReference(item);
   if(linked)return categoryFor(linked);
   const raw=String(item.category||"").toLowerCase(),kind=String(item.kind||"");
   if(/safety|protect/.test(raw))return "safety";
   if(/consumable|wire|cable|solder|shrink|suppl/.test(raw))return "consumables";
   if(/electronic|power|component|controller|sensor/.test(raw))return "electronics";
   if(/hardware|fastener|material|stock/.test(raw))return "hardware";
   if(/tool|equipment|measure|instrument/.test(raw))return "tools";
   return kind==="tool"||kind==="equipment"?"tools":kind==="component"?"electronics":"hardware";
  };
  const ownedFor=ref=>getItems().filter(item=>item.catalogId===ref.id||
   (!item.catalogId&&normalizeName(item.name)===normalizeName(ref.name)));
  const ownershipLabel=records=>records.length?
   "My Workshop · "+records.map(item=>(stockLabels[item.stockStatus]||"In stock")+
    " ("+item.quantity+" "+(item.unit||"pcs")+")").join(", "):"";

  const familyFor=item=>families().find(g=>g.items.includes(item.id));

  const typeRules=[
   ["multimeters","Multimeters",/multimeter/],
   ["oscilloscopes","Oscilloscopes",/oscilloscope|scope probes/],
   ["dc-bench","Bench DC Power Supplies",/bench power supply|bench dc supply/],
   ["ac-dc","AC-to-DC Power Supplies",/ac.to.dc|enclosed.*power supply/],
   ["dc-dc","DC-to-DC Converters",/dc.to.dc|buck converter|boost converter/],
   ["hookup-wire","Hook-Up & Power Wire",/hook.up wire|power wire|signal wire/],
   ["silicone-wire","Flexible Wire",/silicone|high.flex/],
   ["ferrules","Ferrules",/ferrule/],
   ["heat-shrink","Heat-Shrink Tubing",/heat.shrink|shrink tubing/],
   ["solder","Solder & Flux",/solder|flux/],
   ["crimpers","Crimping Tools",/crimping tool|crimper/],
   ["wire-strippers","Wire Strippers & Cutters",/wire stripper|flush cutter/],
   ["sensors","Sensors",/sensor/],
   ["controllers","Development Boards & Controllers",/arduino|microcontroller|plc/],
   ["fasteners","Screws, Nuts & Washers",/screw|fastener|washer|bolt/]
  ];
  const typeFor=item=>{
   const group=typeRules.find(([, ,pattern])=>pattern.test(
    [item.name,item.subtitle||"",item.category||""].join(" ").toLowerCase()));
   if(group)return {id:group[0],label:group[1]};
   const name=String(item.name||"").trim();
   const simplified=name.replace(/^\d+(?:\.\d+)?\s*(?:awg|mm|in)\s+/i,"")
    .replace(/\b(?:assortment|general-purpose|temperature-controlled)\b/gi,"").trim();
   return {id:"other-"+(familyFor(item)?.id||familyOfPersonal(item)||"general"),
    label:simplified?("Other "+(families().find(g=>g.id===(familyFor(item)?.id||familyOfPersonal(item)))?.label||"Products")):"Other products"};
  };

  return Object.freeze({stockLabels,matchingReference,familyOfPersonal,categoryOfPersonal,ownedFor,ownershipLabel,familyFor,typeRules,typeFor});
 }
 window.BSWorkshopModel=Object.freeze({create});
})();
