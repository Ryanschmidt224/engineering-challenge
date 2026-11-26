import { test } from "node:test";
import assert from "node:assert/strict";
import {
  awgDiameterMm,
  wireAreaM2,
  wireProperties,
  wireAtLoad,
  wireHeatLoss,
} from "../assets/wire-resistance.js";
const near = (actual, expected, tolerance = 1e-8) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} != ${expected}`,
  );
const copper = {
  rho20: 1.724e-8,
  alpha: 0.00393,
  tempC: 20,
  diameterMm: awgDiameterMm("22"),
};
test("AWG endpoints and 22 AWG match nominal wire dimensions", () => {
  near(awgDiameterMm("0000"), 11.684, 0.001);
  near(awgDiameterMm("36"), 0.127);
  near(awgDiameterMm("22"), 0.6438, 0.0001);
  assert.throws(() => awgDiameterMm("41"), RangeError);
  assert.throws(() => awgDiameterMm("bad"), RangeError);
});
test("wire resistance and cut length agree with a 22 AWG copper reference", () => {
  const p = wireProperties(copper);
  near(wireAreaM2(copper.diameterMm) * 1e6, 0.3255, 0.0001);
  near(p.ohmPerM, 0.053, 0.0001);
  const length = 0.1 / p.ohmPerM;
  near(length, 1.888, 0.002);
  near(p.ohmPerM * length, 0.1);
  near(p.ohmPerM * 0.3048, 0.01614, 0.00002);
  const warm = wireProperties({ ...copper, tempC: 40 });
  near(warm.ohmPerM / p.ohmPerM, 1 + 0.00393 * 20);
});
test("thermal equilibrium conserves energy and corrects alpha relative to ambient resistivity", () => {
  const props = wireProperties({ ...copper, tempC: 40 }),
    lengthM = 0.1 / props.ohmPerM;
  const args = {
    resistance: 0.1,
    lengthM,
    alpha: copper.alpha,
    ambientFactor: props.ambientFactor,
    ambientC: 40,
    diameterMm: copper.diameterMm,
    emissivity: 0.9,
    load: 2,
    loadType: "current",
  };
  const op = wireAtLoad(args);
  assert.equal(op.outOfRange, false);
  near(op.current, 2);
  near(op.power, 4 * op.hotOhms);
  near(op.voltage, 2 * op.hotOhms);
  near(
    op.hotOhms / 0.1,
    (1 + copper.alpha * (op.hotC - 20)) / (1 + copper.alpha * 20),
  );
  near(wireHeatLoss({ ...args, riseC: op.riseC }), op.wattsPerM);
});
test("cold-power mode holds inferred current, zero load stays at ambient", () => {
  const p = wireProperties(copper),
    args = {
      resistance: 0.1,
      lengthM: 0.1 / p.ohmPerM,
      alpha: copper.alpha,
      ambientFactor: p.ambientFactor,
      ambientC: 20,
      diameterMm: copper.diameterMm,
      emissivity: 0.9,
      load: 2.4,
      loadType: "power",
    };
  const op = wireAtLoad(args);
  near(op.current, Math.sqrt(24));
  assert.ok(op.power > 2.4);
  near(op.hotC, 38, 0.2);
  const zero = wireAtLoad({ ...args, load: 0 });
  near(zero.riseC, 0);
  near(zero.power, 0);
  near(zero.hotOhms, 0.1);
  assert.equal(wireAtLoad({ ...args, load: 1e12 }).outOfRange, true);
});
test("invalid and out-of-range inputs never produce plausible results", () => {
  for (const bad of [
    { rho20: 0 },
    { diameterMm: 0 },
    { tempC: -273.15 },
    { tempC: NaN },
    { rho20: Infinity },
    { tempC: -250 },
  ])
    assert.throws(() => wireProperties({ ...copper, ...bad }), RangeError);
  const p = wireProperties(copper),
    args = {
      resistance: 0.1,
      lengthM: 1,
      alpha: copper.alpha,
      ambientFactor: p.ambientFactor,
      ambientC: 20,
      diameterMm: 1,
      emissivity: 0.9,
      load: 1,
      loadType: "current",
    };
  for (const bad of [
    { load: -1 },
    { load: NaN },
    { lengthM: 0 },
    { emissivity: 2 },
    { loadType: "voltage" },
  ])
    assert.throws(() => wireAtLoad({ ...args, ...bad }), RangeError);
});
