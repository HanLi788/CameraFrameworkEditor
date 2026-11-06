import {t,tt} from './i18n';
import {useState} from 'react';
import AssetSlot from './AssetSlot';
import AssetPicker from './AssetPicker';
import ArrayGroup from './ArrayGroup';
import SortableList from './SortableList';

export default function ValueSlots({value,onChange,assets,onNavigate,title=t('目标值资产'),open=true}:any){
  const [adding,setAdding]=useState(false),choices=assets.filter((a:any)=>a.type==='Value');
  const update=(index:number,slot:any)=>onChange(value.map((v:any,i:number)=>i===index?slot:v));
  return <ArrayGroup title={title} path="ValueAssets" count={value.length} canAdd={!!choices.length} onAdd={()=>setAdding(true)} open={open}>
    <div className="value-slots"><SortableList items={value} onChange={onChange} label="ValueAssets" renderItem={(slot,i)=><div className="value-target" data-value-slot={i}>
      <AssetSlot value={slot.Path} type="Value" assets={assets} label={`ValueAssets.${i}.Path`} compact onNavigate={onNavigate} onChange={(Path:string)=>update(i,{...slot,Path})} onRemove={()=>onChange(value.filter((_:any,n:number)=>n!==i))} canRemove={value.length>1}/>
      <div className="value-key">{i===0&&<span className="badge">{t("默认")}</span>}<label><input type="checkbox" aria-label={tt`目标 ${i+1} 使用业务 ID`} checked={slot.Id!==undefined} onChange={e=>{const next={...slot};if(e.target.checked){let id=10001;while(value.some((v:any)=>v.Id===id))id++;next.Id=id;}else delete next.Id;update(i,next);}}/>{t("业务 ID")}</label>
        {slot.Id!==undefined&&<><select aria-label={tt`目标 ${i+1} ID 类型`} value={typeof slot.Id} onChange={e=>{const numeric=Number(slot.Id);update(i,{...slot,Id:e.target.value==='string'?String(slot.Id):Number.isSafeInteger(numeric)?numeric:10001+i});}}><option value="number">{t("整数")}</option><option value="string">{t("字符串")}</option></select><input aria-label={tt`目标 ${i+1} ID`} type={typeof slot.Id==='number'?'number':'text'} step="1" value={slot.Id} onChange={e=>{if(typeof slot.Id==='number'){if(!e.target.value.trim()||!Number.isSafeInteger(Number(e.target.value)))return;update(i,{...slot,Id:Number(e.target.value)});}else update(i,{...slot,Id:e.target.value});}}/></>}
      </div>
    </div>}/></div>
    {adding&&<AssetPicker type="Value" choices={choices} onChoose={Path=>{onChange([...value,{Path}]);setAdding(false);}} onClose={()=>setAdding(false)}/>}
  </ArrayGroup>;
}
