import {initSiteHeader} from "./site-header.js";
import {initCalculatorDirectory} from "./calculator-directory.js";
import {calculators} from "./calculator-catalog.js";

// Explicit page entrypoint: no legacy project controller or catalogue bootstrap.
export function initCalculators(){
 initSiteHeader();
 initCalculatorDirectory({root:document.getElementById("resource-calculators"),calculators});
}
