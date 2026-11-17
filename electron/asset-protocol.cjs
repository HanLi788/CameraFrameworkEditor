// Files are addressed relative to CameraFramework; JSON references are relative to Assets.
const extensions={Rig:'.rig',Pipeline:'.pipeline',Input:'.userInput',TransitionInput:'.transitionInput',Value:'.transitionValue',Effect:'.effect',PostProcessing:'.postProcessing',Camera:'.camera',Share:'.share',VirtualInput:'.virtualInput',NumEffect:'.numEffect',BoolEffect:'.boolEffect',Filter:'.filter',Range:'.range',Sensitivity:'.sensitivity',Occlusion:'.occlusion',Smooth:'.smooth',Curve:'.curve'};
const typeOf=p=>Object.keys(extensions).find(k=>p.endsWith(extensions[k]));
const indexPath='Assets/Documents.index.json';
const assetKey=p=>typeof p==='string'&&p.startsWith('Assets/')?p.slice(7):p;
const documentId=value=>value&&typeof value==='object'&&!Array.isArray(value)?value.$ref?.DocumentId:undefined;
const documentReference=id=>({$ref:{DocumentId:id,Pointer:''}});
const assetFile=(value,documents=[])=>{
 const id=documentId(value);
 if(id!==undefined){const target=documents.find(d=>d.DocumentId===id||d.documentId===id);return target?.path||(target?.Path?'Assets/'+target.Path:typeof id==='string'?'Assets/'+id:'');}
 return typeof value==='string'?(/^(Shared|GameplayCameraSystem|PostProcessingSystem)\//.test(value)?'Assets/'+value:value):'';
};
const literalKey=key=>['Name','Description','Params','PerformanceType'].includes(key);
function references(value,parts=[],found=[],documents=[]){
 if(!value||typeof value!=='object')return found;
 if(Object.hasOwn(value,'$ref')){
  const id=documentId(value);
  found.push({path:assetFile(value,documents),documentId:id,pointer:value.$ref?.Pointer,field:parts.join('.'),type:typeof id==='string'?typeOf(id):undefined,parts,selection:String(parts.at(-1)).endsWith('Key')});
  return found;
 }
 for(const [key,v] of Object.entries(value)){
  if(literalKey(key))continue;
  const next=[...parts,key];
  if(v&&typeof v==='object')references(v,next,found,documents);
 }
 return found;
}
module.exports={extensions,typeOf,assetKey,assetFile,references,indexPath,documentId,documentReference};
