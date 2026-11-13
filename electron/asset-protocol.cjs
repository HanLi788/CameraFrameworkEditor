// Files are addressed relative to CameraFramework; JSON references are relative to Assets.
const extensions={Rig:'.rig',Pipeline:'.pipeline',Input:'.userInput',TransitionInput:'.transitionInput',Value:'.transitionValue',Effect:'.effect',PostProcessing:'.postProcessing',Camera:'.camera',Share:'.share',VirtualInput:'.virtualInput',NumEffect:'.numEffect',BoolEffect:'.boolEffect',Filter:'.filter',Range:'.range',Sensitivity:'.sensitivity',Occlusion:'.occlusion',Smooth:'.smooth',Curve:'.curve'};
const typeOf=p=>Object.keys(extensions).find(k=>p.endsWith(extensions[k]));
const assetKey=p=>p.startsWith('Assets/')?p.slice(7):p;
const assetFile=p=>/^(Shared|GameplayCameraSystem|PostProcessingSystem)\//.test(p)?'Assets/'+p:p;
const literalKey=key=>['Name','Description','Params','PerformanceType'].includes(key);
function references(value,parts=[],found=[]){
 if(!value||typeof value!=='object')return found;
 for(const [key,v] of Object.entries(value)){
  if(literalKey(key))continue;
  const next=[...parts,key];
  if(typeof v==='string'&&/^(Shared|GameplayCameraSystem|PostProcessingSystem)\//.test(v)&&typeOf(v))found.push({path:assetFile(v),rawPath:v,field:next.join('.'),type:typeOf(v),parts:next,selection:key.endsWith('Key')});
  else if(v&&typeof v==='object')references(v,next,found);
 }
 return found;
}
module.exports={extensions,typeOf,assetKey,assetFile,references};
