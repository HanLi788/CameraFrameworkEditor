import {collectAssetReferences} from './assetPaths.mjs';
export type Issue={path:string;field?:string;message:string;severity:string};
export type Asset={type:string;path:string;data:any;refs:{path:string;field:string;type?:string}[]};
export type InputCatalog={revision:string;contexts:{name:string;mappings:string[];error?:string}[];issues:Issue[];runtime:boolean};
export type Snapshot={effectCatalog:any;inputCatalog:InputCatalog;root:string;workspaceRoot:string;snapshotRevision:string;directories:string[];files:{path:string;name:string;dir:string;extension:string}[];assets:Asset[];issues:Issue[]};
export type Document={path:string;text:string;saved:string;revision:string;version:number;conflict:boolean;dirty:boolean;canUndo:boolean;canRedo:boolean};
declare global {interface Window{cameraEditor:any;MonacoEnvironment:any}}
export const typeNames:Record<string,string>=Object.fromEntries(['Value','Rig','Input','TransitionInput','Range','Sensitivity','Smooth','Effect','PostProcessing','Camera','Share','VirtualInput','NumEffect','BoolEffect','Filter','Occlusion','Curve','Pipeline'].map(k=>[k,k]));
export const parse=(text:string)=>{try{return JSON.parse(text.replace(/^\uFEFF/,''));}catch{return null;}};
export const format=(data:any)=>JSON.stringify(data,null,2)+'\n';
export const filename=(p:string)=>p.split('/').at(-1)||p;
export function mountType(path:string):string|undefined {
  return ({Assets:'Asset',ValueAssets:'Value',Ranges:'Range',Pipelines:'Pipeline','Processors.Effects':'Effect','Processors.Smooth':'Smooth','Processors.Occlusion':'Occlusion',SensitivityAssets:'Sensitivity','Processors.Input.Assets':'Input'})[path];
}
export function collectReferences(value:any,path='',refs:any[]=[]){return collectAssetReferences(value,path?path.split('.'):[],refs);}
