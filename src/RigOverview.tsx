import {assetFile} from './assetPaths.mjs';
import {useEffect,useRef} from 'react';
import {t} from './i18n';
import {stageLabels} from './pipelineModel.mjs';
import {commonRigSections} from './pipelineViewModel.mjs';
import Fields from './Fields';
import MountSlots from './MountSlots';

export default function RigOverview({value,assets,onNavigate,onField,onTransform,inputCatalog,focus,active,navigation}:any){
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(active)host.current?.closest('.asset-form-scroll')?.scrollTo({top:0,left:0});},[focus,active,navigation]);
 const pipeline=assets.find((asset:any)=>asset.path===assetFile(value.Pipelines?.[0],assets));
 const stages=[...new Set<string>([...(pipeline?.data?.Flow||[]),...(pipeline?.data?.Disabled||[]),...Object.keys(value.Processors||{})])].filter(stage=>Object.hasOwn(value.Processors||{},stage));
 const common=Object.fromEntries(Object.entries(value).filter(([key])=>!['Processors','Pipelines','Ranges','Name','Description','SchemaVersion'].includes(key)));
 const selected=commonRigSections.some(item=>item.key===focus)||stages.includes(focus)?focus:'';
 const commonSections=commonRigSections.filter(item=>!selected||item.key===selected);
 return <div className="rig-overview" ref={host}>
  {commonSections.length>0&&<section data-rig-group="common" className="rig-asset-group">{!selected&&<h2>{t('公共配置')}</h2>}<div className="mount-stack">{commonSections.map(({key,label})=><MountSlots key={key} value={value[key]||[]} path={key} title={label} type={key==='Pipelines'?'Pipeline':'Range'} assets={assets} onNavigate={onNavigate} onChange={(next:any)=>onField([key],next,value[key])}/>)}</div>{!selected&&Object.keys(common).length>0&&<Fields value={common} assetType="Rig" assets={assets} onNavigate={onNavigate} onField={onField} onTransform={onTransform}/>}</section>}
  {stages.filter(stage=>!selected||stage===selected).map(stage=><section key={stage} data-rig-group={stage} className="rig-asset-group">{!selected&&<h2>{t(stageLabels[stage]||stage)}</h2>}<Fields value={value.Processors[stage]} path={'Processors.'+stage} parts={['Processors',stage]} assetType="Rig" assets={assets} inputCatalog={inputCatalog} onNavigate={onNavigate} onField={onField} onTransform={onTransform}/></section>)}
 </div>;
}
