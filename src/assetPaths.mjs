export const assetKey=p=>typeof p==='string'&&p.startsWith('Assets/')?p.slice(7):p;
export const documentId=value=>value&&typeof value==='object'&&!Array.isArray(value)?value.$ref?.DocumentId:undefined;
export const assetFile=(value,assets=[])=>{
 const id=documentId(value);
 if(id!==undefined)return assets.find(a=>a.documentId===id)?.path||id;
 return typeof value==='string'&&/^(Shared|GameplayCameraSystem|PostProcessingSystem)\//.test(value)?'Assets/'+value:typeof value==='string'?value:'';
};
export function assetReference(file,assets){
 const asset=assets.find(a=>a.path===file);
 if(!asset?.documentId)throw Error('资产未登记到文档索引：'+file);
 return {$ref:{DocumentId:asset.documentId,Pointer:''}};
}
const suffixes={rig:'Rig',pipeline:'Pipeline',userInput:'Input',transitionInput:'TransitionInput',transitionValue:'Value',curve:'Curve',effect:'Effect',range:'Range',smooth:'Smooth',sensitivity:'Sensitivity',occlusion:'Occlusion',camera:'Camera',share:'Share',postProcessing:'PostProcessing',virtualInput:'VirtualInput',numEffect:'NumEffect',boolEffect:'BoolEffect',filter:'Filter'};
export const referenceType=value=>typeof documentId(value)==='string'?suffixes[documentId(value).split('.').at(-1)]:undefined;
export function collectAssetReferences(value,parts=[],refs=[],assets=[]){
 if(!value||typeof value!=='object')return refs;
 if(Object.hasOwn(value,'$ref')){refs.push({path:assetFile(value,assets),documentId:documentId(value),type:referenceType(value),field:parts.join('.'),parts});return refs;}
 for(const [key,v]of Object.entries(value)){
  if(['Name','Description','Params','PerformanceType'].includes(key))continue;
  const next=[...parts,key];
  if(v&&typeof v==='object')collectAssetReferences(v,next,refs,assets);
 }
 return refs;
}
export const assetExtensions={Rig:'.rig',Pipeline:'.pipeline',Input:'.userInput',TransitionInput:'.transitionInput',Value:'.transitionValue',Curve:'.curve',Effect:'.effect',Range:'.range',Smooth:'.smooth',Sensitivity:'.sensitivity',Occlusion:'.occlusion',VirtualInput:'.virtualInput',NumEffect:'.numEffect',BoolEffect:'.boolEffect',Filter:'.filter'};
