/* Shared browsing layout for Projects, Knowledge Base, and Workshop.
 * Presentation and filter state only: no changes to project or part records.
 */
(function(){
 "use strict";
 const el=(tag,cls,text)=>{
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(text!==undefined)node.textContent=text;
  return node;
 };
 function build(root,sidebarContent,items){
  if(!root||!sidebarContent||!items?.length)return null;
  if(root.querySelector(":scope > .bs-catalog-layout"))return root.querySelector(":scope > .bs-catalog-layout");
  const layout=el("div","bs-catalog-layout");
  const aside=el("aside","bs-catalog-sidebar");aside.setAttribute("aria-label","Browse categories");
  const main=el("div","bs-catalog-main");
  aside.append(sidebarContent);
  for(const item of items)main.append(item);
  root.append(layout);layout.append(aside,main);
  return layout;
 }
 function categories(mount,options={}){
  if(!mount)return null;
  let selected=options.selected||"all",values=[];
  const render=()=>{
   mount.replaceChildren();
   const title=el("h2","bs-catalog-sidebar-heading",options.heading||"Browse by category");
   mount.append(title);
   const nav=el("nav","bs-catalog-category-list");nav.setAttribute("aria-label",options.heading||"Categories");
   for(const entry of values){
    const button=el("button","bs-catalog-category"+(selected===entry.value?" is-active":""),entry.label);
    button.type="button";button.dataset.catalogCategory=entry.value;
    button.setAttribute("aria-pressed",String(selected===entry.value));
    if(entry.count!==undefined)button.append(el("span","bs-catalog-category-count",String(entry.count)));
    button.onclick=()=>{
     selected=entry.value;
     render();
     options.onChange?.(selected);
    };
    nav.append(button);
   }
   mount.append(nav);
  };
  return {
   setItems(items){
    values=items.map(x=>typeof x==="string"?{value:x,label:x}:x);
    if(!values.some(x=>x.value===selected))selected="all";
    render();
   },
   get value(){return selected},
   select(value){if(values.some(x=>x.value===value)){selected=value;render();options.onChange?.(selected)}}
  };
 }
 window.BSCatalogUI=Object.freeze({build,categories});
})();