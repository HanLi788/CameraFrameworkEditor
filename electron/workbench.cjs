// File tabs and rig context have independent lifetimes.
function openTab(meta,request){
  meta.tabs??=[];meta.processors??={};
  if(request.rig){meta.rig=request.path;meta.processor=meta.processors[request.path]??'Input';}
  if(request.processor!==undefined){meta.processor=request.processor;meta.processors[meta.rig]=request.processor;}
  if(!meta.tabs.some(t=>t.path===request.path))meta.tabs.push({path:request.path});
  meta.file=request.path;
}
function removeTab(meta,relative){
  const index=meta.tabs.findIndex(t=>t.path===relative);
  meta.tabs=meta.tabs.filter(t=>t.path!==relative);
  if(meta.file===relative)meta.file=meta.tabs[Math.min(index,meta.tabs.length-1)]?.path||'';
}
function moveTabs(meta,moves){
  const remap=p=>Object.hasOwn(moves,p)?moves[p]||'':p;
  meta.tabs=meta.tabs.map(t=>({...t,path:remap(t.path)})).filter(t=>t.path);
  meta.file=remap(meta.file)||meta.tabs.at(-1)?.path||'';
  meta.rig=remap(meta.rig);
  meta.processors=Object.fromEntries(Object.entries(meta.processors||{}).map(([p,s])=>[remap(p),s]).filter(([p])=>p));
  if(!meta.rig)meta.processor='';
}
module.exports={openTab,removeTab,moveTabs};
