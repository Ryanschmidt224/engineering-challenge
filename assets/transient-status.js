(()=> {
 const active=new WeakMap();
 function show(element,message,ms=3500){
  if(!element)return;
  active.get(element)?.();
  element.textContent=message;
  let timer;
  function clear(){
   clearTimeout(timer);
   document.removeEventListener("click",clear,true);
   if(element.textContent===message)element.textContent="";
   active.delete(element);
  }
  active.set(element,clear);
  document.addEventListener("click",clear,true);
  timer=setTimeout(clear,ms);
 }
 window.BSTransient={show};
})();
