import {node} from "./workshop-ui.js";
import {initDirectory} from "./project-directory.js";

export function projectCatalog(ctx,projects){
 const root=node("div","","project-stack"),toolbar=node("div","","ui-directory-toolbar"),searchLabel=node("label","","ui-toolbar-search"),search=node("input","","ui-control"),sortLabel=node("label","Sort by","ui-toolbar-field"),sort=node("select","","ui-control"),status=node("span","","muted ui-toolbar-count"),grid=node("div"),empty=node("p","","muted");
 root.dataset.projectCatalog="";search.type="search";search.placeholder="Search projects…";search.setAttribute("aria-label","Search projects");searchLabel.append(search);sort.setAttribute("aria-label","Project sort order");
 for(const [value,label]of [["name_asc","Name A–Z"],["name_desc","Name Z–A"],["newest","Newest"],["oldest","Oldest"]]){const option=node("option",label);option.value=value;sort.append(option);}sortLabel.append(sort);status.setAttribute("aria-live","polite");toolbar.append(searchLabel,sortLabel,status);root.append(toolbar,grid,empty);
 const items=projects.map(project=>({...project,createdAt:project.created_at})),directory=initDirectory({grid,toolbar,projects:()=>items,tags:()=>[],search,sort,status,empty,viewLabel:"Project view",storageKey:"bs-engine-project-view",onOpen:project=>ctx.navigate(project.id)});directory.render();return root;
}
