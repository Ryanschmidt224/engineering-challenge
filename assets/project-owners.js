export const projectOwners=Object.freeze(["Ryan","Wes","Wyatt"]);
export function projectOwner(value="Ryan"){
 if(!projectOwners.includes(value))throw Error("Choose Ryan, Wes or Wyatt as the project owner.");
 return value;
}
