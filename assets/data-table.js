// Shared semantic table; columns and cells contain ordinary text or DOM nodes.
export function dataTable(label,columns){
 const root=document.createElement("div");root.className="ui-table-scroll";
 const table=document.createElement("table");table.className="data-table";table.setAttribute("aria-label",label);
 const head=table.createTHead(),row=head.insertRow(),body=table.createTBody();
 for(const title of columns){const cell=document.createElement("th");cell.scope="col";cell.textContent=title;row.append(cell);}
 root.append(table);
 return {root,body,append(values){const row=body.insertRow();for(const value of values){const cell=row.insertCell();if(value instanceof Node)cell.append(value);else cell.textContent=String(value??"");}return row;}};
}
