import FixedTable from './FixedTable';
import {t} from './i18n';
import AssetSlot from './AssetSlot';
import NumericInput from './NumericInput';
import Icon from './Icon';
import {blendChannels,blendUsers,blendProblems,weightError} from './inputBlend.mjs';

export default function InputBlendEditor({value,path,assets,onNavigate,onTransform,onField}:any){
 const problems=blendProblems(value,assets,blendUsers(assets,path));
 return <div className="input-blend-editor">
  {problems.map(problem=><p key={problem} role="alert" className="range-error">{t(problem)}</p>)}
  {Array.isArray(value.Rows)&&<div className="range-table-scroll input-blend-scroll"><FixedTable columns={[164,...value.Rows.map(()=>212)]} className="input-blend-table" aria-label={t('输入混合权重')}>

   <thead><tr><th scope="col">{t('通道')}</th>{value.Rows.map((row:any,index:number)=><th key={index} scope="col" data-blend-source={index}><AssetSlot compact value={row?.InputAsset} type="Asset" label={'Rows.'+index+'.InputAsset'} assets={assets} choices={assets.filter((asset:any)=>['Input','TransitionInput'].includes(asset.type))} onNavigate={onNavigate} onChange={(ref:any)=>onField(['Rows',index,'InputAsset'],ref,row?.InputAsset)}/></th>)}</tr></thead>
   <tbody>{blendChannels.map(([name,label,icon])=><tr key={name} data-blend-channel={name}><th scope="row" title={name}><div className="range-channel"><Icon name={'channel-'+icon} size={13}/><span>{t(label)}</span></div></th>{value.Rows.map((row:any,index:number)=><td key={index} data-blend-row={index}><NumericInput single name={'Rows.'+index+'.Weights.'+name} value={{Value:row?.Weights?.[name]}} validate={weightError} onChange={(next:any)=>row?.Weights&&typeof row.Weights==='object'?onField(['Rows',index,'Weights',name],next.Value,row.Weights[name]):onTransform((current:any)=>({...current,Rows:current.Rows.map((item:any,i:number)=>i===index?{...item,Weights:{[name]:next.Value}}:item)}))}/></td>)}</tr>)}</tbody>
  </FixedTable></div>}
 </div>;
}
