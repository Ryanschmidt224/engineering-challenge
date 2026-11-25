import {initDirectory} from "./project-directory.js";
import {createDirectoryFilters} from "./directory-filters.js";
const element=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
export function initCalculatorDirectory({root,calculators}) {
 if(!root)return;
 root.className="";
 const items=calculators.map(item=>({...item,shortSummary:item.subtitle,description:item.detail}));
 const directory=element("div","calculator-directory"),toolbar=element("div","ui-directory-toolbar");
 const searchLabel=element("label","ui-toolbar-search"),search=element("input","ui-control");search.type="search";search.placeholder="Search calculators…";search.setAttribute("aria-label","Search calculators");searchLabel.append(search);
 const sortLabel=element("label","ui-toolbar-field","Sort by"),sort=element("select","ui-control");sort.setAttribute("aria-label","Calculator sort order");
 for(const [value,label]of [["name_asc","Name A–Z"],["name_desc","Name Z–A"]]){const option=element("option","",label);option.value=value;sort.append(option);}sortLabel.append(sort);
 const status=element("span","muted ui-toolbar-count");status.setAttribute("role","status");
 let render=()=>{};
 const filters=createDirectoryFilters({items:()=>items,onChange:()=>render()});
 toolbar.append(searchLabel,filters.menu,sortLabel,status);
 const grid=element("div","ui-project-list"),empty=element("p","muted");empty.hidden=true;
 directory.append(toolbar,filters.selected,grid,empty);
 const detail=element("div","calculator-detail");detail.hidden=true;
 const forms=new Map();
 const open=(item,button)=>{
  let panel=forms.get(item.id);
  if(!panel){panel=window.BSUI.section({title:item.name,role:"calculator-"+item.id,open:true});const host=element("div","");renderCalculator(host,item);panel.body.append(host);forms.set(item.id,panel);}
  const back=window.BSUI.button("Back to calculators",()=>{detail.hidden=true;directory.hidden=false;button.focus();});
  detail.replaceChildren(back,panel.root);detail.hidden=false;directory.hidden=true;panel.root.open=true;panel.header.focus();
 };
 ({render}=initDirectory({grid,toolbar,projects:()=>items,tags:()=>filters.active,search,sort,status,empty,noun:"calculators",viewLabel:"Calculator view",storageKey:"bs-calculator-view",onOpen:open}));
 root.replaceChildren(directory,detail);filters.render();render();
}
 function renderCalculator(mount,item){
  mount.replaceChildren();
  const card=element("div","");
  card.append(element("p","",item.detail));
  const controls=element("div","calculator-fields");
  if(item.id==="ohms-law"){
   const volts=makeNum("Voltage (V)",12,0.01),ohms=makeNum("Resistance (Ω)",6,0.01);
   const result=element("output","calculator-output");
   const calculate=()=>{
    const v=Number(volts.input.value),r=Number(ohms.input.value);
    result.textContent=Number.isFinite(v)&&Number.isFinite(r)&&r>0?"Current "+format(v/r)+" A · Power "+format(v*v/r)+" W":"Enter a resistance greater than 0 Ω.";
   };
   controls.append(volts.label,ohms.label,result);
   [volts.input,ohms.input].forEach(input=>input.addEventListener("input",calculate));
   calculate();
  }else if(item.id==="wheel-speed"){
   const rpm=makeNum("RPM",10000,1),diameter=makeNum("Wheel diameter (mm)",50,0.1);
   const result=element("output","calculator-output");
   const calculate=()=>{
    const r=Number(rpm.input.value),d=Number(diameter.input.value);
    result.textContent=r>=0&&d>0?"Surface speed "+format(Math.PI*d/1000*r/60)+" m/s":"Enter a positive diameter and nonnegative RPM.";
   };
   controls.append(rpm.label,diameter.label,result);
   [rpm.input,diameter.input].forEach(input=>input.addEventListener("input",calculate));
   calculate();
   card.append(element("p","calculator-note","Speed = π × diameter × RPM ÷ 60. The dart usually leaves slower because of slip and deformation."));
  }else{
   const diameter=makeNum("Diameter (in)",0.5,0.001),rpm=makeNum("RPM",4000,1),sfm=makeNum("SFM",523.599,0.01);
   const result=element("output","calculator-output");
   const computeSpeed=()=>{
    const d=Number(diameter.input.value),r=Number(rpm.input.value);
    sfm.input.value=d>0&&r>=0?String(Number((Math.PI*d*r/12).toFixed(3))):"";
    result.textContent=d>0&&r>=0?"Surface speed: "+format(Math.PI*d*r/12)+" ft/min":"Enter a positive diameter and nonnegative RPM.";
   };
   const computeRpm=()=>{
    const d=Number(diameter.input.value),speed=Number(sfm.input.value);
    if(d>0&&speed>=0){const value=12*speed/(Math.PI*d);rpm.input.value=String(Number(value.toFixed(1)));result.textContent="Required spindle speed: "+format(value)+" RPM";}
    else result.textContent="Enter a positive diameter and nonnegative SFM.";
   };
   controls.append(diameter.label,rpm.label,sfm.label,result);
   diameter.input.addEventListener("input",computeSpeed);rpm.input.addEventListener("input",computeSpeed);sfm.input.addEventListener("input",computeRpm);
   computeSpeed();
   card.append(element("p","calculator-note","SFM = π × diameter (in) × RPM ÷ 12. Calculator is for cutting surface speed, not feed rate."));
  }
  card.append(controls);
  mount.append(card);
 }
 function makeNum(name,value,step){const label=element("label","calculator-label",name),input=element("input","field");input.type="number";input.step=String(step);input.value=String(value);label.append(input);return {label,input}}
 const format=value=>Number.isFinite(value)?Number(value.toFixed(4)).toLocaleString("en-US",{maximumFractionDigits:4}):"—";
