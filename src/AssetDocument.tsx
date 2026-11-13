import {trackDocumentEdit,queueDocumentEdit,flushDocumentEdits} from './documentEdits.mjs';
import TransitionInputEditor from './TransitionInputEditor';
import TransitionValueEditor from './TransitionValueEditor';
import PostAssetEditor from './PostAssetEditor';
import PostPlan from './PostPlan';
import {flushRangeEdits} from './rangeDrafts';
import HelpTip from './HelpTip';
import {t,tt} from './i18n';
import {lazy,Suspense,useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import EffectTable from './EffectTable';
import PipelineTable from './PipelineTable';
import Fields from './Fields';
import {stageLabels} from './pipelineModel.mjs';
import CurveEditor,{curveTemplate} from './CurveEditor';
import CurveParameters from './CurveParameters';
import Icon,{IconButton} from './Icon';
import {format,parse} from './types';
const MarkdownPreview=lazy(()=>import('./MarkdownPreview'));
const TextEditor=lazy(()=>import('./TextEditor'));
const api=window.cameraEditor;
export default function AssetDocument({effectCatalog,inputCatalog,tab,active,doc,assets,open,report,toolsTarget,processor}:any){
  const markdown=/\.md$/i.test(tab.path);
  const [mode,setMode]=useState('form'),[reload,setReload]=useState(false),[curveNode,setCurveNode]=useState(0);
  const asset=assets.find((a:any)=>a.path===tab.path),value=doc?parse(doc.text):null;
  const [effectPresets,setEffectPresets]=useState<Record<string,any>>({});
  // Editor-only values survive source/form switching, never enter the document or save history.
  useEffect(()=>{const outputs=parse(doc?.text||'')?.Outputs;if(asset?.type==='Effect'&&outputs&&typeof outputs==='object'&&!Array.isArray(outputs))setEffectPresets(previous=>({...previous,...structuredClone(outputs)}));},[doc?.text,asset?.type]);
  const curveUsers=asset?.type==='Curve'?assets.filter((a:any)=>a.refs.some((r:any)=>r.path===asset.path)):[];
  const send=(p:Promise<any>)=>p.catch(report);
  const edit=(text:string)=>{if(doc&&!doc.readOnly&&text!==doc.text)return send(trackDocumentEdit(doc.path,api.editText({path:doc.path,text,baseText:doc.text})));};
  const editField=(parts:any[],v:any,baseValue:any)=>send(trackDocumentEdit(tab.path,api.editField({path:tab.path,parts,value:v,baseValue})));
  const transform=(update:any)=>send(trackDocumentEdit(tab.path,(async()=>{
    await flushRangeEdits(tab.path);
    return queueDocumentEdit(tab.path,async()=>{const current=(await api.ensure(tab.path)).docs.find((d:any)=>d.path===tab.path);if(!current)throw Error(t('文档未打开'));const next=update(parse(current.text));if(!next)return false;return api.editText({path:tab.path,text:format(next),baseText:current.text});});
  })()));
  const changeMode=(next:string)=>send((async()=>{await flushRangeEdits(tab.path);await flushDocumentEdits(tab.path);setMode(next);})());
  const navigate=(id:string)=>{const a=assets.find((a:any)=>a.path===id);if(a)open(a.path);};
  return <section role="tabpanel" aria-label={tab.path} className="asset-document" style={{display:active?'flex':'none'}}>
    {active&&toolsTarget&&createPortal(<>{(asset||markdown||doc?.readOnly)&&<div className="segmented"><button className={mode==='form'?'active':''} aria-pressed={mode==='form'} onClick={()=>changeMode('form')}>{t(markdown?"预览":"资产")}</button><button className={mode==='text'?'active':''} aria-pressed={mode==='text'} onClick={()=>changeMode('text')}>{t("源码")}</button></div>}<IconButton icon="locate" label={t("在目录中定位")} onClick={()=>send(api.reveal(tab.path))}/></>,toolsTarget)}
    {doc?.conflict&&<div className="conflict-banner">{t("磁盘文件已变化，草稿已保留。")}<button onClick={()=>setReload(true)}>{t("重新载入磁盘版本")}</button></div>}
    {doc?.readOnly&&mode!=='text'?<PostPlan value={value} open={open}/>:doc&&markdown&&mode!=='text'?<Suspense fallback={<div className="empty-state">{t('正在加载预览…')}</div>}><MarkdownPreview doc={doc} open={open} report={report}/></Suspense>:doc&&(mode==='text'||!asset)?<div className="text-editor"><Suspense fallback={<div className="empty-state">{t("正在加载文本编辑器…")}</div>}><TextEditor doc={doc} onReady={()=>{}} onChange={edit}/></Suspense></div>:asset?.type==='Curve'&&value?<div className="curve-window"><div className="document-scroll"><CurveEditor selected={curveNode} onSelect={setCurveNode} data={value} onChange={v=>edit(format(v))}/></div><div className="curve-window-parameters"><h3>{t("曲线参数")}</h3><div className="curve-parent-selector"><span className="field-label">{t("父类型")}<HelpTip label={t('曲线父类型')+' '+t('说明')}>{t("更换父类型会重建控制点，可撤销。")}</HelpTip></span><select aria-label={t("曲线父类型")} value={value.ParentType} onChange={e=>edit(format(curveTemplate(e.target.value)))}><option>Bezier</option><option>CubicHermiteSpline</option></select></div><CurveParameters selected={curveNode} onSelect={setCurveNode} data={value} onChange={(v:any)=>edit(format(v))}/><div className="curve-impact" hidden={!curveUsers.length}><h3>{t("引用此曲线 ·")}{curveUsers.length}{t("份资产")}<HelpTip label={t('共享曲线说明')}>{t("保存会更新当前共享曲线，所有引用方将使用保存后的曲线。")}</HelpTip></h3>{curveUsers.map((a:any)=><button key={a.path} onClick={()=>open(a.path)}>{a.path}<Icon name="open"/></button>)}</div></div></div>:<div className="asset-form-scroll"><div className={'asset-form'+(asset?.type==='Effect'?' effect-form':'')}>{doc&&value?asset?.type==='Effect'?<EffectTable path={tab.path} presets={effectPresets} setPresets={setEffectPresets} value={value} catalog={effectCatalog} onTransform={transform} assets={assets} onNavigate={navigate}/>:asset?.type==='Pipeline'?<PipelineTable value={value} onTransform={transform} path={tab.path} assets={assets} onNavigate={navigate}/>:asset?.type==='TransitionInput'?<TransitionInputEditor value={value} path={tab.path} assets={assets} onNavigate={navigate} onTransform={transform} onField={editField}/>:asset?.type==='Value'?<TransitionValueEditor catalog={effectCatalog} value={value} path={tab.path} assets={assets} onNavigate={navigate} onTransform={transform} onField={editField}/>:['VirtualInput','NumEffect','BoolEffect','Filter'].includes(asset?.type)?<PostAssetEditor value={value} assetType={asset.type} catalog={effectCatalog} assets={assets} onNavigate={navigate} onTransform={transform} onField={editField}/>:<>{asset?.type==='Rig'&&processor&&<div className="processor-detail-heading"><Icon name="pipeline"/><div><h3>{t(stageLabels[processor]||processor)} · {processor}</h3><small>{t('配置保存在当前装置文件中')}</small></div></div>}{asset?.type==='Rig'&&processor&&!Object.hasOwn(value.Processors||{},processor)?<div className="notice">{t('此处理器未配置，请在源码中补充。')}</div>:asset?.type==='Rig'&&processor&&value.Processors?.[processor]&&!Array.isArray(value.Processors[processor])&&!Object.keys(value.Processors[processor]).length?<div className="notice">{t('此处理器没有可编辑参数。')}</div>:<Fields inputCatalog={inputCatalog} value={asset?.type==='Rig'?(processor?value.Processors?.[processor]:Object.fromEntries(Object.entries(value).filter(([k])=>k!=='Processors'))):value} path={asset?.type==='Rig'&&processor?'Processors.'+processor:''} parts={asset?.type==='Rig'&&processor?['Processors',processor]:[]} onTransform={transform} assetType={asset?.type} effectDomain={value.Domain} assets={assets} onNavigate={navigate} onChange={(v:any)=>edit(format(v))} onField={editField}/>}</>:<div className="notice">{t("JSON 无效，请在源码页修复。")}</div>}</div></div>}
    {reload&&<div className="modal-overlay"><div className="modal"><h2>{t("重新载入磁盘版本")}</h2><p>{t("将替换当前草稿，可通过撤销恢复。")}</p><div className="modal-actions"><button onClick={()=>setReload(false)}>{t("取消")}</button><button onClick={()=>send(api.reload(tab.path).then(()=>{setEffectPresets({});setReload(false);}))}>{t("载入磁盘版本")}</button></div></div></div>}
  </section>;
}
