import {useEffect,useMemo,useRef,useState} from 'react';
import {t} from './i18n';
import {filename} from './types';
import {stageLabels} from './pipelineModel.mjs';
import {rigChoicesBySpace} from './pipelineViewModel.mjs';
import Icon,{IconButton} from './Icon';
const spaceLabels:Record<string,string>={Action:'动作',Battle:'战斗',Idle:'空闲',Interactive:'交互',Preview:'预览',Roam:'漫游／序列',Unassigned:'未识别空间'};
export default function ProcessorPipeline({assets,model,stage,context,onRig,onStage,onOpen,onCollapse}:any){
 const groups=useMemo(()=>rigChoicesBySpace(assets),[assets]);
 const currentSpace=groups.find(group=>group.rigs.some(rig=>rig.path===model.rig?.path))?.space||'';
 const [space,setSpace]=useState(currentSpace),track=useRef<HTMLDivElement>(null);
 // Asset tabs retain the current rig and processor context.
 useEffect(()=>setSpace(currentSpace),[context,currentSpace]);
 const rigs=groups.find(group=>group.space===space)?.rigs||[];
 const selectedRig=currentSpace===space?model.rig?.path||'':'';
 const disabledActive=model.disabled.some((item:any)=>item.name===stage);
 useEffect(()=>{
  if(disabledActive){const group=track.current?.querySelector<HTMLDetailsElement>('.disabled-processors');if(group)group.open=true;}
  track.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({block:'nearest',inline:'nearest'});
 },[stage,model.rig?.path,disabledActive]);
 return <section className="processor-pipeline" aria-label={t('处理器管线')}>
  <header className="context-heading"><h2>{t('装置与处理器')}</h2><IconButton icon="expandRight" label={t('收起装置与处理器')} onClick={onCollapse}/></header>
  <div className="pipeline-context">
   <label className="pipeline-space-selector"><span className="section-kicker">{t('空间')}</span><select aria-label={t('相机空间')} value={groups.some(group=>group.space===space)?space:''} onChange={e=>setSpace(e.target.value)}><option value="" disabled>{t('选择空间')}</option>{groups.map(group=><option key={group.space} value={group.space}>{t(spaceLabels[group.space]||group.space)}</option>)}</select></label>
   <label className="pipeline-rig-selector"><span className="section-kicker">{t('当前装置')}</span><select aria-label={t('当前装置')} title={selectedRig} value={selectedRig} disabled={!space||!rigs.length} onChange={e=>onRig(e.target.value)}><option value="" disabled>{t('选择装置')}</option>{rigs.map(rig=><option key={rig.path} value={rig.path} title={rig.path}>{rig.name}</option>)}</select></label>
   {selectedRig&&model.pipeline&&<button className="pipeline-source" title={model.pipelinePath} onClick={()=>onOpen(model.pipelinePath)}><Icon name="pipeline"/><span>{filename(model.pipelinePath)}</span><Icon name="open" size={13}/></button>}
  </div>
  {selectedRig?<div className="pipeline-track" ref={track}>
   <button className={'processor-stage rig-settings '+(!stage?'active':'')} aria-pressed={!stage} onClick={()=>onStage('')}><Icon name="camera"/><b>{t('装置设置')}</b><small>{t('范围与管线挂载')}</small></button>
   <h3 className="pipeline-flow-heading">{t('处理器执行顺序')}</h3>
   <div className="pipeline-flow">{model.flow.map((item:any,i:number)=><div className="pipeline-step" key={item.name}>{i>0&&<Icon name="chevron" className="pipeline-arrow"/>}<button data-processor={item.name} className={'processor-stage '+(stage===item.name?'active ':'')+(!item.configured?'missing':'')} aria-pressed={stage===item.name} title={item.implementation} onClick={()=>onStage(item.name)}><span className="stage-index">{String(i+1).padStart(2,'0')}</span><b>{t(stageLabels[item.name]||item.name)}</b><small>{item.name}{!item.configured?' · '+t('未配置'):''}</small></button></div>)}</div>
   {!model.pipeline&&<span className="notice">{t('管线资产缺失，请检查装置设置。')}</span>}
   {model.disabled.length>0&&<details className="disabled-processors" key={model.rig.path}><summary><Icon name="chevron"/><span>{t('已停用处理器')}</span><small>{model.disabled.length}</small></summary><div>{model.disabled.map((item:any)=><button key={item.name} data-processor={item.name} aria-pressed={stage===item.name} className={'processor-disabled '+(stage===item.name?'active':'')} onClick={()=>onStage(item.name)}>{t(stageLabels[item.name]||item.name)}<small>{item.name}</small></button>)}</div></details>}
  </div>:<div className="pipeline-placeholder">{t(space?'请选择该空间中的装置。':'先选择空间，再选择装置。')}</div>}
 </section>;
}
