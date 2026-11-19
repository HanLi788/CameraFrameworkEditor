import {collectAssetReferences} from './assetPaths.mjs';

// Disk assets already contain resolved references. Only changed drafts need parsing.
export function draftAssetView(){
 let cache=new Map(),identity='';
 return (assets,docs)=>{
  const nextIdentity=JSON.stringify(assets.map(a=>[a.path,a.documentId]));
  if(identity!==nextIdentity){identity=nextIdentity;cache.clear();}
  const dirty=new Map(docs.filter(d=>d.dirty).map(d=>[d.path,d]));
  const next=new Map();
  const list=assets.map(asset=>{
   const doc=dirty.get(asset.path);if(!doc)return asset;
   let item=cache.get(asset.path);
   if(!item||item.text!==doc.text||item.base!==asset){
    let data;try{data=JSON.parse(doc.text.replace(/^\uFEFF/,''));}catch{data=asset.data;}
    item={text:doc.text,base:asset,asset:{...asset,data,refs:collectAssetReferences(data,[],[],assets)}};
   }
   next.set(asset.path,item);return item.asset;
  });cache=next;return list;
 };
}
