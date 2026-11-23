// One transient menu surface, with the same shared controls as the page.
let active=null;
export function contextMenu(trigger,event,items){
 active?.();const menu=document.createElement("div");menu.className="context-menu";menu.setAttribute("role","menu");
 const box=trigger.getBoundingClientRect(),x=event?.clientX??box.left,y=event?.clientY??box.bottom;
 const close=()=>{menu.remove();document.removeEventListener("pointerdown",outside,true);document.removeEventListener("keydown",keys,true);window.removeEventListener("scroll",close,true);if(active===close)active=null;};
 const outside=e=>{if(!menu.contains(e.target))close();};
 const keys=e=>{const buttons=[...menu.querySelectorAll("button")],index=buttons.indexOf(document.activeElement);if(e.key==="Escape"||e.key==="Tab"){close();trigger.focus();if(e.key==="Escape")e.preventDefault();}else if(["ArrowDown","ArrowUp","Home","End"].includes(e.key)){e.preventDefault();buttons[e.key==="Home"?0:e.key==="End"?buttons.length-1:(index+(e.key==="ArrowDown"?1:-1)+buttons.length)%buttons.length]?.focus();}};
 for(const item of items){const button=window.BSUI.button(item.label,()=>{close();void item.run();},{variant:"quiet"});button.setAttribute("role","menuitem");menu.append(button);}
 document.body.append(menu);menu.style.left=Math.max(0,Math.min(x,innerWidth-menu.offsetWidth))+"px";menu.style.top=Math.max(0,Math.min(y,innerHeight-menu.offsetHeight))+"px";active=close;document.addEventListener("pointerdown",outside,true);document.addEventListener("keydown",keys,true);window.addEventListener("scroll",close,true);menu.querySelector("button")?.focus();return close;
}
