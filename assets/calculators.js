import {initSiteHeader} from "./site-header.js?v=offsite-backup-20261128";
import {initCalculatorDirectory} from "./calculator-directory.js";
import {calculators} from "./calculator-catalog.js";

// Explicit page entrypoint: no legacy project controller or catalogue bootstrap.
export function initCalculators(){
 initSiteHeader();
 initCalculatorDirectory({root:document.getElementById("resource-calculators"),calculators});
}

// Embedded independently of tile loading, so a tile-service error does not hide the tools.
export function initInformationCalculators(root){
 if(!root||root.childElementCount)return;
 const section=window.BSUI.section({title:"Calculators",count:calculators.length,countLabel:["calculator","calculators"],open:location.hash==="#calculators",tooltip:"Small engineering calculations. Open a calculator without changing your saved information tiles."});
 const directory=document.createElement("div");directory.id="resource-calculators";section.body.append(directory);root.append(section.root);
 initCalculatorDirectory({root:directory,calculators});
 window.addEventListener("hashchange",()=>{if(location.hash==="#calculators")section.root.open=true;});
}
