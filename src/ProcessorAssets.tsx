import {useEffect,useRef} from 'react';
import {t} from './i18n';
import {stageLabels} from './pipelineModel.mjs';
export default function ProcessorAssets({model,stage,onStage}:any){
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{const selected=host.current?.querySelector<HTMLElement>('[aria-pressed="true"]');if(selected?.closest('details'))(selected.closest('details') as HTMLDetailsElement).open=true;},[stage,model.rig?.path]);
 const button=(item:any,i?:number)=><button key={item.name} data-processor={item.name} className={'processor-choice '+(stage===item.name?'active':'')} aria-pressed={stage===item.name} onClick={()=>onStage(item.name)}>{i!==undefined&&<span>{String(i+1).padStart(2,'0')}</span>}<b>{t(stageLabels[item.name]||item.name)}</b></button>;
 return <section ref={host} className="sidebar-control" aria-label={t('处理器资产')} data-sidebar-control="processors"><h3>{t('处理器资产')}</h3><div className="processor-choices">{model.flow.map((item:any,i:number)=>button(item,i))}</div>{model.disabled.length>0&&<details className="disabled-processors"><summary>{t('已停用处理器')}</summary>{model.disabled.map((item:any)=>button(item))}</details>}</section>;
}
