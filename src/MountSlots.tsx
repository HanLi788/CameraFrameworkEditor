import {useState} from 'react';
import {Asset} from './types';
import AssetSlot from './AssetSlot';
import {IconButton} from './Icon';
export default function MountSlots({value,onChange,assets,onNavigate,path,type}:any){
  const [selected,setSelected]=useState('');
  const channel=path.startsWith('Processors.Input.Channels.')?path.slice('Processors.Input.Channels.'.length):null;
  const lifecycle=path==='Processors.Input.Transitions';
  const max=path==='Pipelines'||path==='Processors.Occlusion'?1:lifecycle?2:Infinity;
  const suitable=(a:Asset)=>a.type===type&&(!lifecycle||a.data?.Type==='Transition')&&(!channel||a.data?.Type==='Transition'||Object.hasOwn(a.data?.Channels||{},channel));
  const choices=assets.filter(suitable);
  const available=choices.filter((a:Asset)=>!value.includes(a.path)&&(!lifecycle||!value.some((p:string)=>assets.find((b:Asset)=>b.path===p)?.data?.Phase===a.data?.Phase)));
  const next=available.some((a:Asset)=>a.path===selected)?selected:available[0]?.path||'';
  const move=(index:number,step:number)=>{const copy=[...value];[copy[index],copy[index+step]]=[copy[index+step],copy[index]];onChange(copy);};
  return <div className="mount-slots" data-mount={path}><p className="field-hint">{path==='Pipelines'?'必须挂载一个管线。':lifecycle?'进入、退出阶段各挂载一份过渡输入；阶段在输入资产内设置。':path==='Processors.Effects'?'按顺序求值，输出贡献求和；权重在效果资产内设置。':'前项优先，空数组表示不挂载。'}</p>
    {value.map((file:string,i:number)=>{const asset=assets.find((a:Asset)=>a.path===file);return <section className="mount-row" key={i}><header><b>挂载 {i+1}</b><div className="spacer"/><IconButton icon="up" label={`上移 ${path}.${i}`} disabled={i===0} onClick={()=>move(i,-1)}/><IconButton icon="down" label={`下移 ${path}.${i}`} disabled={i===value.length-1} onClick={()=>move(i,1)}/><IconButton icon="close" label={`移除 ${path}.${i}`} disabled={path==='Pipelines'&&value.length===1} onClick={()=>onChange(value.filter((_:any,n:number)=>n!==i))}/></header><div className="mount-detail"><AssetSlot value={file} type={type} assets={assets} choices={choices.filter((a:Asset)=>a.path===file||(!value.includes(a.path)&&(!lifecycle||!value.some((p:string,n:number)=>n!==i&&assets.find((b:Asset)=>b.path===p)?.data?.Phase===a.data?.Phase))))} label={`${path}.${i}`} onNavigate={onNavigate} onChange={(p:string)=>onChange(value.map((v:string,n:number)=>n===i?p:v))}/><p className="mount-description">{asset?.data?.Description||'暂无描述'}{asset?.data?.Phase&&<small>阶段：{asset.data.Phase}</small>}{asset?.data?.Weight!==undefined&&<small>资产权重：{asset.data.Weight}</small>}</p></div></section>;})}
    {value.length<max&&<div className="mount-add"><select aria-label={`待挂载 ${path}`} value={next} onChange={e=>setSelected(e.target.value)}>{!available.length&&<option value="">没有可挂载资产</option>}{available.map((a:Asset)=><option key={a.path} value={a.path}>{a.data?.Name||a.path} · {a.path}</option>)}</select><IconButton icon="plus" label={`添加挂载 ${path}`} disabled={!next} onClick={()=>onChange([...value,next])}/></div>}
  </div>;
}
