import {lazy,Suspense,useState} from 'react';
import Fields from './Fields';
import CurveEditor,{curveTemplate} from './CurveEditor';
import CurveParameters from './CurveParameters';
import Icon,{IconButton,assetIcons} from './Icon';
import {filename,format,parse} from './types';
const TextEditor=lazy(()=>import('./TextEditor'));
const api=window.cameraEditor;
export default function AssetDocument({tab,active,doc,assets,open,report}:any){
  const [mode,setMode]=useState('form'),[reload,setReload]=useState(false);
  const asset=assets.find((a:any)=>a.path===tab.path),value=doc?parse(doc.text):null;
  const send=(p:Promise<any>)=>p.catch(report);
  const edit=(text:string)=>{if(doc&&text!==doc.text)send(api.editText({path:doc.path,text,baseText:doc.text}));};
  const navigate=(id:string)=>{const a=assets.find((a:any)=>a.path===id);if(a)open(a.path);};
  return <section role="tabpanel" aria-label={tab.path} className="asset-document" style={{display:active?'flex':'none'}}>
    <div className="asset-window-heading"><div><b>{asset?.path||filename(tab.path)}</b><small>{tab.contextRig?'场景上下文：'+tab.contextRig:'资产编辑'}</small></div><div className="spacer"/>{asset&&<div className="segmented"><button className={mode==='form'?'active':''} onClick={()=>setMode('form')}>资产</button><button className={mode==='text'?'active':''} onClick={()=>setMode('text')}>源码</button></div>}<IconButton icon="locate" label="在内容浏览器中定位" onClick={()=>send(api.reveal(tab.path))}/></div>
    {doc?.conflict&&<div className="conflict-banner">磁盘文件已变化，草稿已保留。<button onClick={()=>setReload(true)}>重新载入磁盘版本</button></div>}
    {doc&&(mode==='text'||!asset)?<div className="text-editor"><Suspense fallback={<div className="empty-state">正在加载文本编辑器…</div>}><TextEditor doc={doc} onReady={()=>{}} onChange={edit}/></Suspense></div>:asset?.type==='Curve'&&value?<div className="curve-window"><div className="document-scroll"><CurveEditor data={value} onChange={v=>edit(format(v))}/><div className="notice">保存会更新当前共享曲线，所有引用方将使用保存后的曲线。</div></div><div className="curve-window-parameters"><h3>曲线参数</h3><label className="curve-parent-selector">父类型<select aria-label="曲线父类型" value={value.ParentType} onChange={e=>edit(format(curveTemplate(e.target.value)))}><option>Bezier</option><option>CubicHermiteSpline</option></select></label><CurveParameters data={value} onChange={(v:any)=>edit(format(v))}/><p>更换父类型会重建控制点，可撤销。</p><div className="curve-impact"><h3>引用此曲线 · {assets.filter((a:any)=>a.refs.some((r:any)=>r.path===asset.path)).length} 份资产</h3><p>以下资产中的对应引用槽均受修改影响。</p>{assets.filter((a:any)=>a.refs.some((r:any)=>r.path===asset.path)).map((a:any)=><button key={a.path} onClick={()=>open(a.path)}>{a.path}<Icon name="open"/></button>)}</div></div></div>:<div className="asset-form-scroll"><div className="asset-form-title"><span className={'asset-emblem type-'+asset?.type}><Icon name={assetIcons[asset?.type]||'file'} size={32}/></span><div><h2>{asset?.data?.Name||asset?.path}</h2><p>{asset?.data?.Description||'通过图标槽选择和打开引用资产；曲线在引用处只读。'}</p></div></div><div className="asset-form">{doc&&value?<Fields value={value} assets={assets} onNavigate={navigate} onChange={(v:any)=>edit(format(v))} onField={(parts:any[],v:any,baseValue:any)=>send(api.editField({path:doc.path,parts,value:v,baseValue}))}/>:<div className="notice">JSON 无效，请在源码页修复。</div>}</div></div>}
    {reload&&<div className="modal-overlay"><div className="modal"><h2>重新载入磁盘版本</h2><p>将替换当前草稿，可通过撤销恢复。</p><div className="modal-actions"><button onClick={()=>setReload(false)}>取消</button><button onClick={()=>send(api.reload(tab.path).then(()=>setReload(false)))}>载入磁盘版本</button></div></div></div>}
  </section>;
}
