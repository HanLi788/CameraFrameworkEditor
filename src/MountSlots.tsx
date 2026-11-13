import {assetKey,assetFile} from './assetPaths.mjs';
import {t,tt} from './i18n';
import {useState} from 'react';
import {Asset} from './types';
import AssetSlot from './AssetSlot';
import AssetPicker from './AssetPicker';
import ArrayGroup from './ArrayGroup';
import SortableList from './SortableList';

export default function MountSlots({value,onChange,assets,onNavigate,path,type,title=path,open=true,minItems=0,choiceFilter=()=>true}:any){
  const [adding,setAdding]=useState(false);
  const max=path==='Pipelines'||path==='Processors.Occlusion'?1:Infinity;
  const suitable=(a:Asset)=>(!type||type==='Asset'||a.type===type);
  const choices=assets.filter(suitable);
  const available=choices.filter((a:Asset)=>!value.some((p:string)=>assetFile(p)===a.path)&&choiceFilter(a,-1));
  const canAdd=value.length<max&&available.length>0;
  const accept=(file:string)=>{if(canAdd&&available.some((a:Asset)=>a.path===assetFile(file))){onChange([...value,assetKey(file)]);setAdding(false);}};
  return <ArrayGroup title={title} path={path} count={value.length} canAdd={canAdd} onAdd={()=>setAdding(true)} open={open}>
    <div className="mount-slots" data-mount={path}>
      <SortableList items={value} onChange={onChange} label={path} itemKey={file=>file} renderItem={(file,i)=><AssetSlot value={file} type={type} assets={assets}
        choices={choices.filter((a:Asset)=>a.path===assetFile(file)||(!value.some((p:string)=>assetFile(p)===a.path)&&choiceFilter(a,i)))}
        label={`${path}.${i}`} compact onNavigate={onNavigate} onChange={(p:string)=>onChange(value.map((v:string,n:number)=>n===i?p:v))}
        onRemove={()=>onChange(value.filter((_:any,n:number)=>n!==i))} canRemove={value.length>Math.max(minItems,path==='Pipelines'?1:0)}/>} />
      {!value.length&&<button className="empty-mount" disabled={!canAdd} onClick={()=>setAdding(true)} onDragOver={e=>{if(e.dataTransfer.types.includes('application/x-camera-asset')){e.preventDefault();e.dataTransfer.dropEffect='link';}}} onDrop={e=>{e.preventDefault();accept(e.dataTransfer.getData('application/x-camera-asset'));}}>{t("添加或拖入资产")}</button>}
    </div>
    {adding&&<AssetPicker type={type} choices={available} onChoose={accept} onClose={()=>setAdding(false)}/>}
  </ArrayGroup>;
}
