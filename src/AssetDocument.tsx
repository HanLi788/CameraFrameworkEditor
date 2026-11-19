import {useMemo,useState} from 'react';
import {ReferenceCatalog} from './ReferenceCatalog';
import {trackDocumentEdit,queueDocumentEdit} from './documentEdits.mjs';
import {flushRangeEdits} from './rangeDrafts';
import {t} from './i18n';
import {format,parse} from './types';
import RigOverview from './RigOverview';
import InputBlendEditor from './InputBlendEditor';
import TransitionInputEditor from './TransitionInputEditor';
import TransitionValueEditor from './TransitionValueEditor';
import PostAssetEditor from './PostAssetEditor';
import EffectTable from './EffectTable';
import PipelineTable from './PipelineTable';
import Fields from './Fields';
import CurveEditor from './CurveEditor';
import CurveParameters from './CurveParameters';
import AssetRenderBoundary from './AssetRenderBoundary';
const api=window.cameraEditor;

export default function AssetDocument({effectCatalog,inputCatalog,tab,active,doc,assets,open,report,processor,navigation}:any){
 const [reload,setReload]=useState(false),[curveNode,setCurveNode]=useState(0),[effectPresets,setEffectPresets]=useState<Record<string,any>>({});
 const asset=assets.find((a:any)=>a.path===tab.path),value=useMemo(()=>doc?parse(doc.text):null,[doc?.text]);
 const send=(job:Promise<any>)=>job.catch(report);
 const editField=(parts:any[],next:any,baseValue:any)=>send(trackDocumentEdit(tab.path,api.editField({path:tab.path,parts,value:next,baseValue})));
 const transform=(update:any)=>send(trackDocumentEdit(tab.path,(async()=>{await flushRangeEdits(tab.path);return queueDocumentEdit(tab.path,async()=>{const current=(await api.ensure(tab.path)).docs.find((item:any)=>item.path===tab.path);if(!current)throw Error(t('文档未打开'));const next=update(parse(current.text));return next?api.editText({path:tab.path,text:format(next),baseText:current.text}):false;});})()));
 const props={value,assets,onNavigate:open,onField:editField,onTransform:transform,path:tab.path,inputCatalog};
 let body;
 if(!value||!asset)body=<p role="alert" className="notice">{t('资产数据无效，请修复文件后重新载入。')}</p>;
 else if(asset.type==='Rig')body=<RigOverview {...props} navigation={navigation} active={active} focus={processor}/>;
 else if(asset.type==='Curve')body=<div className="curve-window"><div className="document-scroll"><CurveEditor data={value} selected={curveNode} onSelect={setCurveNode} onChange={(next:any)=>transform(()=>next)}/></div><div className="curve-window-parameters"><CurveParameters data={value} selected={curveNode} onSelect={setCurveNode} onChange={(next:any)=>transform(()=>next)}/></div></div>;
 else if(asset.type==='InputBlend')body=<InputBlendEditor {...props}/>;
 else if(asset.type==='TransitionInput')body=<TransitionInputEditor {...props}/>;
 else if(asset.type==='Value')body=<TransitionValueEditor {...props} catalog={effectCatalog}/>;
 else if(asset.type==='Effect')body=<EffectTable {...props} presets={effectPresets} setPresets={setEffectPresets} catalog={effectCatalog}/>;
 else if(asset.type==='Pipeline')body=<PipelineTable {...props}/>;
 else if(['VirtualInput','NumEffect','BoolEffect','Filter'].includes(asset.type))body=<PostAssetEditor {...props} assetType={asset.type} catalog={effectCatalog}/>;
 else body=<Fields {...props} assetType={asset.type} path="" parts={[]}/>;
 return <ReferenceCatalog.Provider value={effectCatalog?.references}><section role="tabpanel" aria-label={tab.path} className="asset-document" style={{display:active?'flex':'none'}}>
  {doc?.conflict&&<div className="conflict-banner">{t('磁盘文件已变化，草稿已保留。')}<button onClick={()=>setReload(true)}>{t('重新载入磁盘版本')}</button></div>}
  <AssetRenderBoundary revision={doc?.version||0} onReload={()=>api.reload(tab.path)}>{asset?.type==='Curve'?body:<div className="asset-form-scroll"><div className={'asset-form '+(asset?.type==='Effect'?'effect-form':'')}>{body}</div></div>}</AssetRenderBoundary>
  {reload&&<div className="modal-overlay"><div className="modal" role="dialog" aria-label={t('重新载入磁盘版本')}><h2>{t('重新载入磁盘版本')}</h2><div className="modal-actions"><button onClick={()=>setReload(false)}>{t('取消')}</button><button onClick={()=>send(api.reload(tab.path).then(()=>{setReload(false);setEffectPresets({});}))}>{t('载入磁盘版本')}</button></div></div></div>}
 </section></ReferenceCatalog.Provider>;
}
