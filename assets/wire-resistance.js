// Solid round wire, DC. SI units internally; no DOM or saved project data.
// Material values and the thermal model's limits are documented in docs/WIRE-RESISTANCE-CALCULATOR.md.
export const wireMaterials = [
  { id: "cu", name: "Copper (annealed)", rho: 1.724e-8, alpha: 0.00393 },
  { id: "al", name: "Aluminum", rho: 2.82e-8, alpha: 0.00403 },
  { id: "manganin", name: "Manganin", rho: 4.3e-7, alpha: 0.000002 },
  { id: "constantan", name: "Constantan", rho: 4.9e-7, alpha: 0.000008 },
  { id: "nichrome", name: "Nichrome 80/20", rho: 1.1e-6, alpha: 0.0001 },
  { id: "kanthal", name: "Kanthal A-1", rho: 1.45e-6, alpha: 0.00004 },
  { id: "custom", name: "Custom resistivity", rho: null, alpha: 0 },
];
export const wireGauges = [
  "0000",
  "000",
  "00",
  "0",
  ...Array.from({ length: 40 }, (_, i) => String(i + 1)),
];
export function awgDiameterMm(gauge) {
  const g = String(gauge);
  if (!wireGauges.includes(g))
    throw new RangeError("Choose a gauge from 4/0 through 40 AWG.");
  const number = g.startsWith("0") ? 1 - g.length : Number(g);
  return 0.127 * 92 ** ((36 - number) / 39);
}
export const wireAreaM2 = (diameterMm) => Math.PI * (diameterMm / 2000) ** 2;
export function wireProperties({ rho20, alpha, tempC, diameterMm }) {
  if (
    ![rho20, alpha, tempC, diameterMm].every(Number.isFinite) ||
    rho20 <= 0 ||
    diameterMm <= 0 ||
    tempC <= -273.15
  )
    throw new RangeError(
      "Enter positive resistivity and diameter, and a temperature above absolute zero.",
    );
  const factor = 1 + alpha * (tempC - 20),
    rho = rho20 * factor,
    ohmPerM = rho / wireAreaM2(diameterMm);
  if (factor <= 0 || !Number.isFinite(ohmPerM) || ohmPerM <= 0)
    throw new RangeError(
      "These inputs are outside the resistance model's range.",
    );
  return { rho, ohmPerM, ambientFactor: factor };
}
// Churchill–Chu horizontal-cylinder natural convection plus radiation. The
// diameter represents a thinly coated wire; insulation conduction is not modeled.
export function wireHeatLoss({ riseC, diameterMm, ambientC, emissivity }) {
  const d = diameterMm / 1000,
    Ta = ambientC + 273.15,
    Ts = Ta + riseC,
    Tf = (Ts + Ta) / 2;
  const nu = 1.589e-5 * (Tf / 300) ** 1.7,
    k = 0.0263 * (Tf / 300) ** 0.8,
    diffusivity = nu / 0.707;
  const Ra = ((9.81 / Tf) * riseC * d ** 3) / (nu * diffusivity);
  const Nu =
    (0.6 +
      (0.387 * Ra ** (1 / 6)) /
        (1 + (0.559 / 0.707) ** (9 / 16)) ** (8 / 27)) **
    2;
  return (
    Nu * k * Math.PI * riseC +
    emissivity * 5.67e-8 * Math.PI * d * (Ts ** 4 - Ta ** 4)
  );
}
export function wireAtLoad({
  resistance,
  lengthM,
  alpha,
  ambientFactor,
  ambientC,
  diameterMm,
  emissivity,
  load,
  loadType,
}) {
  if (
    ![
      resistance,
      lengthM,
      alpha,
      ambientFactor,
      ambientC,
      diameterMm,
      emissivity,
      load,
    ].every(Number.isFinite) ||
    resistance <= 0 ||
    lengthM <= 0 ||
    ambientFactor <= 0 ||
    diameterMm <= 0 ||
    ambientC <= -273.15 ||
    emissivity < 0 ||
    emissivity > 1 ||
    load < 0 ||
    !["power", "current"].includes(loadType)
  )
    throw new RangeError("Enter a nonnegative load and valid wire properties.");
  // Power means I² × R at room temperature, then that current is held constant.
  const current = loadType === "current" ? load : Math.sqrt(load / resistance);
  const hotResistance = (rise) =>
    resistance * (1 + (alpha * rise) / ambientFactor);
  const balance = (rise) =>
    wireHeatLoss({ riseC: rise, diameterMm, ambientC, emissivity }) -
    (current ** 2 * hotResistance(rise)) / lengthM;
  // Do not extrapolate a near-room-temperature material/air model indefinitely.
  // A bracketed solve avoids returning a plausible but unconverged iteration.
  const maxRise = Math.min(200, 250 - ambientC);
  if (
    maxRise <= 0 ||
    !Number.isFinite(current) ||
    !Number.isFinite(balance(maxRise)) ||
    balance(maxRise) < 0
  )
    return { current, outOfRange: true };
  let low = 0,
    high = maxRise;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (balance(mid) < 0) low = mid;
    else high = mid;
  }
  const riseC = load === 0 ? 0 : (low + high) / 2,
    hotOhms = hotResistance(riseC),
    power = current ** 2 * hotOhms;
  return {
    current,
    riseC,
    hotC: ambientC + riseC,
    hotOhms,
    power,
    voltage: current * hotOhms,
    wattsPerM: power / lengthM,
    outOfRange: false,
  };
}
