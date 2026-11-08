import {useEffect,useState} from 'react';
import {t} from './i18n';
import Icon from './Icon';
import SortableList from './SortableList';
import {pipelineProblems,toggleStage,pipelineImpact,stageLabels,implementations} from './pipelineModel.mjs';

export default function PipelineTable({value,path,onTransform,assets,onNavigate}:any){
  const [attempt,setAttempt]=useState<any[]>([]);
  const problems=pipelineProblems(value),impact=pipelineImpact(value,path,assets);
  useEffect(()=>setAttempt([]),[value]);
  const change=(update:any)=>onTransform((current:any)=>{const next=update(current),errors=pipelineProblems(next);if(errors.length){setAttempt(errors);return null;}setAttempt([]);return next;});
  const validStructure=value.Stages&&typeof value.Stages==='object'&&!Array.isArray(value.Stages)&&Array.isArray(value.Flow)&&Array.isArray(value.Disabled);
  const message=(p:any)=>t(p[0])+p[1];
  const row=(name:string,enabled:boolean)=>{const stage=value.Stages[name];return <>
    <div role="cell" className="pipeline-stage" title={name}>{t(stageLabels[name]||name)}</div>
    <div role="cell">{stage&&<select aria-label={name+'.Implementation'} value={stage.Implementation??''} onChange={e=>{const next=e.target.value;change((current:any)=>({...current,Stages:{...current.Stages,[name]:{...current.Stages[name],Implementation:next}}}));}}>{!implementations(value.SpaceType).includes(stage.Implementation)&&<option value={stage.Implementation??''}>{String(stage.Implementation??'—')}</option>}{implementations(value.SpaceType).map((id:string)=><option key={id}>{id}</option>)}</select>}</div>
    <div role="cell"><input type="checkbox" aria-label={name+'.Enabled'} checked={enabled} onChange={e=>{const enabled=e.target.checked;change((current:any)=>toggleStage(current,name,enabled));}}/></div>
  </>;};
  return <div className="pipeline-editor"><label className="pipeline-space"><span>{t('相机空间类型')}</span><select aria-label="SpaceType" value={value.SpaceType??''} onChange={e=>{const next=e.target.value;change((current:any)=>({...current,SpaceType:next}));}}>{!['Action','Battle','Idle','Interactive'].includes(value.SpaceType)&&<option value={value.SpaceType??''}>{String(value.SpaceType??'—')}</option>}{['Action','Battle','Idle','Interactive'].map(space=><option key={space}>{space}</option>)}</select></label>
    {[...problems,...attempt].map((p,i)=><p key={i} role="alert" className="range-error">{message(p)}</p>)}
    {validStructure&&<div className="range-table-scroll"><div className="pipeline-table" role="table" aria-label={t('管线阶段')}><div role="row" className="pipeline-header"><span role="columnheader">{t('排序')}</span>{['阶段','实现','启用'].map(label=><span key={label} role="columnheader">{t(label)}</span>)}</div>
      <SortableList table items={value.Flow} itemKey={(name:string)=>name} label="Flow" onChange={(Flow:any[])=>change((current:any)=>({...current,Flow}))} renderItem={name=>row(name,true)}/>
      <div role="rowgroup" className="pipeline-disabled">{value.Disabled.map((name:string)=><div key={name} role="row" className="pipeline-disabled-row"><span role="cell">—</span>{row(name,false)}</div>)}</div>
    </div></div>}
    {impact.length>0&&<div className="pipeline-impact" role="status"><strong>{t('以下装置需要同步处理器配置')}</strong>{impact.map((a:any)=><div key={a.path}><button title={a.path} onClick={()=>onNavigate(a.path)}>{a.path}<Icon name="open" size={14}/></button>{a.spaceMismatch&&<span>{t('相机空间类型不匹配')}</span>}{a.missing.length>0&&<span>{t('缺少配置：')}{a.missing.join(', ')}</span>}{a.extra.length>0&&<span>{t('停用阶段仍有配置：')}{a.extra.join(', ')}</span>}</div>)}</div>}
  </div>;
}
