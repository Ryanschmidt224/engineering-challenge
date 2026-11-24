import {isProjectRecipeFile} from "./recipe-files.js";

// Revision explanations and tree-archive notes share one bounded shape. The
// attachment namespace is checked before any historical or active writes.
export function historyEntryDetails(value,project){
 if(value===undefined)return {whatChanged:"",whyChanged:"",notes:"",photos:[],photoNames:{}};
 if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Invalid history details");
 const result={};
 for(const key of ["whatChanged","whyChanged","notes"]){
  const text=value[key]??"";if(typeof text!=="string"||text.length>5000)throw Error("History fields must be 5,000 characters or fewer");result[key]=text.trim();
 }
 const photos=value.photos??[];
 if(!Array.isArray(photos)||photos.length>12||new Set(photos).size!==photos.length||photos.some(id=>!isProjectRecipeFile(id,project)||!/^.+\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(id)))throw Error("Choose up to 12 photos belonging to this project");
 result.photos=[...photos];result.photoNames={};
 const names=value.photoNames??{};
 if(!names||typeof names!=="object"||Array.isArray(names)||Object.keys(names).length>12)throw Error("Invalid photo names");
 for(const id of Object.keys(names).sort()){
  if(!photos.includes(id)||typeof names[id]!=="string"||names[id].length>120)throw Error("Invalid photo name");
  if(names[id].trim())result.photoNames[id]=names[id].trim();
 }
 return result;
}
