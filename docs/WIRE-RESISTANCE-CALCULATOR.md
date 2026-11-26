# Wire resistance calculator

Added to the shared Info Bits calculator directory; the standalone and retained legacy calculator routes use the same modules. No database, project, upload, account, or AI changes. Inputs persist only in browser storage under `bs-wire-resistance`; blocked storage leaves the tool usable.

Source requested by Ryan: https://claude.ai/artifact/8cETEvdbEQEXQhgH3ZDYrq (Wire resistance calculator). Ported the calculator's controls and calculations into the site's own controls/theme. No Claude frame runtime, external fonts, scripts, iframe, or network dependency is shipped. Both length/resistance modes, AWG/custom diameter, material/custom resistivity, room temperature, current/cold-power load, surface/insulation choices and gauge comparison remain. Table gauge choices support keyboard as well as pointer input.

## Equations and corrections

- Solid round DC wire: `R = rho20 * (1 + alpha * (T - 20)) * L / (pi * (d / 2)^2)`.
- AWG: `d(mm) = 0.127 * 92^((36 - n) / 39)`, 4/0 = -3 through 40.
- Power input means cold `I²R` at the selected room temperature; current is held constant during heating. It is explicitly labeled this way rather than claiming constant warm power.
- Thermal balance: Churchill–Chu horizontal-cylinder natural convection plus radiation, with the artifact's approximate air-property model and emissivities. Bisection solves the coupled balance, replacing an unverified fixed-point iteration.
- Correct warm resistivity at non-20°C ambient: `Rhot/Rambient = (1 + alpha*(Thot-20))/(1 + alpha*(Tambient-20))`.
- Temperatures above 250°C absolute or a 200°C rise are reported outside the model; no extrapolated number or safety certification. The model ignores thick insulation, coils, mounting conduction, bundles and enclosures. Alloy TCRs are near-room estimates, not high-temperature supplier curves. Custom resistivity assumes alpha=0 and says so.
- Invalid/blank/nonfinite inputs clear all previous output, heat and comparison rows. No stale result is presented as current.
- Manganin default corrected from the artifact's 4.82e-7 to manufacturer nominal 4.3e-7 Ω·m. Other defaults retained as typical values: Cu 1.724e-8, Al 2.82e-8, Constantan 4.9e-7, NiCr80/20 1.10e-6, Kanthal A-1 1.45e-6 Ω·m. These are not batch-specific calibration values.

Primary material references consulted November 26, 2026:

- Isabellenhütte resistance alloys, MANGANIN 43 μΩ·cm and ISOTAN (CuNi44) 49 μΩ·cm: https://www.isabellenhuette.com/de/loesungen/legierungen/widerstandslegierungen
- Kanthal A-1 1.45 Ω·mm²/m at 20°C: https://www.kanthal.com/en/products/datasheets/material-datasheets/wire/resistance-heating-wire-and-resistance-wire/kanthal-a-1/
- Correlation reference/implementation: https://ht.readthedocs.io/en/release/ht.conv_free_immersed.html#ht.conv_free_immersed.Nu_horizontal_cylinder_Churchill_Chu

## Validation

Node tests cover gauge/reference dimensions, DC resistance, unit conversion, ambient correction, energy balance, cold-power semantics, zero load, invalid inputs and out-of-range heating. Browser tests exercise all three routes at desktop/phone sizes, modes, custom wire data, keyboard gauge selection, storage/reopening, stale-result clearing and horizontal page overflow. Existing calculator discovery/navigation workflows remain required.
