// Editable starter definitions from the approved family/product design. No product ratings or inventory are seeded.
export const starterCategories = [
  {
    "id": "c-power",
    "parent_id": null,
    "name": "Power",
    "sort_order": 0
  },
  {
    "id": "c-c-power-power-supplies",
    "parent_id": "c-power",
    "name": "Power supplies",
    "sort_order": 1
  },
  {
    "id": "c-c-power-dc-dc-converters",
    "parent_id": "c-power",
    "name": "DC-DC converters",
    "sort_order": 2
  },
  {
    "id": "c-c-power-regulators",
    "parent_id": "c-power",
    "name": "Regulators",
    "sort_order": 3
  },
  {
    "id": "c-c-power-batteries",
    "parent_id": "c-power",
    "name": "Batteries",
    "sort_order": 4
  },
  {
    "id": "c-electronics",
    "parent_id": null,
    "name": "Electronics",
    "sort_order": 5
  },
  {
    "id": "c-c-electronics-passives",
    "parent_id": "c-electronics",
    "name": "Passives",
    "sort_order": 6
  },
  {
    "id": "c-c-electronics-semiconductors",
    "parent_id": "c-electronics",
    "name": "Semiconductors",
    "sort_order": 7
  },
  {
    "id": "c-c-electronics-microcontrollers-and-computers",
    "parent_id": "c-electronics",
    "name": "Microcontrollers and computers",
    "sort_order": 8
  },
  {
    "id": "c-c-electronics-boards-and-modules",
    "parent_id": "c-electronics",
    "name": "Boards and modules",
    "sort_order": 9
  },
  {
    "id": "c-c-electronics-sensors",
    "parent_id": "c-electronics",
    "name": "Sensors",
    "sort_order": 10
  },
  {
    "id": "c-c-electronics-switches-and-relays",
    "parent_id": "c-electronics",
    "name": "Switches and relays",
    "sort_order": 11
  },
  {
    "id": "c-c-electronics-connectors",
    "parent_id": "c-electronics",
    "name": "Connectors",
    "sort_order": 12
  },
  {
    "id": "c-motors",
    "parent_id": null,
    "name": "Motors",
    "sort_order": 13
  },
  {
    "id": "c-c-motors-dc-motors",
    "parent_id": "c-motors",
    "name": "DC motors",
    "sort_order": 14
  },
  {
    "id": "c-c-motors-steppers",
    "parent_id": "c-motors",
    "name": "Steppers",
    "sort_order": 15
  },
  {
    "id": "c-c-motors-servos-and-solenoids",
    "parent_id": "c-motors",
    "name": "Servos and solenoids",
    "sort_order": 16
  },
  {
    "id": "c-wire",
    "parent_id": null,
    "name": "Wire",
    "sort_order": 17
  },
  {
    "id": "c-c-wire-wire",
    "parent_id": "c-wire",
    "name": "Wire",
    "sort_order": 18
  },
  {
    "id": "c-c-wire-termination",
    "parent_id": "c-wire",
    "name": "Termination",
    "sort_order": 19
  },
  {
    "id": "c-hardware",
    "parent_id": null,
    "name": "Hardware",
    "sort_order": 20
  },
  {
    "id": "c-c-hardware-fasteners",
    "parent_id": "c-hardware",
    "name": "Fasteners",
    "sort_order": 21
  },
  {
    "id": "c-c-hardware-mechanical",
    "parent_id": "c-hardware",
    "name": "Mechanical",
    "sort_order": 22
  },
  {
    "id": "c-materials",
    "parent_id": null,
    "name": "Materials",
    "sort_order": 23
  },
  {
    "id": "c-c-materials-wood-and-sheet",
    "parent_id": "c-materials",
    "name": "Wood and sheet",
    "sort_order": 24
  },
  {
    "id": "c-c-materials-metal-stock",
    "parent_id": "c-materials",
    "name": "Metal stock",
    "sort_order": 25
  },
  {
    "id": "c-c-materials-3d-printing",
    "parent_id": "c-materials",
    "name": "3D printing",
    "sort_order": 26
  },
  {
    "id": "c-c-materials-finishes-and-adhesives",
    "parent_id": "c-materials",
    "name": "Finishes and adhesives",
    "sort_order": 27
  },
  {
    "id": "c-tools",
    "parent_id": null,
    "name": "Tools",
    "sort_order": 28
  },
  {
    "id": "c-c-tools-soldering",
    "parent_id": "c-tools",
    "name": "Soldering",
    "sort_order": 29
  },
  {
    "id": "c-c-tools-measurement",
    "parent_id": "c-tools",
    "name": "Measurement",
    "sort_order": 30
  },
  {
    "id": "c-c-tools-power-tools",
    "parent_id": "c-tools",
    "name": "Power tools",
    "sort_order": 31
  },
  {
    "id": "c-c-tools-fabrication",
    "parent_id": "c-tools",
    "name": "Fabrication",
    "sort_order": 32
  }
];
export const starterFamilies = [
  {
    "id": "f-dc-power-supply",
    "category_id": "c-c-power-power-supplies",
    "name": "DC power supply",
    "kind": "part"
  },
  {
    "id": "f-buck-converter",
    "category_id": "c-c-power-dc-dc-converters",
    "name": "Buck converter",
    "kind": "part"
  },
  {
    "id": "f-boost-converter",
    "category_id": "c-c-power-dc-dc-converters",
    "name": "Boost converter",
    "kind": "part"
  },
  {
    "id": "f-linear-voltage-regulator",
    "category_id": "c-c-power-regulators",
    "name": "Linear voltage regulator",
    "kind": "part"
  },
  {
    "id": "f-battery-pack",
    "category_id": "c-c-power-batteries",
    "name": "Battery pack",
    "kind": "part"
  },
  {
    "id": "f-resistor",
    "category_id": "c-c-electronics-passives",
    "name": "Resistor",
    "kind": "part"
  },
  {
    "id": "f-capacitor",
    "category_id": "c-c-electronics-passives",
    "name": "Capacitor",
    "kind": "part"
  },
  {
    "id": "f-inductor",
    "category_id": "c-c-electronics-passives",
    "name": "Inductor",
    "kind": "part"
  },
  {
    "id": "f-potentiometer",
    "category_id": "c-c-electronics-passives",
    "name": "Potentiometer",
    "kind": "part"
  },
  {
    "id": "f-diode",
    "category_id": "c-c-electronics-semiconductors",
    "name": "Diode",
    "kind": "part"
  },
  {
    "id": "f-led",
    "category_id": "c-c-electronics-semiconductors",
    "name": "LED",
    "kind": "part"
  },
  {
    "id": "f-n-channel-mosfet",
    "category_id": "c-c-electronics-semiconductors",
    "name": "N-channel MOSFET",
    "kind": "part"
  },
  {
    "id": "f-p-channel-mosfet",
    "category_id": "c-c-electronics-semiconductors",
    "name": "P-channel MOSFET",
    "kind": "part"
  },
  {
    "id": "f-bipolar-transistor",
    "category_id": "c-c-electronics-semiconductors",
    "name": "Bipolar transistor",
    "kind": "part"
  },
  {
    "id": "f-integrated-circuit",
    "category_id": "c-c-electronics-semiconductors",
    "name": "Integrated circuit",
    "kind": "part"
  },
  {
    "id": "f-microcontroller-board",
    "category_id": "c-c-electronics-microcontrollers-and-computers",
    "name": "Microcontroller board",
    "kind": "part"
  },
  {
    "id": "f-single-board-computer",
    "category_id": "c-c-electronics-microcontrollers-and-computers",
    "name": "Single-board computer",
    "kind": "part"
  },
  {
    "id": "f-motor-driver",
    "category_id": "c-c-electronics-boards-and-modules",
    "name": "Motor driver",
    "kind": "part"
  },
  {
    "id": "f-breakout-module-board",
    "category_id": "c-c-electronics-boards-and-modules",
    "name": "Breakout/module board",
    "kind": "part"
  },
  {
    "id": "f-perfboard-protoboard",
    "category_id": "c-c-electronics-boards-and-modules",
    "name": "Perfboard / protoboard",
    "kind": "part"
  },
  {
    "id": "f-hall-effect-sensor",
    "category_id": "c-c-electronics-sensors",
    "name": "Hall effect sensor",
    "kind": "part"
  },
  {
    "id": "f-distance-sensor",
    "category_id": "c-c-electronics-sensors",
    "name": "Distance sensor",
    "kind": "part"
  },
  {
    "id": "f-limit-switch",
    "category_id": "c-c-electronics-sensors",
    "name": "Limit switch",
    "kind": "part"
  },
  {
    "id": "f-sensor-other",
    "category_id": "c-c-electronics-sensors",
    "name": "Sensor (other)",
    "kind": "part"
  },
  {
    "id": "f-switch-pushbutton",
    "category_id": "c-c-electronics-switches-and-relays",
    "name": "Switch / pushbutton",
    "kind": "part"
  },
  {
    "id": "f-relay",
    "category_id": "c-c-electronics-switches-and-relays",
    "name": "Relay",
    "kind": "part"
  },
  {
    "id": "f-connector",
    "category_id": "c-c-electronics-connectors",
    "name": "Connector",
    "kind": "part"
  },
  {
    "id": "f-dc-motor",
    "category_id": "c-c-motors-dc-motors",
    "name": "DC motor",
    "kind": "part"
  },
  {
    "id": "f-stepper-motor",
    "category_id": "c-c-motors-steppers",
    "name": "Stepper motor",
    "kind": "part"
  },
  {
    "id": "f-servo",
    "category_id": "c-c-motors-servos-and-solenoids",
    "name": "Servo",
    "kind": "part"
  },
  {
    "id": "f-solenoid",
    "category_id": "c-c-motors-servos-and-solenoids",
    "name": "Solenoid",
    "kind": "part"
  },
  {
    "id": "f-hookup-wire",
    "category_id": "c-c-wire-wire",
    "name": "Hookup wire",
    "kind": "material"
  },
  {
    "id": "f-multi-conductor-cable",
    "category_id": "c-c-wire-wire",
    "name": "Multi-conductor cable",
    "kind": "material"
  },
  {
    "id": "f-heat-shrink",
    "category_id": "c-c-wire-termination",
    "name": "Heat shrink",
    "kind": "material"
  },
  {
    "id": "f-ferrule-crimp-terminal",
    "category_id": "c-c-wire-termination",
    "name": "Ferrule / crimp terminal",
    "kind": "part"
  },
  {
    "id": "f-socket-head-cap-screw",
    "category_id": "c-c-hardware-fasteners",
    "name": "Socket head cap screw",
    "kind": "part"
  },
  {
    "id": "f-button-head-screw",
    "category_id": "c-c-hardware-fasteners",
    "name": "Button head screw",
    "kind": "part"
  },
  {
    "id": "f-wood-screw",
    "category_id": "c-c-hardware-fasteners",
    "name": "Wood screw",
    "kind": "part"
  },
  {
    "id": "f-nut",
    "category_id": "c-c-hardware-fasteners",
    "name": "Nut",
    "kind": "part"
  },
  {
    "id": "f-washer",
    "category_id": "c-c-hardware-fasteners",
    "name": "Washer",
    "kind": "part"
  },
  {
    "id": "f-standoff",
    "category_id": "c-c-hardware-fasteners",
    "name": "Standoff",
    "kind": "part"
  },
  {
    "id": "f-threaded-insert",
    "category_id": "c-c-hardware-fasteners",
    "name": "Threaded insert",
    "kind": "part"
  },
  {
    "id": "f-bearing",
    "category_id": "c-c-hardware-mechanical",
    "name": "Bearing",
    "kind": "part"
  },
  {
    "id": "f-shaft-rod",
    "category_id": "c-c-hardware-mechanical",
    "name": "Shaft / rod",
    "kind": "part"
  },
  {
    "id": "f-spring",
    "category_id": "c-c-hardware-mechanical",
    "name": "Spring",
    "kind": "part"
  },
  {
    "id": "f-sheet-goods",
    "category_id": "c-c-materials-wood-and-sheet",
    "name": "Sheet goods",
    "kind": "part"
  },
  {
    "id": "f-lumber",
    "category_id": "c-c-materials-wood-and-sheet",
    "name": "Lumber",
    "kind": "part"
  },
  {
    "id": "f-metal-stock",
    "category_id": "c-c-materials-metal-stock",
    "name": "Metal stock",
    "kind": "part"
  },
  {
    "id": "f-filament",
    "category_id": "c-c-materials-3d-printing",
    "name": "Filament",
    "kind": "part"
  },
  {
    "id": "f-paint",
    "category_id": "c-c-materials-finishes-and-adhesives",
    "name": "Paint",
    "kind": "part"
  },
  {
    "id": "f-adhesive",
    "category_id": "c-c-materials-finishes-and-adhesives",
    "name": "Adhesive",
    "kind": "part"
  },
  {
    "id": "f-solder",
    "category_id": "c-c-materials-finishes-and-adhesives",
    "name": "Solder",
    "kind": "part"
  },
  {
    "id": "f-soldering-iron",
    "category_id": "c-c-tools-soldering",
    "name": "Soldering iron",
    "kind": "tool"
  },
  {
    "id": "f-multimeter",
    "category_id": "c-c-tools-measurement",
    "name": "Multimeter",
    "kind": "tool"
  },
  {
    "id": "f-oscilloscope",
    "category_id": "c-c-tools-measurement",
    "name": "Oscilloscope",
    "kind": "tool"
  },
  {
    "id": "f-calipers",
    "category_id": "c-c-tools-measurement",
    "name": "Calipers",
    "kind": "tool"
  },
  {
    "id": "f-bench-power-supply",
    "category_id": "c-c-tools-measurement",
    "name": "Bench power supply",
    "kind": "tool"
  },
  {
    "id": "f-power-tool",
    "category_id": "c-c-tools-power-tools",
    "name": "Power tool",
    "kind": "tool"
  },
  {
    "id": "f-3d-printer",
    "category_id": "c-c-tools-fabrication",
    "name": "3D printer",
    "kind": "tool"
  },
  {
    "id": "f-hand-tool",
    "category_id": "c-c-tools-fabrication",
    "name": "Hand tool",
    "kind": "tool"
  }
];
export const starterFields = [
  {
    "id": "f-dc-power-supply-output-voltage",
    "family_id": "f-dc-power-supply",
    "label": "Output voltage",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-dc-power-supply-output-current",
    "family_id": "f-dc-power-supply",
    "label": "Output current",
    "unit": "A",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-dc-power-supply-input-voltage",
    "family_id": "f-dc-power-supply",
    "label": "Input voltage",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-dc-power-supply-type",
    "family_id": "f-dc-power-supply",
    "label": "Type",
    "unit": "",
    "type": "choice",
    "choices": [
      "wall adapter",
      "enclosed",
      "open frame",
      "USB-C PD"
    ],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-dc-power-supply-connector",
    "family_id": "f-dc-power-supply",
    "label": "Connector",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 4,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-dc-power-supply-weight",
    "family_id": "f-dc-power-supply",
    "label": "Weight",
    "unit": "g",
    "type": "number",
    "choices": [],
    "sort_order": 5,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-buck-converter-input-voltage-min",
    "family_id": "f-buck-converter",
    "label": "Input voltage min",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-buck-converter-input-voltage-max",
    "family_id": "f-buck-converter",
    "label": "Input voltage max",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-buck-converter-output-voltage",
    "family_id": "f-buck-converter",
    "label": "Output voltage",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-buck-converter-adjustable",
    "family_id": "f-buck-converter",
    "label": "Adjustable",
    "unit": "",
    "type": "boolean",
    "choices": [],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-buck-converter-output-current",
    "family_id": "f-buck-converter",
    "label": "Output current",
    "unit": "A",
    "type": "number",
    "choices": [],
    "sort_order": 4,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-buck-converter-controller-ic",
    "family_id": "f-buck-converter",
    "label": "Controller IC",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 5,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-boost-converter-input-voltage-min",
    "family_id": "f-boost-converter",
    "label": "Input voltage min",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-boost-converter-input-voltage-max",
    "family_id": "f-boost-converter",
    "label": "Input voltage max",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-boost-converter-output-voltage",
    "family_id": "f-boost-converter",
    "label": "Output voltage",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-boost-converter-adjustable",
    "family_id": "f-boost-converter",
    "label": "Adjustable",
    "unit": "",
    "type": "boolean",
    "choices": [],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-boost-converter-output-current",
    "family_id": "f-boost-converter",
    "label": "Output current",
    "unit": "A",
    "type": "number",
    "choices": [],
    "sort_order": 4,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-boost-converter-controller-ic",
    "family_id": "f-boost-converter",
    "label": "Controller IC",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 5,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-linear-voltage-regulator-output-voltage",
    "family_id": "f-linear-voltage-regulator",
    "label": "Output voltage",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-linear-voltage-regulator-max-current",
    "family_id": "f-linear-voltage-regulator",
    "label": "Max current",
    "unit": "A",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-linear-voltage-regulator-dropout",
    "family_id": "f-linear-voltage-regulator",
    "label": "Dropout",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-linear-voltage-regulator-package",
    "family_id": "f-linear-voltage-regulator",
    "label": "Package",
    "unit": "",
    "type": "choice",
    "choices": [],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-battery-pack-chemistry",
    "family_id": "f-battery-pack",
    "label": "Chemistry",
    "unit": "",
    "type": "choice",
    "choices": [
      "Li-ion",
      "LiPo",
      "LiFePO4",
      "NiMH",
      "lead-acid",
      "alkaline"
    ],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-battery-pack-nominal-voltage",
    "family_id": "f-battery-pack",
    "label": "Nominal voltage",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-battery-pack-capacity",
    "family_id": "f-battery-pack",
    "label": "Capacity",
    "unit": "mAh",
    "type": "number",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-battery-pack-cells-in-series",
    "family_id": "f-battery-pack",
    "label": "Cells in series",
    "unit": "",
    "type": "number",
    "choices": [],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-battery-pack-max-discharge",
    "family_id": "f-battery-pack",
    "label": "Max discharge",
    "unit": "A",
    "type": "number",
    "choices": [],
    "sort_order": 4,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-battery-pack-connector",
    "family_id": "f-battery-pack",
    "label": "Connector",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 5,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-resistor-resistance",
    "family_id": "f-resistor",
    "label": "Resistance",
    "unit": "Ω",
    "type": "number",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 1
  },
  {
    "id": "f-resistor-power-rating",
    "family_id": "f-resistor",
    "label": "Power rating",
    "unit": "W",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 1
  },
  {
    "id": "f-resistor-tolerance",
    "family_id": "f-resistor",
    "label": "Tolerance",
    "unit": "%",
    "type": "number",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-resistor-package",
    "family_id": "f-resistor",
    "label": "Package",
    "unit": "",
    "type": "choice",
    "choices": [],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-capacitor-capacitance",
    "family_id": "f-capacitor",
    "label": "Capacitance",
    "unit": "µF",
    "type": "number",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 1
  },
  {
    "id": "f-capacitor-voltage-rating",
    "family_id": "f-capacitor",
    "label": "Voltage rating",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 1
  },
  {
    "id": "f-capacitor-type",
    "family_id": "f-capacitor",
    "label": "Type",
    "unit": "",
    "type": "choice",
    "choices": [
      "ceramic",
      "electrolytic",
      "film",
      "tantalum"
    ],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-capacitor-package",
    "family_id": "f-capacitor",
    "label": "Package",
    "unit": "",
    "type": "choice",
    "choices": [],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-inductor-inductance",
    "family_id": "f-inductor",
    "label": "Inductance",
    "unit": "µH",
    "type": "number",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 1
  },
  {
    "id": "f-inductor-current-rating",
    "family_id": "f-inductor",
    "label": "Current rating",
    "unit": "A",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-inductor-package",
    "family_id": "f-inductor",
    "label": "Package",
    "unit": "",
    "type": "choice",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-potentiometer-resistance",
    "family_id": "f-potentiometer",
    "label": "Resistance",
    "unit": "Ω",
    "type": "number",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-potentiometer-taper",
    "family_id": "f-potentiometer",
    "label": "Taper",
    "unit": "",
    "type": "choice",
    "choices": [
      "linear",
      "log"
    ],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-potentiometer-type",
    "family_id": "f-potentiometer",
    "label": "Type",
    "unit": "",
    "type": "choice",
    "choices": [
      "panel",
      "trimmer"
    ],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-diode-type",
    "family_id": "f-diode",
    "label": "Type",
    "unit": "",
    "type": "choice",
    "choices": [
      "rectifier",
      "Schottky",
      "Zener",
      "TVS"
    ],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-diode-reverse-voltage",
    "family_id": "f-diode",
    "label": "Reverse voltage",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-diode-forward-current",
    "family_id": "f-diode",
    "label": "Forward current",
    "unit": "A",
    "type": "number",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-diode-zener-voltage",
    "family_id": "f-diode",
    "label": "Zener voltage",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-diode-package",
    "family_id": "f-diode",
    "label": "Package",
    "unit": "",
    "type": "choice",
    "choices": [],
    "sort_order": 4,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-led-color",
    "family_id": "f-led",
    "label": "Color",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-led-forward-voltage",
    "family_id": "f-led",
    "label": "Forward voltage",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-led-current",
    "family_id": "f-led",
    "label": "Current",
    "unit": "mA",
    "type": "number",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-led-size-package",
    "family_id": "f-led",
    "label": "Size/package",
    "unit": "",
    "type": "choice",
    "choices": [
      "3 mm",
      "5 mm",
      "SMD",
      "strip"
    ],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-n-channel-mosfet-vds-max",
    "family_id": "f-n-channel-mosfet",
    "label": "Vds max",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-n-channel-mosfet-id-max",
    "family_id": "f-n-channel-mosfet",
    "label": "Id max",
    "unit": "A",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-n-channel-mosfet-vgs",
    "family_id": "f-n-channel-mosfet",
    "label": "Vgs",
    "unit": "th",
    "type": "number",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-n-channel-mosfet-rds",
    "family_id": "f-n-channel-mosfet",
    "label": "Rds",
    "unit": "on",
    "type": "number",
    "choices": [],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-n-channel-mosfet-logic-level",
    "family_id": "f-n-channel-mosfet",
    "label": "Logic-level",
    "unit": "",
    "type": "boolean",
    "choices": [],
    "sort_order": 4,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-n-channel-mosfet-package",
    "family_id": "f-n-channel-mosfet",
    "label": "Package",
    "unit": "",
    "type": "choice",
    "choices": [
      "TO-92",
      "TO-220",
      "SOT-23"
    ],
    "sort_order": 5,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-p-channel-mosfet-vds-max",
    "family_id": "f-p-channel-mosfet",
    "label": "Vds max",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-p-channel-mosfet-id-max",
    "family_id": "f-p-channel-mosfet",
    "label": "Id max",
    "unit": "A",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-p-channel-mosfet-vgs",
    "family_id": "f-p-channel-mosfet",
    "label": "Vgs",
    "unit": "th",
    "type": "number",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-p-channel-mosfet-rds",
    "family_id": "f-p-channel-mosfet",
    "label": "Rds",
    "unit": "on",
    "type": "number",
    "choices": [],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-p-channel-mosfet-logic-level",
    "family_id": "f-p-channel-mosfet",
    "label": "Logic-level",
    "unit": "",
    "type": "boolean",
    "choices": [],
    "sort_order": 4,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-p-channel-mosfet-package",
    "family_id": "f-p-channel-mosfet",
    "label": "Package",
    "unit": "",
    "type": "choice",
    "choices": [
      "TO-92",
      "TO-220",
      "SOT-23"
    ],
    "sort_order": 5,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-bipolar-transistor-polarity",
    "family_id": "f-bipolar-transistor",
    "label": "Polarity",
    "unit": "",
    "type": "choice",
    "choices": [
      "NPN",
      "PNP"
    ],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-bipolar-transistor-vce-max",
    "family_id": "f-bipolar-transistor",
    "label": "Vce max",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-bipolar-transistor-ic-max",
    "family_id": "f-bipolar-transistor",
    "label": "Ic max",
    "unit": "A",
    "type": "number",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-bipolar-transistor-hfe",
    "family_id": "f-bipolar-transistor",
    "label": "hFE",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-bipolar-transistor-package",
    "family_id": "f-bipolar-transistor",
    "label": "Package",
    "unit": "",
    "type": "choice",
    "choices": [],
    "sort_order": 4,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-integrated-circuit-function",
    "family_id": "f-integrated-circuit",
    "label": "Function",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-integrated-circuit-supply-voltage",
    "family_id": "f-integrated-circuit",
    "label": "Supply voltage",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-integrated-circuit-package",
    "family_id": "f-integrated-circuit",
    "label": "Package",
    "unit": "",
    "type": "choice",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-integrated-circuit-pin-count",
    "family_id": "f-integrated-circuit",
    "label": "Pin count",
    "unit": "",
    "type": "number",
    "choices": [],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-microcontroller-board-mcu",
    "family_id": "f-microcontroller-board",
    "label": "MCU",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-microcontroller-board-logic-voltage",
    "family_id": "f-microcontroller-board",
    "label": "Logic voltage",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-microcontroller-board-flash",
    "family_id": "f-microcontroller-board",
    "label": "Flash",
    "unit": "KB",
    "type": "number",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-microcontroller-board-digital-i-o",
    "family_id": "f-microcontroller-board",
    "label": "Digital I/O",
    "unit": "",
    "type": "number",
    "choices": [],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-microcontroller-board-analog-inputs",
    "family_id": "f-microcontroller-board",
    "label": "Analog inputs",
    "unit": "",
    "type": "number",
    "choices": [],
    "sort_order": 4,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-microcontroller-board-usb-connector",
    "family_id": "f-microcontroller-board",
    "label": "USB connector",
    "unit": "",
    "type": "choice",
    "choices": [],
    "sort_order": 5,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-microcontroller-board-wireless",
    "family_id": "f-microcontroller-board",
    "label": "Wireless",
    "unit": "",
    "type": "choice",
    "choices": [
      "none",
      "Wi-Fi",
      "BLE",
      "Wi-Fi+BLE"
    ],
    "sort_order": 6,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-microcontroller-board-weight",
    "family_id": "f-microcontroller-board",
    "label": "Weight",
    "unit": "g",
    "type": "number",
    "choices": [],
    "sort_order": 7,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-single-board-computer-processor",
    "family_id": "f-single-board-computer",
    "label": "Processor",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-single-board-computer-ram",
    "family_id": "f-single-board-computer",
    "label": "RAM",
    "unit": "GB",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-single-board-computer-power-input",
    "family_id": "f-single-board-computer",
    "label": "Power input",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-single-board-computer-storage",
    "family_id": "f-single-board-computer",
    "label": "Storage",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-motor-driver-motor-type",
    "family_id": "f-motor-driver",
    "label": "Motor type",
    "unit": "",
    "type": "choice",
    "choices": [
      "DC",
      "stepper",
      "BLDC"
    ],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-motor-driver-supply-voltage-min",
    "family_id": "f-motor-driver",
    "label": "Supply voltage min",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-motor-driver-supply-voltage-max",
    "family_id": "f-motor-driver",
    "label": "Supply voltage max",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-motor-driver-current-per-channel",
    "family_id": "f-motor-driver",
    "label": "Current per channel",
    "unit": "A",
    "type": "number",
    "choices": [],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-motor-driver-channels",
    "family_id": "f-motor-driver",
    "label": "Channels",
    "unit": "",
    "type": "number",
    "choices": [],
    "sort_order": 4,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-motor-driver-control-interface",
    "family_id": "f-motor-driver",
    "label": "Control interface",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 5,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-breakout-module-board-function",
    "family_id": "f-breakout-module-board",
    "label": "Function",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-breakout-module-board-interface",
    "family_id": "f-breakout-module-board",
    "label": "Interface",
    "unit": "",
    "type": "choice",
    "choices": [
      "I2C",
      "SPI",
      "UART",
      "GPIO",
      "analog"
    ],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-breakout-module-board-supply-voltage",
    "family_id": "f-breakout-module-board",
    "label": "Supply voltage",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-perfboard-protoboard-size",
    "family_id": "f-perfboard-protoboard",
    "label": "Size",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-perfboard-protoboard-hole-pitch",
    "family_id": "f-perfboard-protoboard",
    "label": "Hole pitch",
    "unit": "mm",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-perfboard-protoboard-type",
    "family_id": "f-perfboard-protoboard",
    "label": "Type",
    "unit": "",
    "type": "choice",
    "choices": [
      "perfboard",
      "stripboard",
      "breadboard"
    ],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-hall-effect-sensor-type",
    "family_id": "f-hall-effect-sensor",
    "label": "Type",
    "unit": "",
    "type": "choice",
    "choices": [
      "switch",
      "latch",
      "linear"
    ],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-hall-effect-sensor-supply-voltage",
    "family_id": "f-hall-effect-sensor",
    "label": "Supply voltage",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-hall-effect-sensor-output",
    "family_id": "f-hall-effect-sensor",
    "label": "Output",
    "unit": "",
    "type": "choice",
    "choices": [
      "open drain",
      "analog"
    ],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-hall-effect-sensor-package",
    "family_id": "f-hall-effect-sensor",
    "label": "Package",
    "unit": "",
    "type": "choice",
    "choices": [],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-distance-sensor-technology",
    "family_id": "f-distance-sensor",
    "label": "Technology",
    "unit": "",
    "type": "choice",
    "choices": [
      "ultrasonic",
      "IR",
      "time-of-flight"
    ],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-distance-sensor-range",
    "family_id": "f-distance-sensor",
    "label": "Range",
    "unit": "mm",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-distance-sensor-interface",
    "family_id": "f-distance-sensor",
    "label": "Interface",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-distance-sensor-supply-voltage",
    "family_id": "f-distance-sensor",
    "label": "Supply voltage",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-limit-switch-contact-rating",
    "family_id": "f-limit-switch",
    "label": "Contact rating",
    "unit": "A",
    "type": "number",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-limit-switch-actuator",
    "family_id": "f-limit-switch",
    "label": "Actuator",
    "unit": "",
    "type": "choice",
    "choices": [
      "plain",
      "lever",
      "roller"
    ],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-limit-switch-contacts",
    "family_id": "f-limit-switch",
    "label": "Contacts",
    "unit": "",
    "type": "choice",
    "choices": [
      "NO",
      "NC",
      "NO+NC"
    ],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-sensor-other-measures",
    "family_id": "f-sensor-other",
    "label": "Measures",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-sensor-other-interface",
    "family_id": "f-sensor-other",
    "label": "Interface",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-sensor-other-supply-voltage",
    "family_id": "f-sensor-other",
    "label": "Supply voltage",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-switch-pushbutton-type",
    "family_id": "f-switch-pushbutton",
    "label": "Type",
    "unit": "",
    "type": "choice",
    "choices": [
      "toggle",
      "rocker",
      "slide",
      "momentary pushbutton"
    ],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-switch-pushbutton-contact-rating",
    "family_id": "f-switch-pushbutton",
    "label": "Contact rating",
    "unit": "A",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-switch-pushbutton-voltage-rating",
    "family_id": "f-switch-pushbutton",
    "label": "Voltage rating",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-switch-pushbutton-poles-throws",
    "family_id": "f-switch-pushbutton",
    "label": "Poles/throws",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-switch-pushbutton-mounting",
    "family_id": "f-switch-pushbutton",
    "label": "Mounting",
    "unit": "",
    "type": "choice",
    "choices": [
      "panel",
      "PCB"
    ],
    "sort_order": 4,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-relay-coil-voltage",
    "family_id": "f-relay",
    "label": "Coil voltage",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-relay-contact-rating",
    "family_id": "f-relay",
    "label": "Contact rating",
    "unit": "A",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-relay-contacts",
    "family_id": "f-relay",
    "label": "Contacts",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-relay-type",
    "family_id": "f-relay",
    "label": "Type",
    "unit": "",
    "type": "choice",
    "choices": [
      "module",
      "bare",
      "solid-state"
    ],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-connector-series",
    "family_id": "f-connector",
    "label": "Series",
    "unit": "",
    "type": "choice",
    "choices": [
      "JST-XH",
      "JST-PH",
      "Dupont",
      "XT30",
      "XT60",
      "barrel",
      "terminal block"
    ],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-connector-pin-count",
    "family_id": "f-connector",
    "label": "Pin count",
    "unit": "",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-connector-pitch",
    "family_id": "f-connector",
    "label": "Pitch",
    "unit": "mm",
    "type": "number",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-connector-current-rating",
    "family_id": "f-connector",
    "label": "Current rating",
    "unit": "A",
    "type": "number",
    "choices": [],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-connector-gender",
    "family_id": "f-connector",
    "label": "Gender",
    "unit": "",
    "type": "choice",
    "choices": [
      "male",
      "female",
      "pair"
    ],
    "sort_order": 4,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-dc-motor-voltage",
    "family_id": "f-dc-motor",
    "label": "Voltage",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-dc-motor-no-load-speed",
    "family_id": "f-dc-motor",
    "label": "No-load speed",
    "unit": "rpm",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-dc-motor-stall-current",
    "family_id": "f-dc-motor",
    "label": "Stall current",
    "unit": "A",
    "type": "number",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-dc-motor-gear-ratio",
    "family_id": "f-dc-motor",
    "label": "Gear ratio",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-dc-motor-shaft-diameter",
    "family_id": "f-dc-motor",
    "label": "Shaft diameter",
    "unit": "mm",
    "type": "number",
    "choices": [],
    "sort_order": 4,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-stepper-motor-frame-size",
    "family_id": "f-stepper-motor",
    "label": "Frame size",
    "unit": "",
    "type": "choice",
    "choices": [
      "NEMA 8",
      "11",
      "14",
      "17",
      "23"
    ],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-stepper-motor-step-angle",
    "family_id": "f-stepper-motor",
    "label": "Step angle",
    "unit": "°",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-stepper-motor-rated-current",
    "family_id": "f-stepper-motor",
    "label": "Rated current",
    "unit": "A",
    "type": "number",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-stepper-motor-holding-torque",
    "family_id": "f-stepper-motor",
    "label": "Holding torque",
    "unit": "N·cm",
    "type": "number",
    "choices": [],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-stepper-motor-shaft-diameter",
    "family_id": "f-stepper-motor",
    "label": "Shaft diameter",
    "unit": "mm",
    "type": "number",
    "choices": [],
    "sort_order": 4,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-servo-torque",
    "family_id": "f-servo",
    "label": "Torque",
    "unit": "kg·cm",
    "type": "number",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-servo-speed",
    "family_id": "f-servo",
    "label": "Speed",
    "unit": "s/60°",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-servo-voltage",
    "family_id": "f-servo",
    "label": "Voltage",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-servo-rotation",
    "family_id": "f-servo",
    "label": "Rotation",
    "unit": "",
    "type": "choice",
    "choices": [
      "180°",
      "continuous"
    ],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-solenoid-voltage",
    "family_id": "f-solenoid",
    "label": "Voltage",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-solenoid-current",
    "family_id": "f-solenoid",
    "label": "Current",
    "unit": "A",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-solenoid-stroke",
    "family_id": "f-solenoid",
    "label": "Stroke",
    "unit": "mm",
    "type": "number",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-solenoid-action",
    "family_id": "f-solenoid",
    "label": "Action",
    "unit": "",
    "type": "choice",
    "choices": [
      "push",
      "pull"
    ],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-hookup-wire-gauge",
    "family_id": "f-hookup-wire",
    "label": "Gauge",
    "unit": "AWG",
    "type": "number",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-hookup-wire-conductor",
    "family_id": "f-hookup-wire",
    "label": "Conductor",
    "unit": "",
    "type": "choice",
    "choices": [
      "solid",
      "stranded"
    ],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-hookup-wire-insulation",
    "family_id": "f-hookup-wire",
    "label": "Insulation",
    "unit": "",
    "type": "choice",
    "choices": [
      "PVC",
      "silicone",
      "PTFE"
    ],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-hookup-wire-color",
    "family_id": "f-hookup-wire",
    "label": "Color",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 1
  },
  {
    "id": "f-hookup-wire-length",
    "family_id": "f-hookup-wire",
    "label": "Length",
    "unit": "m",
    "type": "number",
    "choices": [],
    "sort_order": 4,
    "hidden": 0,
    "filled_on_use": 1
  },
  {
    "id": "f-multi-conductor-cable-conductors",
    "family_id": "f-multi-conductor-cable",
    "label": "Conductors",
    "unit": "",
    "type": "number",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-multi-conductor-cable-gauge",
    "family_id": "f-multi-conductor-cable",
    "label": "Gauge",
    "unit": "AWG",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-multi-conductor-cable-shielded",
    "family_id": "f-multi-conductor-cable",
    "label": "Shielded",
    "unit": "",
    "type": "boolean",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-multi-conductor-cable-length",
    "family_id": "f-multi-conductor-cable",
    "label": "Length",
    "unit": "m",
    "type": "number",
    "choices": [],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 1
  },
  {
    "id": "f-heat-shrink-diameter",
    "family_id": "f-heat-shrink",
    "label": "Diameter",
    "unit": "mm",
    "type": "number",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-heat-shrink-shrink-ratio",
    "family_id": "f-heat-shrink",
    "label": "Shrink ratio",
    "unit": "",
    "type": "choice",
    "choices": [
      "2:1",
      "3:1"
    ],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-heat-shrink-color",
    "family_id": "f-heat-shrink",
    "label": "Color",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-ferrule-crimp-terminal-type",
    "family_id": "f-ferrule-crimp-terminal",
    "label": "Type",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-ferrule-crimp-terminal-wire-gauge-range",
    "family_id": "f-ferrule-crimp-terminal",
    "label": "Wire gauge range",
    "unit": "AWG",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-socket-head-cap-screw-thread",
    "family_id": "f-socket-head-cap-screw",
    "label": "Thread",
    "unit": "",
    "type": "choice",
    "choices": [
      "M2",
      "M2.5",
      "M3",
      "M4",
      "M5",
      "#4-40",
      "#6-32"
    ],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-socket-head-cap-screw-length",
    "family_id": "f-socket-head-cap-screw",
    "label": "Length",
    "unit": "mm",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 1
  },
  {
    "id": "f-socket-head-cap-screw-material",
    "family_id": "f-socket-head-cap-screw",
    "label": "Material",
    "unit": "",
    "type": "choice",
    "choices": [
      "steel",
      "stainless",
      "nylon"
    ],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-button-head-screw-thread",
    "family_id": "f-button-head-screw",
    "label": "Thread",
    "unit": "",
    "type": "choice",
    "choices": [
      "M2",
      "M2.5",
      "M3",
      "M4",
      "M5",
      "#4-40",
      "#6-32"
    ],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-button-head-screw-length",
    "family_id": "f-button-head-screw",
    "label": "Length",
    "unit": "mm",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 1
  },
  {
    "id": "f-button-head-screw-material",
    "family_id": "f-button-head-screw",
    "label": "Material",
    "unit": "",
    "type": "choice",
    "choices": [
      "steel",
      "stainless",
      "nylon"
    ],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-wood-screw-size",
    "family_id": "f-wood-screw",
    "label": "Size",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-wood-screw-length",
    "family_id": "f-wood-screw",
    "label": "Length",
    "unit": "mm",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 1
  },
  {
    "id": "f-wood-screw-head",
    "family_id": "f-wood-screw",
    "label": "Head",
    "unit": "",
    "type": "choice",
    "choices": [
      "flat",
      "pan"
    ],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-wood-screw-drive",
    "family_id": "f-wood-screw",
    "label": "Drive",
    "unit": "",
    "type": "choice",
    "choices": [
      "Phillips",
      "Torx",
      "square"
    ],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-nut-thread",
    "family_id": "f-nut",
    "label": "Thread",
    "unit": "",
    "type": "choice",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-nut-type",
    "family_id": "f-nut",
    "label": "Type",
    "unit": "",
    "type": "choice",
    "choices": [
      "hex",
      "nylon lock",
      "flange"
    ],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-nut-material",
    "family_id": "f-nut",
    "label": "Material",
    "unit": "",
    "type": "choice",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-washer-size",
    "family_id": "f-washer",
    "label": "Size",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-washer-type",
    "family_id": "f-washer",
    "label": "Type",
    "unit": "",
    "type": "choice",
    "choices": [
      "flat",
      "split lock",
      "fender"
    ],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-washer-material",
    "family_id": "f-washer",
    "label": "Material",
    "unit": "",
    "type": "choice",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-standoff-thread",
    "family_id": "f-standoff",
    "label": "Thread",
    "unit": "",
    "type": "choice",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-standoff-length",
    "family_id": "f-standoff",
    "label": "Length",
    "unit": "mm",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 1
  },
  {
    "id": "f-standoff-type",
    "family_id": "f-standoff",
    "label": "Type",
    "unit": "",
    "type": "choice",
    "choices": [
      "M-F",
      "F-F",
      "M-M"
    ],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-standoff-material",
    "family_id": "f-standoff",
    "label": "Material",
    "unit": "",
    "type": "choice",
    "choices": [
      "brass",
      "nylon",
      "steel"
    ],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-threaded-insert-thread",
    "family_id": "f-threaded-insert",
    "label": "Thread",
    "unit": "",
    "type": "choice",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-threaded-insert-length",
    "family_id": "f-threaded-insert",
    "label": "Length",
    "unit": "mm",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-threaded-insert-type",
    "family_id": "f-threaded-insert",
    "label": "Type",
    "unit": "",
    "type": "choice",
    "choices": [
      "heat-set",
      "press-fit",
      "wood"
    ],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-bearing-bore",
    "family_id": "f-bearing",
    "label": "Bore",
    "unit": "mm",
    "type": "number",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-bearing-outer-diameter",
    "family_id": "f-bearing",
    "label": "Outer diameter",
    "unit": "mm",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-bearing-width",
    "family_id": "f-bearing",
    "label": "Width",
    "unit": "mm",
    "type": "number",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-bearing-type",
    "family_id": "f-bearing",
    "label": "Type",
    "unit": "",
    "type": "choice",
    "choices": [
      "ball",
      "flanged",
      "linear",
      "thrust"
    ],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-shaft-rod-diameter",
    "family_id": "f-shaft-rod",
    "label": "Diameter",
    "unit": "mm",
    "type": "number",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-shaft-rod-length",
    "family_id": "f-shaft-rod",
    "label": "Length",
    "unit": "mm",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 1
  },
  {
    "id": "f-shaft-rod-material",
    "family_id": "f-shaft-rod",
    "label": "Material",
    "unit": "",
    "type": "choice",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-shaft-rod-type",
    "family_id": "f-shaft-rod",
    "label": "Type",
    "unit": "",
    "type": "choice",
    "choices": [
      "smooth",
      "threaded",
      "D-shaft"
    ],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-spring-type",
    "family_id": "f-spring",
    "label": "Type",
    "unit": "",
    "type": "choice",
    "choices": [
      "compression",
      "extension",
      "torsion"
    ],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-spring-outer-diameter",
    "family_id": "f-spring",
    "label": "Outer diameter",
    "unit": "mm",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-spring-length",
    "family_id": "f-spring",
    "label": "Length",
    "unit": "mm",
    "type": "number",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-spring-rate",
    "family_id": "f-spring",
    "label": "Rate",
    "unit": "N/mm",
    "type": "number",
    "choices": [],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-sheet-goods-material",
    "family_id": "f-sheet-goods",
    "label": "Material",
    "unit": "",
    "type": "choice",
    "choices": [
      "plywood",
      "MDF",
      "hardboard",
      "acrylic",
      "polycarbonate"
    ],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-sheet-goods-thickness",
    "family_id": "f-sheet-goods",
    "label": "Thickness",
    "unit": "mm",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-sheet-goods-size",
    "family_id": "f-sheet-goods",
    "label": "Size",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 1
  },
  {
    "id": "f-lumber-species",
    "family_id": "f-lumber",
    "label": "Species",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-lumber-nominal-size",
    "family_id": "f-lumber",
    "label": "Nominal size",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-lumber-length",
    "family_id": "f-lumber",
    "label": "Length",
    "unit": "mm",
    "type": "number",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 1
  },
  {
    "id": "f-metal-stock-alloy",
    "family_id": "f-metal-stock",
    "label": "Alloy",
    "unit": "",
    "type": "choice",
    "choices": [
      "6061 aluminum",
      "mild steel",
      "stainless",
      "brass"
    ],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-metal-stock-shape",
    "family_id": "f-metal-stock",
    "label": "Shape",
    "unit": "",
    "type": "choice",
    "choices": [
      "sheet",
      "bar",
      "round",
      "tube",
      "angle"
    ],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-metal-stock-dimensions",
    "family_id": "f-metal-stock",
    "label": "Dimensions",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-metal-stock-length",
    "family_id": "f-metal-stock",
    "label": "Length",
    "unit": "mm",
    "type": "number",
    "choices": [],
    "sort_order": 3,
    "hidden": 0,
    "filled_on_use": 1
  },
  {
    "id": "f-filament-material",
    "family_id": "f-filament",
    "label": "Material",
    "unit": "",
    "type": "choice",
    "choices": [
      "PLA",
      "PETG",
      "ABS",
      "ASA",
      "TPU"
    ],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-filament-diameter",
    "family_id": "f-filament",
    "label": "Diameter",
    "unit": "",
    "type": "choice",
    "choices": [
      "1.75",
      "2.85 mm"
    ],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-filament-color",
    "family_id": "f-filament",
    "label": "Color",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-paint-type",
    "family_id": "f-paint",
    "label": "Type",
    "unit": "",
    "type": "choice",
    "choices": [
      "spray",
      "acrylic",
      "enamel",
      "primer",
      "clear coat"
    ],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-paint-color",
    "family_id": "f-paint",
    "label": "Color",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-paint-finish",
    "family_id": "f-paint",
    "label": "Finish",
    "unit": "",
    "type": "choice",
    "choices": [
      "matte",
      "satin",
      "gloss"
    ],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-adhesive-type",
    "family_id": "f-adhesive",
    "label": "Type",
    "unit": "",
    "type": "choice",
    "choices": [
      "CA",
      "epoxy",
      "hot glue",
      "wood glue",
      "construction"
    ],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-adhesive-cure-time",
    "family_id": "f-adhesive",
    "label": "Cure time",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-solder-alloy",
    "family_id": "f-solder",
    "label": "Alloy",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-solder-diameter",
    "family_id": "f-solder",
    "label": "Diameter",
    "unit": "mm",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-solder-flux-core",
    "family_id": "f-solder",
    "label": "Flux core",
    "unit": "",
    "type": "boolean",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-soldering-iron-power",
    "family_id": "f-soldering-iron",
    "label": "Power",
    "unit": "W",
    "type": "number",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-soldering-iron-tip-type",
    "family_id": "f-soldering-iron",
    "label": "Tip type",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-soldering-iron-temperature-range",
    "family_id": "f-soldering-iron",
    "label": "Temperature range",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-multimeter-ranges",
    "family_id": "f-multimeter",
    "label": "Ranges",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-multimeter-safety-rating",
    "family_id": "f-multimeter",
    "label": "Safety rating",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-multimeter-true-rms",
    "family_id": "f-multimeter",
    "label": "True RMS",
    "unit": "",
    "type": "boolean",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-oscilloscope-bandwidth",
    "family_id": "f-oscilloscope",
    "label": "Bandwidth",
    "unit": "MHz",
    "type": "number",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-oscilloscope-channels",
    "family_id": "f-oscilloscope",
    "label": "Channels",
    "unit": "",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-oscilloscope-sample-rate",
    "family_id": "f-oscilloscope",
    "label": "Sample rate",
    "unit": "MS/s",
    "type": "number",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-calipers-range",
    "family_id": "f-calipers",
    "label": "Range",
    "unit": "mm",
    "type": "number",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-calipers-resolution",
    "family_id": "f-calipers",
    "label": "Resolution",
    "unit": "mm",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-calipers-type",
    "family_id": "f-calipers",
    "label": "Type",
    "unit": "",
    "type": "choice",
    "choices": [
      "digital",
      "dial",
      "vernier"
    ],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-bench-power-supply-max-voltage",
    "family_id": "f-bench-power-supply",
    "label": "Max voltage",
    "unit": "V",
    "type": "number",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-bench-power-supply-max-current",
    "family_id": "f-bench-power-supply",
    "label": "Max current",
    "unit": "A",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-bench-power-supply-channels",
    "family_id": "f-bench-power-supply",
    "label": "Channels",
    "unit": "",
    "type": "number",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-power-tool-type",
    "family_id": "f-power-tool",
    "label": "Type",
    "unit": "",
    "type": "choice",
    "choices": [
      "drill/driver",
      "impact driver",
      "saw",
      "sander",
      "rotary tool"
    ],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-power-tool-power",
    "family_id": "f-power-tool",
    "label": "Power",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-3d-printer-build-volume",
    "family_id": "f-3d-printer",
    "label": "Build volume",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-3d-printer-nozzle",
    "family_id": "f-3d-printer",
    "label": "Nozzle",
    "unit": "mm",
    "type": "number",
    "choices": [],
    "sort_order": 1,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-3d-printer-materials",
    "family_id": "f-3d-printer",
    "label": "Materials",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 2,
    "hidden": 0,
    "filled_on_use": 0
  },
  {
    "id": "f-hand-tool-type",
    "family_id": "f-hand-tool",
    "label": "Type",
    "unit": "",
    "type": "text",
    "choices": [],
    "sort_order": 0,
    "hidden": 0,
    "filled_on_use": 0
  }
];
