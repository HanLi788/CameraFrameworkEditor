export type Issue={path:string;field?:string;message:string;severity:string};
export type Asset={type:string;path:string;data:any;refs:{path:string;field:string;type?:string}[]};
export type Snapshot={root:string;snapshotRevision:string;directories:string[];files:{path:string;name:string;dir:string;extension:string}[];assets:Asset[];issues:Issue[]};
export type Document={path:string;text:string;saved:string;revision:string;version:number;conflict:boolean;dirty:boolean;canUndo:boolean;canRedo:boolean};
declare global {interface Window{cameraEditor:any;MonacoEnvironment:any}}
export const typeNames:Record<string,string>=Object.fromEntries(['Value','Rig','Input','Range','Sensitivity','Smooth','Effect','Occlusion','Curve','Pipeline'].map(k=>[k,k]));
export const parse=(text:string)=>{try{return JSON.parse(text.replace(/^\uFEFF/,''));}catch{return null;}};
export const format=(data:any)=>JSON.stringify(data,null,2)+'\n';
export const filename=(p:string)=>p.split('/').at(-1)||p;
export function mountType(path:string):string|undefined {
  return ({Ranges:'Range',Pipelines:'Pipeline','Processors.Effects':'Effect','Processors.Smooth':'Smooth','Processors.Occlusion':'Occlusion','Processors.Input.SensitivityAssets':'Sensitivity','Processors.Input.Assets':'Input'})[path];
}
export function collectReferences(value:any,path='',refs:any[]=[]){
  if(!value||typeof value!=='object')return refs;
  for(const [key,v]of Object.entries(value)){const at=path?path+'.'+key:key;
    const type=['Curve','ResponseCurve','LowerCurve','UpperCurve'].includes(key)?'Curve':key==='RangeAsset'?'Range':key==='Path'&&/^ValueAssets\.\d+$/.test(path)?'Value':Array.isArray(value)?mountType(path):undefined;
    if(type&&typeof v==='string')refs.push({path:v,field:at,type});
    else if(v&&typeof v==='object')collectReferences(v,at,refs);
  }return refs;
}
