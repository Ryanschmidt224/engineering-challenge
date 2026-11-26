// Align shared pencil controls with the displayed photo, not unused panel width.
const layouts=new Map(),resize=new ResizeObserver(entries=>{for(const entry of entries)layouts.get(entry.target)?.();});
new MutationObserver(()=>{for(const [target]of layouts)if(!target.isConnected){resize.unobserve(target);layouts.delete(target);}}).observe(document.documentElement,{childList:true,subtree:true});
export function alignPhotoControl({cover,shell,bar,edit}){
 if(!shell.isConnected)return;
 const align=()=>{const images=[...cover.querySelectorAll('img')];if(cover.matches('img'))images.push(cover);const visible=images.filter(image=>image.getBoundingClientRect().width>0);const bounds=(visible.length?visible:[cover]).map(image=>image.getBoundingClientRect());const right=Math.max(...bounds.map(box=>box.right)),outer=bar.getBoundingClientRect();if(outer.width)edit.style.transform='translateX(-'+Math.max(0,outer.right-right)+'px)';};
 layouts.set(cover,align);layouts.set(shell,align);resize.observe(cover);resize.observe(shell);cover.addEventListener('load',align,true);requestAnimationFrame(align);
}
