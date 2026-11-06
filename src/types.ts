export type Issue={path:string;field?:string;message:string;severity:string};
export type Asset={id:string;type:string;path:string;data:any;refs:{id:string;field:string;type?:string}[]};
export type Snapshot={root:string;index:any;indexRevision:string;directories:string[];files:{path:string;name:string;dir:string;extension:string}[];assets:Asset[];issues:Issue[]};
export type Document={path:string;text:string;saved:string;revision:string;version:number;conflict:boolean;dirty:boolean;canUndo:boolean;canRedo:boolean};
declare global {interface Window{cameraEditor:any;MonacoEnvironment:any}}
export const typeNames:Record<string,string>={Value:'目标值',Rig:'相机装置',Input:'输入',Range:'范围',Sensitivity:'灵敏度',Smooth:'平滑',Effect:'效果',Occlusion:'遮挡',Curve:'曲线',Pipeline:'管线'};
export const parse=(text:string)=>{try{return JSON.parse(text.replace(/^\uFEFF/,''));}catch{return null;}};
export const format=(data:any)=>JSON.stringify(data,null,2)+'\n';
export const filename=(p:string)=>p.split('/').at(-1)||p;
export function collectReferences(value:any,path='',refs:any[]=[]){
  if(!value||typeof value!=='object')return refs;
  for(const [key,v]of Object.entries(value)){const at=path?path+'.'+key:key;
    if(typeof v==='string'&&(key==='AssetId'||key.endsWith('AssetId')||['Curve','ResponseCurve','LowerCurve','UpperCurve'].includes(key)))refs.push({id:v,field:at});
    else if(v&&typeof v==='object')collectReferences(v,at,refs);
  }return refs;
}
