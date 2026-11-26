import {
  wireMaterials,
  wireGauges,
  awgDiameterMm,
  wireAreaM2,
  wireProperties,
  wireAtLoad,
} from "./wire-resistance.js";
const fmt = (x, d = 3) =>
  Number.isFinite(x)
    ? Number(x.toPrecision(d)).toLocaleString("en-US", {
        maximumSignificantDigits: d,
      })
    : "—";
const lengthText = (m) => (m >= 1 ? fmt(m) + " m" : fmt(m * 100) + " cm");
const gaugeText = (g) =>
  (g === "0000" ? "4/0" : g === "000" ? "3/0" : g === "00" ? "2/0" : g) +
  " AWG";
const fields = [
  "target",
  "load",
  "loadType",
  "surface",
  "limit",
  "length",
  "lengthUnit",
  "material",
  "temp",
  "rho",
  "sizeType",
  "awg",
  "mm",
];
export function renderWireCalculator(root) {
  root.className = "wire-calculator";
  root.innerHTML = `<p>Find the length for a target resistance, or the resistance of a known length. Solid round wire, DC.</p><div class="wire-layout"><form class="wire-form" id="wire-form" autocomplete="off">
   <fieldset><legend>I want to find</legend>
    <div class="wire-modes" role="group" aria-label="Calculation">
     <button type="button" data-mode="length" aria-pressed="true">Length for a resistance</button>
     <button type="button" data-mode="resistance" aria-pressed="false">Resistance of a length</button>
    </div>
   </fieldset>
   <div class="wire-row" id="wire-targetRow">
    <label><span>Target resistance (Ω)</span><input id="wire-target" type="number" inputmode="decimal" min="0" step="any" value="0.1"></label>
   </div>
   <div class="wire-row">
    <label><span>Load given as</span><select id="wire-loadType"><option value="power">Power at room temperature (W)</option><option value="current">Current (A)</option></select></label>
    <label><span id="wire-loadLabel">Power at room temperature (W)</span><input id="wire-load" type="number" inputmode="decimal" min="0" step="any" value="2.4"></label>
   </div>
   <div class="wire-row" id="wire-lengthRow" hidden>
    <label><span>Wire length</span><input id="wire-length" type="number" inputmode="decimal" min="0" step="any" value="1"></label>
    <label><span>Unit</span><select id="wire-lengthUnit"><option value="1">m</option><option value="0.01">cm</option><option value="0.3048">ft</option><option value="0.0254">in</option></select></label>
   </div>
   <div class="wire-row">
    <label><span>Material</span><select id="wire-material"></select></label>
    <label><span>Room temperature (°C)</span><input id="wire-temp" type="number" inputmode="decimal" step="any" value="20"></label>
   </div>
   <label id="wire-rhoBox" hidden><span>Resistivity at 20 °C (Ω·m)</span><input id="wire-rho" type="number" inputmode="decimal" step="any" value="1.724e-8"></label>
   <div class="wire-row">
    <label><span>Wire size</span><select id="wire-sizeType"><option value="awg">AWG gauge</option><option value="mm">Diameter (mm)</option></select></label>
    <label id="wire-awgBox"><span>Gauge</span><select id="wire-awg"></select></label>
    <label id="wire-mmBox" hidden><span>Diameter (mm)</span><input id="wire-mm" type="number" inputmode="decimal" min="0" step="any" value="0.5"></label>
   </div>
   <p class="calculator-note" id="wire-sizeHint"></p>
   <div class="wire-row">
    <label><span>Wire surface</span><select id="wire-surface"><option value="0.9">Enamelled or insulated</option><option value="0.6">Bare, dull or oxidised</option><option value="0.05">Bare, shiny</option></select></label>
    <label><span>Insulation limit (°C)</span><select id="wire-limit"><option value="155">155 °C (magnet wire class F)</option><option value="130">130 °C (magnet wire class B)</option><option value="105">105 °C (PVC hook-up wire)</option><option value="80">80 °C (basic PVC)</option><option value="200">200 °C (PTFE or bare)</option></select></label>
   </div>
  <p class="calculator-note">Power specifies the cold I²R value. The heating estimate holds that current constant as resistance changes.</p>
</form>
 <section class="wire-result" aria-label="Wire calculation results" aria-live="polite" aria-atomic="true">
 <h3 data-wire="title">Result</h3><p class="wire-big" data-wire="big"></p><p data-wire="sub"></p>
 <meter data-wire="ruler" min="0" max="1" aria-label="Wire length compared with ruler"></meter><p class="calculator-note" data-wire="scale"></p>
 <dl class="wire-facts" data-wire="facts"></dl>
 <div data-wire="heat"><h3>Heat at full load (estimate)</h3><p data-wire="temperature"></p><p data-wire="thermal-note"></p></div>
 <p class="calculator-note">Cut a little long, measure with a 4-wire (Kelvin) connection, then trim. Lead and contact resistance matter at this scale. Copper changes resistance as it warms; low-drift alloys are better for accurate shunts.</p>
 </section></div>
 <h3 data-wire="table-title">Compare gauges</h3><p class="calculator-note">Same material and room temperature. Select a gauge to use it.</p>
 <div class="wire-table-scroll" role="region" aria-label="Wire gauge comparison" tabindex="0"><table class="wire-table"><thead><tr><th scope="col">AWG</th><th scope="col">Diameter</th><th scope="col">mΩ/m</th><th scope="col">mΩ/ft</th><th scope="col" data-wire="table-result">Length</th><th scope="col">Length (ft)</th><th scope="col">Estimated temperature</th></tr></thead><tbody data-wire="rows"></tbody></table></div>
 <p class="calculator-note">Temperature is an estimate for one straight horizontal wire in still air, with thin insulation. Coils, bundles, enclosures and thick insulation need a different model. This is not an insulation or ampacity rating. Material properties vary: check your supplier's datasheet and measure the wire. The heat model stops above a 200 °C rise or 250 °C wire temperature.</p>
 <details><summary>Calculation details and sources</summary><p>R = ρ₂₀ × [1 + α × (T − 20)] × L / A; A = π × (diameter / 2)². Heating balances I²R against natural convection and radiation. Alloy temperature coefficients are approximate near room temperature; custom resistivity assumes no temperature drift.</p><p><a href="https://claude.ai/artifact/8cETEvdbEQEXQhgH3ZDYrq" target="_blank" rel="noopener noreferrer">Original calculator</a> · <a href="https://www.isabellenhuette.com/de/loesungen/legierungen/widerstandslegierungen" target="_blank" rel="noopener noreferrer">Resistance alloy data</a> · <a href="https://www.kanthal.com/en/products/datasheets/material-datasheets/wire/resistance-heating-wire-and-resistance-wire/kanthal-a-1/" target="_blank" rel="noopener noreferrer">Kanthal A-1 data</a></p></details>`;
  const $ = (id) => root.querySelector("#wire-" + id),
    out = (name) => root.querySelector('[data-wire="' + name + '"]');
  for (const [id, options] of [
    ["material", wireMaterials.map((m) => [m.id, m.name])],
    ["awg", wireGauges.map((g) => [g, gaugeText(g)])],
  ])
    for (const [value, text] of options) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      $(id).append(option);
    }
  $("awg").value = "22";
  for (const input of root.querySelectorAll("input,select")) {
    input.classList.add("ui-control");
    const caption = input.closest("label").querySelector("span");
    caption.id ||= input.id + "-label";
    input.setAttribute("aria-labelledby", caption.id);
  }
  for (const button of root.querySelectorAll("button"))
    button.classList.add("ui-button");
  let mode = "length";
  try {
    const saved = JSON.parse(
      localStorage.getItem("bs-wire-resistance") || "null",
    );
    if (saved) {
      for (const f of fields)
        if (typeof saved[f] === "string") $(f).value = saved[f];
      if (saved.mode === "resistance") mode = saved.mode;
    }
  } catch {}
  const num = (id) => ($(id).value.trim() === "" ? NaN : Number($(id).value));
  function fact(label, value) {
    const box = document.createElement("div"),
      dt = document.createElement("dt"),
      dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    box.append(dt, dd);
    out("facts").append(box);
  }
  function render() {
    $("targetRow").hidden = mode !== "length";
    $("lengthRow").hidden = mode !== "resistance";
    $("rhoBox").hidden = $("material").value !== "custom";
    $("awgBox").hidden = $("sizeType").value !== "awg";
    $("mmBox").hidden = $("sizeType").value === "awg";
    $("loadLabel").textContent =
      $("loadType").value === "power"
        ? "Power at room temperature (W)"
        : "Current (A)";
    for (const button of root.querySelectorAll("[data-mode]"))
      button.setAttribute("aria-pressed", String(button.dataset.mode === mode));
    // Always clear the whole prior result, including the heat estimate and table.
    out("title").textContent = "Result";
    out("big").textContent = "—";
    out("sub").textContent = "";
    out("facts").replaceChildren();
    out("rows").replaceChildren();
    out("heat").hidden = true;
    out("ruler").hidden = true;
    out("scale").textContent = "";
    $("sizeHint").textContent = "";
    out("table-title").textContent = "Compare gauges";
    try {
      const material = wireMaterials.find((m) => m.id === $("material").value);
      if (!material) throw Error("Choose a material.");
      const alpha = material.alpha,
        tempC = num("temp"),
        diameterMm =
          $("sizeType").value === "awg"
            ? awgDiameterMm($("awg").value)
            : num("mm"),
        rho20 = material.id === "custom" ? num("rho") : material.rho;
      const props = wireProperties({ rho20, alpha, tempC, diameterMm });
      const R =
          mode === "length"
            ? num("target")
            : props.ohmPerM * num("length") * num("lengthUnit"),
        L = R / props.ohmPerM;
      if (!Number.isFinite(R) || !Number.isFinite(L) || R <= 0 || L <= 0)
        throw Error(
          mode === "length"
            ? "Enter a target resistance greater than zero."
            : "Enter a wire length greater than zero.",
        );
      const load = num("load"),
        loadType = $("loadType").value,
        emissivity = num("surface"),
        limitC = num("limit");
      if (!Number.isFinite(load) || load < 0)
        throw Error("Enter a load of zero or greater.");
      const operating = (p, d, len) =>
        wireAtLoad({
          resistance: p.ohmPerM * len,
          lengthM: len,
          alpha,
          ambientFactor: p.ambientFactor,
          ambientC: tempC,
          diameterMm: d,
          emissivity,
          load,
          loadType,
        });
      const op = operating(props, diameterMm, L),
        gauge =
          $("sizeType").value === "awg"
            ? gaugeText($("awg").value)
            : fmt(diameterMm) + " mm diameter";
      $("sizeHint").textContent =
        gauge +
        ", " +
        fmt(diameterMm) +
        " mm diameter, " +
        fmt(wireAreaM2(diameterMm) * 1e6) +
        " mm² cross-section.";
      out("title").textContent =
        mode === "length"
          ? "Cut length for " + fmt(R) + " Ω"
          : "Resistance of " + lengthText(L);
      out("big").textContent =
        mode === "length"
          ? lengthText(L)
          : R < 1
            ? fmt(R * 1000) + " mΩ"
            : fmt(R) + " Ω";
      out("sub").textContent =
        fmt(L / 0.3048) +
        " ft · " +
        fmt(L / 0.0254) +
        " in · " +
        material.name +
        " · " +
        gauge +
        " · " +
        fmt(tempC) +
        " °C";
      const step = L < 1 ? 0.1 : L < 10 ? 1 : 10,
        full = Math.ceil(L / step) * step;
      out("ruler").hidden = false;
      out("ruler").value = L / full;
      out("scale").textContent = "Ruler: 0 to " + lengthText(full);
      fact("Resistance per meter", fmt(props.ohmPerM * 1000) + " mΩ/m");
      fact("Resistance per foot", fmt(props.ohmPerM * 304.8) + " mΩ/ft");
      fact("Current at load", fmt(op.current) + " A");
      out("heat").hidden = false;
      if (op.outOfRange) {
        out("temperature").textContent = "Outside the heat model's range";
        out("thermal-note").textContent =
          "No reliable warm resistance or temperature can be reported for these inputs.";
      } else {
        fact("Voltage across wire (warm)", fmt(op.voltage * 1000) + " mV");
        fact("Power in wire (warm)", fmt(op.power) + " W");
        fact("Heat per meter", fmt(op.wattsPerM) + " W/m");
        out("temperature").textContent =
          fmt(op.hotC) + " °C (+" + fmt(op.riseC) + " °C)";
        const drift = (op.hotOhms / R - 1) * 100;
        out("thermal-note").textContent =
          (op.hotC > limitC
            ? "Estimate exceeds the selected " +
              limitC +
              " °C insulation limit. "
            : "Estimate is below the selected " +
              limitC +
              " °C insulation limit; verify actual temperature. ") +
          "Warm resistance ≈ " +
          fmt(op.hotOhms * 1000) +
          " mΩ (" +
          (drift >= 0 ? "+" : "") +
          fmt(drift) +
          "%).";
      }
      out("table-title").textContent =
        mode === "length"
          ? "Length for " + fmt(R) + " Ω by gauge"
          : "Resistance of " + lengthText(L) + " by gauge";
      out("table-result").textContent =
        mode === "length" ? "Length" : "Resistance";
      for (const g of wireGauges.filter(
        (g) => Number(g) >= 8 && Number(g) <= 36,
      )) {
        const d = awgDiameterMm(g),
          p = wireProperties({ rho20, alpha, tempC, diameterMm: d }),
          len = mode === "length" ? R / p.ohmPerM : L,
          t = operating(p, d, len),
          row = document.createElement("tr"),
          cell = document.createElement("th"),
          button = document.createElement("button");
        cell.scope = "row";
        button.type = "button";
        button.className = "wire-gauge-button";
        button.textContent = g;
        button.setAttribute("aria-label", "Use " + g + " AWG");
        button.setAttribute(
          "aria-pressed",
          String($("sizeType").value === "awg" && $("awg").value === g),
        );
        button.addEventListener("click", () => {
          $("sizeType").value = "awg";
          $("awg").value = g;
          render();
          $("awg").focus();
        });
        cell.append(button);
        row.append(cell);
        for (const text of [
          fmt(d) + " mm",
          fmt(p.ohmPerM * 1000),
          fmt(p.ohmPerM * 304.8),
          mode === "length" ? lengthText(len) : fmt(p.ohmPerM * L) + " Ω",
          fmt(len / 0.3048),
          t.outOfRange
            ? "Outside model"
            : fmt(t.hotC) + " °C" + (t.hotC > limitC ? " (over limit)" : ""),
        ]) {
          const td = document.createElement("td");
          td.textContent = text;
          row.append(td);
        }
        out("rows").append(row);
      }
      try {
        localStorage.setItem(
          "bs-wire-resistance",
          JSON.stringify({
            mode,
            ...Object.fromEntries(fields.map((f) => [f, $(f).value])),
          }),
        );
      } catch {}
    } catch (error) {
      out("sub").textContent = error.message;
    }
  }
  $("form").addEventListener("input", render);
  $("form").addEventListener("submit", (e) => e.preventDefault());
  for (const button of root.querySelectorAll("[data-mode]"))
    button.addEventListener("click", () => {
      mode = button.dataset.mode;
      render();
    });
  render();
}
