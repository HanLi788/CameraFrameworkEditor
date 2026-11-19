import {useState} from 'react';
import {assetReference,assetFile} from './assetPaths.mjs';
import {t} from './i18n';
import AssetSlot from './AssetSlot';
import AssetPicker from './AssetPicker';
import MountTable from './MountTable';
import Icon from './Icon';

export default function MountSlots({value,onChange,assets,onNavigate,path,type,title=path,minItems=0,choiceFilter=()=>true,allowAdd=true}:any){
 const [adding,setAdding]=useState(false);
 const max=path==='Pipelines'||path==='Processors.Occlusion'?1:Infinity;
 const choices=assets.filter((a:any)=>!type||type==='Asset'||a.type===type);
 const available=choices.filter((a:any)=>!value.some((ref:any)=>assetFile(ref,assets)===a.path)&&choiceFilter(a,-1));
 const canAdd=allowAdd&&value.length<max&&available.length>0;
 return <div data-mount={path}><MountTable title={title} kind={path} columns={['顺序','资产']} actions={<button disabled={!canAdd} aria-label={t('添加挂载 ')+path} onClick={()=>setAdding(true)}><Icon name="plus"/></button>}>
  {value.map((ref:any,index:number)=><tr key={JSON.stringify(ref)}><td><div className="mount-order"><span>{index+1}</span>{value.length>1&&<><button aria-label={t('上移 ')+path+'.'+index} disabled={!index} onClick={()=>{const next=[...value];[next[index-1],next[index]]=[next[index],next[index-1]];onChange(next);}}>↑</button><button aria-label={t('下移 ')+path+'.'+index} disabled={index===value.length-1} onClick={()=>{const next=[...value];[next[index],next[index+1]]=[next[index+1],next[index]];onChange(next);}}>↓</button></>}</div></td><td><AssetSlot compact value={ref} type={type} label={path+'.'+index} assets={assets} choices={choices.filter((a:any)=>a.path===assetFile(ref,assets)||!value.some((other:any)=>assetFile(other,assets)===a.path)&&choiceFilter(a,index))} onNavigate={onNavigate} onChange={(next:any)=>onChange(value.map((other:any,i:number)=>i===index?next:other))} onRemove={()=>onChange(value.filter((_:any,i:number)=>i!==index))} canRemove={value.length>Math.max(minItems,path==='Pipelines'?1:0)}/></td></tr>)}
  {!value.length&&<tr><td>—</td><td><button className="empty-mount" disabled={!canAdd} onClick={()=>setAdding(true)}>{t('添加或拖入资产')}</button></td></tr>}
 </MountTable>{adding&&<AssetPicker type={type} choices={available} onChoose={(file:string)=>{if(canAdd){onChange([...value,assetReference(file,assets)]);setAdding(false);}}} onClose={()=>setAdding(false)}/>}</div>;
}
