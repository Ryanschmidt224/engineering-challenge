import {initSiteHeader} from "/assets/site-header.js";
export function initProjectCommandProof(root=document){
 initSiteHeader();
 const button=root.querySelector("[data-run-proof]"),status=root.querySelector("[data-proof-status]"),output=root.querySelector("[data-proof-result]");
 let operationId=null;
 button.addEventListener("click",async()=>{
  operationId||=crypto.randomUUID();button.disabled=true;output.textContent="";status.textContent="Running against this deployment's D1 binding…";
  try{
   const response=await fetch("/__test__/command-proof",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({expectedRevision:null,operationId})});
   const result=await response.json();if(!response.ok)throw Error(result.error||"The proof did not pass.");
   output.textContent=JSON.stringify(result,null,2);status.textContent="Transaction proof passed. Save this report with the preview deployment version before starting dependent workflows.";
   button.textContent="Recheck the same proof";
  }catch(error){status.textContent=error.message;}
  finally{button.disabled=false;}
 });
}
