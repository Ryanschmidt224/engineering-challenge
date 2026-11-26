export const projectOwners=Object.freeze(["Ryan","Wes","Wyatt"]);
export function projectOwner(value="Ryan"){
 if(typeof value!=="string"||!value.trim()||value.length>80||/[\x00-\x1f\x7f]/.test(value))throw Error("Choose a valid project owner.");
 return value;
}
