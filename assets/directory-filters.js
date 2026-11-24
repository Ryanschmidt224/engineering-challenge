const element=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
export function createDirectoryFilters({items,onChange}) {
 const filterMenu=element("details","project-filter-menu ui-toolbar-menu");
 filterMenu.append(element("summary","ui-button","Filters"));
 const selectedTags=element("div","project-selected-descriptors");
 const tagFilter=element("div","bs-project-tag-filter ui-toolbar-menu__panel"),tagTitle=element("span","bs-project-tag-title","Descriptors");
 const tagSearchLabel=element("label","bs-project-descriptor-search-label","Find a descriptor"),tagSearch=element("input","field bs-project-descriptor-search");
 tagSearch.type="search";tagSearch.placeholder="e.g. Electronics or Machining";tagSearch.setAttribute("aria-label","Search descriptor tiles");tagSearchLabel.append(tagSearch);
 const tagChoices=element("div","bs-project-tag-options"),clearTags=element("button","bs-project-tag-clear","Clear selected");clearTags.type="button";
 const tagHeader=element("div","bs-project-tag-filter-heading");tagHeader.append(tagTitle,clearTags);tagFilter.append(tagHeader,tagSearchLabel,tagChoices);filterMenu.append(tagFilter);
  const activeTags=new Set();
  clearTags.onclick=()=>{activeTags.clear();renderTagFilters();onChange()};
  const renderTagFilters=()=>{
   tagChoices.replaceChildren();
   selectedTags.replaceChildren();
   const counts=new Map();
   for(const project of items())for(const tag of (project.tags||[])){
    const key=tag.toLowerCase();
    if(!counts.has(key))counts.set(key,{name:tag,count:0});
    counts.get(key).count++;
   }
   const filter=tagSearch.value.trim().toLowerCase();
   let visibleCount=0;
   for(const [key,{name,count}] of [...counts].sort((a,b)=>a[1].name.localeCompare(b[1].name))){
    if(filter&&!key.includes(filter)&&!activeTags.has(key))continue;
    visibleCount++;
    const chip=element("button","ui-chip",name);
    chip.type="button";chip.setAttribute("aria-pressed",String(activeTags.has(key)));
    chip.append(element("span","bs-project-tag-count",String(count)));
    chip.onclick=()=>{activeTags.has(key)?activeTags.delete(key):activeTags.add(key);renderTagFilters();onChange()};
    tagChoices.append(chip);
   }
   if(!visibleCount)tagChoices.append(element("p","muted bs-project-tag-empty","No matching descriptors"));
   filterMenu.hidden=!counts.size;
   for(const key of activeTags){
    const name=counts.get(key)?.name;
    if(!name){activeTags.delete(key);continue}
    const chip=element("button","ui-chip",name+" ×");
    chip.type="button";chip.setAttribute("aria-pressed","true");chip.setAttribute("aria-label","Remove "+name+" filter");
    chip.onclick=()=>{
     activeTags.delete(key);renderTagFilters();onChange();
     (selectedTags.querySelector("button")||filterMenu.querySelector("summary")).focus();
    };
    selectedTags.append(chip);
   }
   clearTags.hidden=!activeTags.size;
  };
  tagSearch.oninput=renderTagFilters;
 return {menu:filterMenu,selected:selectedTags,active:activeTags,render:renderTagFilters};
}
