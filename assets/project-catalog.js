import {node} from "./workshop-ui.js";
import {initDirectory} from "./project-directory.js";

export function projectCatalog(ctx,projects,create=null){
 const root=node("div","","project-stack"),toolbar=node("div","","ui-directory-toolbar"),searchLabel=node("label","","ui-toolbar-search"),search=node("input","","ui-control"),sortLabel=node("label","Sort by","ui-toolbar-field"),sort=node("select","","ui-control"),status=node("span","","muted ui-toolbar-count"),grid=node("div"),empty=node("p","","muted");
 root.dataset.projectCatalog="";search.type="search";search.placeholder="Search projects…";search.setAttribute("aria-label","Search projects");searchLabel.append(search);sort.setAttribute("aria-label","Project sort order");
 for(const [value,label]of [["name_asc","Name A–Z"],["name_desc","Name Z–A"],["newest","Newest"],["oldest","Oldest"]]){const option=node("option",label);option.value=value;sort.append(option);}sortLabel.append(sort);status.setAttribute("aria-live","polite");toolbar.append(...(create?[create]:[]),searchLabel,sortLabel,status);root.append(toolbar,grid,empty);
 try{const saved=JSON.parse(localStorage.getItem("bs-engine-project-search")||"{}");if(typeof saved?.q==="string")search.value=saved.q;if([...sort.options].some(option=>option.value===saved?.sort))sort.value=saved.sort;}catch{}
 const items=projects.map(project=>({...project,createdAt:project.created_at})),directory=initDirectory({grid,toolbar,projects:()=>items,tags:()=>[],search,sort,status,empty,viewLabel:"Project view",storageKey:"bs-engine-project-view",onOpen:project=>ctx.navigate(project.id)}),remember=()=>{try{localStorage.setItem("bs-engine-project-search",JSON.stringify({q:search.value,sort:sort.value}));}catch{}};search.addEventListener("input",remember);sort.addEventListener("change",remember);directory.render();return root;
}
