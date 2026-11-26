// Terminology reviewed against DigiKey's product selection guides, Nov 25 2026.
// No product ratings are seeded. Original IDs/types/units remain intact; ambiguous
// old fields are retained as legacy fields and replaced with explicit definitions.
import {starterFamilies,starterFields} from "./workshop-seed.js";

const guide=path=>"https://forum.digikey.com/t/"+path;
const existing=(key,label,options={})=>({key,label,...options});
const add=(key,label,unit="",type="text")=>({key:"dk-"+key,label,unit,type,added:true});
const legacy=(key,label)=>existing(key,label,{hidden:1});
const mount=()=>add("mounting","Mounting Type");
const temperature=()=>add("temperature","Operating Temperature");
const conditions=()=>add("conditions","Rating / test conditions");
const supply=()=>add("supply-range","Voltage - Supply");
const packageField=()=>add("package","Package / Case");
const sources={
 resistor:guide("selection-guide-for-through-hole-resistors/31505"),capacitor:guide("ceramic-capacitors/31709"),inductor:guide("fixed-inductors/32864"),potentiometer:guide("rotary-potentiometers-rheostats/31826"),
 diode:guide("single-diodes/32928"),led:guide("selection-guide-for-discrete-indicating-light-emitting-diodes-led/33355"),mosfet:guide("transistors-fets-and-mosfets/30804"),bjt:guide("selection-guide-for-single-bipolar-transistors/32969"),
 ic:guide("product-selection-guide-table-of-contents/30383"),mcu:guide("selection-guide-for-embedded-mcu-and-dsp-evaluation-boards/32784"),sbc:guide("single-board-computers-sbcs/33089"),motor:guide("motor-driver-boards-modules/32268"),
 module:guide("expansion-boards-daughter-cards/32789"),proto:guide("prototype-board-perforated/33350"),hall:guide("magnetic-sensors-switches-solid-state/31967"),distance:guide("optical-sensors-distance-measuring/31223"),
 limit:guide("limit-switches/31619"),sensor:guide("specialized-sensors/33661"),switch:guide("pushbutton-switches/31746"),relay:guide("selection-guide-for-power-relays-over-2-a/31630"),connector:guide("headers-male-pins/32204")
};
function template(id,source,description,definitions){
 const family=starterFamilies.find(row=>row.id===id),baseline=starterFields.filter(row=>row.family_id===id),seen=new Set();
 const fields=definitions.map((definition,index)=>{
  const old=baseline.find(row=>row.id===id+"-"+definition.key);
  if(!definition.added&&!old)throw Error("Unknown original template field: "+id+"-"+definition.key);
  const row={...(old||{id:id+"-"+definition.key,family_id:id,choices:[],hidden:0}),label:definition.label,unit:old?.unit??definition.unit,type:old?.type??definition.type,sort_order:index,filled_on_use:0,...(definition.hidden===1?{hidden:1}:{})};
  // Open package/series lists without rejecting any previously saved selection.
  if(row.type==="choice"&&/Package|Series/.test(row.label))row.choices=[];
  seen.add(row.id);return row;
 });
 if(baseline.some(row=>!seen.has(row.id)))throw Error("Every original field must be retained: "+id);
 return {family,baseline,fields,source,description,notes:"Terminology reference: "+source+"\nUse the exact manufacturer's datasheet for values. Record ranges, min/typ/max and test conditions explicitly. Blank means unknown, not zero."};
}
const mosfet=id=>template(id,sources.mosfet,"Record on-resistance together with drain current and gate drive voltage. Gate threshold is not the voltage needed to fully turn the MOSFET on. Preserve the sign and temperature/cooling basis from the datasheet.",[
 existing("vds-max","Drain to Source Voltage (Vdss)"),legacy("id-max","Legacy drain current - verify continuous/pulsed and temperature"),
 add("continuous-drain","Current - Continuous Drain (Id) @ 25°C"),add("drive-voltage","Drive Voltage (Max Rds On, Min Rds On)"),
 legacy("vgs","Legacy Vgs - original unit th; verify before reuse"),add("threshold","Vgs(th) (Max) @ Id"),
 legacy("rds","Legacy Rds - original unit on; verify before reuse"),add("on-resistance","Rds On (Max) @ Id, Vgs"),
 add("vgs-max","Vgs (Max)","V","number"),add("gate-charge","Gate Charge (Qg) (Max) @ Vgs"),add("input-capacitance","Input Capacitance (Ciss) (Max) @ Vds"),
 add("power-dissipation","Power Dissipation (Max)","W","number"),legacy("logic-level","Legacy logic-level assessment - verify drive ratings"),
 existing("package","Package / Case"),add("supplier-package","Supplier Device Package"),mount(),temperature(),conditions()
]);
export const electronicsTemplates=[
 template("f-resistor",sources.resistor,"Use resistance and tolerance from the datasheet. Power is a rated limit subject to temperature derating, not normal circuit consumption.",[
  existing("resistance","Resistance"),existing("power-rating","Power rating"),existing("tolerance","Tolerance"),add("composition","Composition"),add("temperature-coefficient","Temperature Coefficient"),existing("package","Package / Case"),mount(),temperature(),add("dimensions","Size / Dimension"),conditions()
 ]),
 template("f-capacitor",sources.capacitor,"Record capacitor technology and dielectric separately. Capacitance uses µF here; convert a datasheet value before entering it. ESR and ripple-current limits need frequency and temperature conditions.",[
  existing("type","Capacitor technology"),existing("capacitance","Capacitance"),existing("voltage-rating","Voltage - Rated"),add("tolerance","Tolerance","%","number"),add("dielectric","Dielectric / Temperature Coefficient"),add("esr","ESR @ frequency and temperature"),add("ripple-current","Ripple Current @ frequency and temperature"),existing("package","Package / Case"),mount(),temperature(),add("lead-spacing","Lead Spacing","mm","number"),add("dimensions","Size / Dimension"),conditions()
 ]),
 template("f-inductor",sources.inductor,"Current rating and saturation current describe different limits. Keep test frequency, permitted inductance drop and temperature rise with their ratings.",[
  existing("inductance","Inductance"),add("tolerance","Tolerance","%","number"),existing("current-rating","Current Rating"),add("saturation-current","Current - Saturation (Isat)"),add("dcr","DC Resistance (DCR)","Ω","number"),add("shielding","Shielding"),add("core","Material - Core"),add("test-frequency","Inductance Frequency - Test"),add("self-resonance","Frequency - Self Resonant"),existing("package","Package / Case"),mount(),temperature(),conditions()
 ]),
 template("f-potentiometer",sources.potentiometer,"Separate electrical taper from mechanical adjustment type. Record power and resistance tolerance along with the shaft and mounting details needed for fit.",[
  existing("resistance","Resistance"),existing("taper","Taper"),existing("type","Potentiometer type"),add("tolerance","Tolerance","%","number"),add("power","Power rating","W","number"),add("turns","Number of Turns","","number"),add("gangs","Number of Gangs","","number"),add("adjustment","Adjustment Type"),add("actuator","Actuator Type / Dimensions"),add("termination","Termination Style"),mount(),temperature()
 ]),
 template("f-diode",sources.diode,"Use the applicable diode subtype. Rectifier, Zener and TVS ratings are different; leave inapplicable fields blank. Forward voltage must include its test current.",[
  existing("type","Diode type"),existing("reverse-voltage","Reverse voltage rating"),legacy("forward-current","Legacy forward current - verify average/continuous/peak"),add("average-current","Current - Average Rectified (Io)"),add("vf","Voltage - Forward (Vf) (Max) @ If"),existing("zener-voltage","Zener voltage"),add("zener-conditions","Zener voltage tolerance and test current"),add("reverse-leakage","Current - Reverse Leakage @ Vr"),add("recovery","Reverse Recovery Time (trr)"),add("tvs","TVS standoff / breakdown / clamping conditions"),existing("package","Package / Case"),mount(),temperature(),conditions()
 ]),
 template("f-led",sources.led,"Distinguish the current used to measure brightness/forward voltage from the allowed maximum continuous current. Record the LED's electrical configuration as well as its lens and package.",[
  existing("color","Color"),existing("forward-voltage","Forward voltage (Vf)"),legacy("current","Legacy current - verify test current versus maximum"),add("test-current","Current - Test","mA","number"),add("maximum-current","Continuous Forward Current (Max)","mA","number"),add("configuration","Configuration"),add("brightness","Millicandela Rating @ test current"),add("view-angle","Viewing Angle"),add("wavelength","Wavelength - Dominant","nm","number"),existing("size-package","Lens size / package style"),packageField(),mount(),conditions()
 ]),mosfet("f-n-channel-mosfet"),mosfet("f-p-channel-mosfet"),
 template("f-bipolar-transistor",sources.bjt,"Saturation voltage and gain need their associated base/collector current and voltage test conditions. Do not treat hFE as a fixed value at all operating currents.",[
  existing("polarity","Transistor Type"),existing("vce-max","Voltage - Collector Emitter Breakdown (Max)"),existing("ic-max","Current - Collector (Ic) (Max)"),existing("hfe","DC Current Gain (hFE) - include Ic, Vce"),add("saturation","Vce Saturation (Max) @ Ib, Ic"),add("cutoff","Current - Collector Cutoff (Max)"),add("power","Power - Max","W","number"),add("transition","Frequency - Transition"),existing("package","Package / Case"),mount(),temperature(),conditions()
 ]),
 template("f-integrated-circuit",sources.ic,"This is a general IC template, not a substitute for a device-specific template. Add function-specific ratings using Edit template. Supply operating limits are different from absolute maximum ratings.",[
  existing("function","Function"),legacy("supply-voltage","Legacy supply voltage - single value; verify range"),supply(),add("interface","Interface / Logic family"),existing("pin-count","Number of Pins"),existing("package","Package / Case"),add("supplier-package","Supplier Device Package"),mount(),temperature(),add("key-specifications","Function-specific specifications and conditions")
 ]),
 template("f-microcontroller-board",sources.mcu,"Board input voltage and GPIO logic voltage are separate. State memory units exactly; do not assume KB means KiB. Board-level limits must come from the board documentation, not only its MCU datasheet.",[
  existing("mcu","Utilized IC / Part"),add("core","Core Processor"),add("platform","Platform"),existing("logic-voltage","GPIO logic voltage"),add("input-voltage","Board supply / input voltage"),existing("flash","Flash memory"),add("ram","RAM size - include units"),existing("digital-i-o","Digital I/O Lines"),existing("analog-inputs","Analog Input Channels"),existing("usb-connector","USB connector"),existing("wireless","Wireless connectivity"),existing("weight","Weight"),add("interfaces","Interface / expansion buses"),add("dimensions","Size / Dimensions"),conditions()
 ]),
 template("f-single-board-computer",sources.sbc,"Record installed RAM separately from the maximum supported capacity. Include voltage/current requirements with the power input and distinguish onboard storage from a supported storage interface.",[
  existing("processor","Core Processor"),add("speed","Speed"),add("cores","Number of Cores","","number"),existing("ram","RAM installed"),add("ram-capacity","RAM Capacity - include units"),existing("power-input","Power input requirements"),existing("storage","Storage supplied"),add("storage-interface","Storage Interface"),add("expansion","Expansion Site / Bus"),add("video","Video Outputs"),add("ethernet","Ethernet"),add("usb","USB"),add("cooling","Cooling Type"),add("dimensions","Size / Dimensions"),temperature()
 ]),
 template("f-motor-driver",sources.motor,"Separate logic supply from motor/load voltage. Current ratings must state per-channel/per-motor, continuous versus peak, and cooling conditions. Channels are not necessarily the number of independent motors.",[
  existing("motor-type","Motor Type"),existing("supply-voltage-min","Supply voltage min"),existing("supply-voltage-max","Supply voltage max"),existing("current-per-channel","Current per channel - verify rating basis"),existing("channels","Driver channels"),existing("control-interface","Interface"),add("load-voltage","Voltage - Load"),add("current-output","Current - Output (continuous/peak and conditions)"),add("motor-count","Number of Motors","","number"),add("drive-type","Control / Drive Type"),add("step-resolution","Step Resolution"),add("protection","Protection Features"),mount(),temperature(),conditions()
 ]),
 template("f-breakout-module-board",sources.module,"Describe the board-level function and its utilized IC separately. Specify the board supply and logic interface voltage; an onboard regulator does not imply level-shifted GPIO.",[
  existing("function","Function"),existing("interface","Interface"),legacy("supply-voltage","Legacy supply voltage - single value; verify range"),supply(),add("platform","Platform"),add("ic","Utilized IC / Part"),add("logic-voltage","Logic / interface voltage"),add("contents","Contents"),add("dimensions","Size / Dimensions"),mount(),conditions()
 ]),
 template("f-perfboard-protoboard",sources.proto,"Distinguish isolated pads, connected strips and solderless breadboards. Hole pitch, material, thickness and copper pattern are separate specifications.",[
  existing("type","Proto Board Type"),existing("size","Size / Dimensions"),existing("hole-pitch","Pitch"),add("pattern","Circuit Pattern"),add("plating","Plating"),add("material","Board Material"),add("thickness","Board Thickness","mm","number"),add("hole-diameter","Hole Diameter","mm","number"),add("contacts","Edge Contacts"),add("positions","Number of Positions","","number")
 ]),
 template("f-hall-effect-sensor",sources.hall,"Switches, latches and linear Hall sensors have different output behavior. Record magnetic operate/release thresholds with polarity, units and temperature; magnetic-field thresholds are not sensing distances.",[
  existing("type","Hall sensor function"),existing("output","Output Type"),legacy("supply-voltage","Legacy supply voltage - single value; verify range"),supply(),add("polarization","Polarization"),add("magnetic-range","Magnetic Sensing Range / operate-release thresholds"),add("test-condition","Test Condition"),add("supply-current","Current - Supply (Max)"),add("output-current","Current - Output (Max)"),existing("package","Package / Case"),mount(),temperature()
 ]),
 template("f-distance-sensor",sources.distance,"State both ends of the sensing range and the target/lighting conditions. Distance, resolution and accuracy describe different properties; do not substitute one for another.",[
  existing("technology","Sensing Technology"),legacy("range","Legacy range - single value; verify endpoints"),add("distance","Sensing Distance (min to max)"),existing("interface","Interface"),legacy("supply-voltage","Legacy supply voltage - single value; verify range"),supply(),add("output","Output Type"),add("current","Current - Supply"),add("accuracy","Accuracy and test conditions"),add("resolution","Resolution"),add("rate","Measurement / update rate"),add("field-of-view","Field of View"),mount(),temperature(),conditions()
 ]),
 template("f-limit-switch",sources.limit,"Contact current ratings depend on voltage, AC/DC and load type. Record operating force/travel and switch function separately from the contact circuit.",[
  existing("contact-rating","Contact current rating"),existing("actuator","Actuator Type"),existing("contacts","Circuit"),add("function","Switch Function"),add("voltage-ac","Voltage Rating - AC","V","number"),add("voltage-dc","Voltage Rating - DC","V","number"),add("load","Contact rating load / conditions"),add("force","Operating Force"),add("travel","Pretravel / Overtravel"),add("termination","Termination Style"),add("ingress","Ingress Protection"),mount(),temperature()
 ]),
 template("f-sensor-other",sources.sensor,"Use a sensor-specific template when one is available. Record the quantity and units being sensed, output format, range, accuracy and the conditions under which each is specified.",[
  existing("measures","Sensor Type / measured quantity"),existing("interface","Interface"),legacy("supply-voltage","Legacy supply voltage - single value; verify range"),supply(),add("output","Output Type"),add("range","Sensing Range - include units"),add("accuracy","Accuracy and test conditions"),add("resolution","Resolution - include units"),add("response","Response Time / update rate"),packageField(),mount(),temperature()
 ]),
 template("f-switch-pushbutton",sources.switch,"Record the circuit and switch function separately. AC and DC voltage ratings are not interchangeable, and contact-current limits depend on load and voltage.",[
  existing("type","Switch Type"),existing("contact-rating","Current Rating"),legacy("voltage-rating","Legacy voltage rating - verify AC or DC"),add("voltage-ac","Voltage Rating - AC","V","number"),add("voltage-dc","Voltage Rating - DC","V","number"),existing("poles-throws","Circuit"),add("function","Switch Function"),add("actuator","Actuator Type"),existing("mounting","Mounting Type"),add("termination","Termination Style"),add("illumination","Illumination Type / Color / Voltage"),add("ingress","Ingress Protection"),temperature(),conditions()
 ]),
 template("f-relay",sources.relay,"Coil/control ratings are separate from switched-contact ratings. Record AC/DC and load type. For solid-state relays, use input/control range and output ratings rather than inventing a coil specification.",[
  existing("type","Relay / module type"),existing("coil-voltage","Coil voltage - verify AC/DC"),add("coil-voltage","Coil Voltage (AC/DC and nominal rating)"),add("coil-current","Coil Current"),add("coil-type","Coil Type"),existing("contact-rating","Contact Rating (Current)"),existing("contacts","Contact Form"),add("switching-voltage","Switching Voltage (AC/DC and load type)"),add("ssr-input","Solid-state input / control range"),add("timing","Operate / Release Time"),add("termination","Termination Style"),mount(),temperature(),conditions()
 ]),
 template("f-connector",sources.connector,"Connector series and mating contact type are separate from package quantity. Verify the mating partner, pitch, current derating and voltage rating against the exact connector series.",[
  existing("series","Series"),add("type","Connector Type"),existing("gender","Mating contact gender"),existing("pin-count","Number of Positions"),add("rows","Number of Rows","","number"),existing("pitch","Pitch - Mating"),existing("current-rating","Current Rating"),add("voltage","Voltage Rating"),add("contact-type","Contact Type"),add("termination","Termination"),add("fastening","Fastening Type"),add("finish","Contact Finish - Mating"),add("wire-gauge","Wire Gauge - if applicable"),mount(),temperature(),conditions()
 ])
];
