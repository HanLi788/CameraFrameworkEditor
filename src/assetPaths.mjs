export const assetKey=p=>p?.startsWith('Assets/')?p.slice(7):p;
export const assetFile=p=>/^(Shared|GameplayCameraSystem|PostProcessingSystem)\//.test(p||'')?'Assets/'+p:p;
const suffixes={rig:'Rig',pipeline:'Pipeline',userInput:'Input',transitionInput:'TransitionInput',transitionValue:'Value',curve:'Curve',effect:'Effect',range:'Range',smooth:'Smooth',sensitivity:'Sensitivity',occlusion:'Occlusion',camera:'Camera',share:'Share',postProcessing:'PostProcessing',virtualInput:'VirtualInput',numEffect:'NumEffect',boolEffect:'BoolEffect',filter:'Filter'};
export const referenceType=value=>typeof value==='string'&&/^(Shared|GameplayCameraSystem|PostProcessingSystem)\//.test(value)?suffixes[value.split('.').at(-1)]:undefined;
export function collectAssetReferences(value,parts=[],refs=[]){
 if(!value||typeof value!=='object')return refs;
 for(const [key,v]of Object.entries(value)){
  if(['Name','Description','Params','PerformanceType'].includes(key))continue;
  const next=[...parts,key],type=referenceType(v);
  if(type)refs.push({path:assetFile(v),rawPath:v,type,field:next.join('.'),parts:next});
  else if(v&&typeof v==='object')collectAssetReferences(v,next,refs);
 }
 return refs;
}
export const assetExtensions={Rig:'.rig',Pipeline:'.pipeline',Input:'.userInput',TransitionInput:'.transitionInput',Value:'.transitionValue',Curve:'.curve',Effect:'.effect',Range:'.range',Smooth:'.smooth',Sensitivity:'.sensitivity',Occlusion:'.occlusion',VirtualInput:'.virtualInput',NumEffect:'.numEffect',BoolEffect:'.boolEffect',Filter:'.filter'};
