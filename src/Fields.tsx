import {useEffect,useState} from 'react';
import {mountType} from './types';
import MountSlots from './MountSlots';
import CallParams from './CallParams';
import {curveY} from './CurveEditor';
import AssetSlot from './AssetSlot';
import Icon from './Icon';
import ValueSlots from './ValueSlots';
const labels:Record<string,string>={ValueAssets:'目标值资产',Value:'目标值',ValueType:'值类型',bEnabled:'启用',Pipelines:'管线资产',RangeAsset:'参考范围',Object:'上下文对象',Interface:'接口名称',Params:'有序参数',bMemberFunction:'成员函数',Transitions:'过渡生命周期',SensitivityAssets:'灵敏度资产',Processors:'处理器',Ranges:'范围约束',Channels:'通道',Sources:'输入源',Assets:'资产挂载',Weight:'贡献权重',Priority:'优先级',ResponseCurve:'响应曲线',LowerCurve:'下边缘曲线',UpperCurve:'上边缘曲线',Curve:'曲线',FreeZone:'自由区',DeadZone:'死区',SensitivityRange:'灵敏度倍率',SpeedRange:'速度范围',Min:'最小值',Max:'最大值',Duration:'时长（秒）',Reference:'参考系',Sample:'采样方式',Phase:'阶段',Input:'输入',Effects:'效果',Smooth:'平滑',Occlusion:'遮挡',Render:'渲染目标',Dist:'距离',FOV:'视场角',Yaw:'水平角',Pitch:'俯仰角',Roll:'翻滚角',AnchorLocOffset:'锚点偏移',AnchorLoc:'锚点位置',CameraRot:'相机旋转',MaxLag:'最大滞后',Description:'描述',Name:'名称',Id:'业务 ID',SchemaVersion:'协议版本',ParentType:'曲线父类型',Points:'样条节点',Tangent:'切线 dy/dx',ProbeRadius:'探测半径',MaterialSlot:'材质槽',Opacity:'透明度',FadeHoldDuration:'透明保持时长',OutputRange:'输出范围',InputRange:'输入范围',Outputs:'输出参数',Source:'数据来源',Defaults:'默认状态'};
function expectedType(key:string){if(/Curve$/.test(key))return 'Curve';if(key==='RangeAsset')return 'Range';return null;}
function Scalar({value,onChange,numeric=false,readOnly=false,label}:any){
  const [draft,setDraft]=useState(String(value??''));useEffect(()=>setDraft(String(value??'')),[value]);
  const commit=()=>{if(numeric&&(!draft.trim()||!Number.isFinite(Number(draft))))setDraft(String(value));};
  return <input aria-label={label} readOnly={readOnly} type={numeric?'number':'text'} step="any" value={draft} onChange={e=>{const text=e.target.value;setDraft(text);if(readOnly)return;if(numeric){const n=Number(text);if(text.trim()&&Number.isFinite(n))onChange(n);}else onChange(text);}} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape'){setDraft(String(value));e.currentTarget.blur();}}}/>;
}
export default function Fields({value,onChange,assets,onNavigate,path='',depth=0,parts=[],onField}:any){
  const [outputName,setOutputName]=useState('');
  if(value===null||typeof value!=='object')return <span>请在源码中编辑此值</span>;
  const array=Array.isArray(value);
  const emit=(v:any)=>onField?onField(parts,v,value):onChange(v);
  const update=(key:string,v:any)=>{if(onField){onField([...parts,key],v,value[key]);return;}const copy=array?[...value]:{...value};copy[key]=v;onChange(copy);};
  function addItem(){
    if(path==='Points'&&value.length>=2){const a=value[value.length-2],b=value[value.length-1];const x=(a.X+b.X)/2;const data={ParentType:'CubicHermiteSpline',Points:value};const h=Math.min(.00001,(b.X-a.X)/100);const point={X:x,Y:curveY(data,x),Tangent:(curveY(data,x+h)-curveY(data,x-h))/(2*h)};emit([...value.slice(0,-1),point,b]);return;}
    let item:any=value.length?structuredClone(value[value.length-1]):null;
    if(!item && /Flow|Disabled/.test(path))item='';
    if(item!==null)emit([...value,item]);
  }
  if(array&&mountType(path))return <MountSlots value={value} onChange={emit} assets={assets} onNavigate={onNavigate} path={path} type={mountType(path)}/>;
  if(path==='Source.Params'&&array)return <CallParams value={value} onChange={emit}/>;
  if(path==='ValueAssets'&&array)return <ValueSlots value={value} onChange={emit} assets={assets} onNavigate={onNavigate}/>;
  return <div className={'fields depth-'+depth}>{path==='Source'&&<p className="field-hint">对象从 CameraContext 解析，例如 Owner 或 Owner.CharacterMovement。接口只填写方法名；实际执行时要求返回有限数字。</p>}{Object.entries(value).map(([key,v])=>{
    if(key==='SchemaVersion')return null;
    const at=path?path+'.'+key:key;const label=labels[key]||key;
    if(v!==null&&typeof v==='object')return <details key={key} open={depth<2} className="field-group"><summary><Icon name="chevron" className="disclosure-icon"/><span>{array?`项目 ${Number(key)+1}`:label}</span><small>{Array.isArray(v)?`${v.length} 项`:Object.keys(v).length+' 字段'}</small>{(array||path==='Outputs')&&<button title="移除此项" onClick={e=>{e.preventDefault();if(array)emit(value.filter((_:any,i:number)=>i!==Number(key)));else{const next={...value};delete next[key];emit(next);}}}><Icon name="close"/></button>}</summary><Fields value={v} onChange={(n:any)=>update(key,n)} assets={assets} onNavigate={onNavigate} path={at} depth={depth+1} parts={[...parts,key]} onField={onField}/></details>;
    const refType=expectedType(key);const isRef=!!refType;
    if(isRef&&typeof v==='string')return <AssetSlot key={key} value={v} type={refType} assets={assets} label={at} onNavigate={onNavigate} onChange={(id:string)=>update(key,id)}/>;
    return <div className="field" key={key} title={at}><label><span>{label}</span>{label!==key&&<small>{key}</small>}</label><div className="field-control">{typeof v==='boolean'?<button aria-label={at} className={'switch '+(v?'on':'')} role="switch" aria-checked={v} onClick={()=>update(key,!v)}><i/></button>:<Scalar value={v} numeric={typeof v==='number'} readOnly={key==='SchemaVersion'} label={at} onChange={(n:any)=>update(key,n)}/>}</div></div>;
  })}{path==='Outputs'&&<div className="output-add"><input aria-label="新增输出参数" placeholder="参数名，例如 FOV 或 AnchorLocOffset.X" value={outputName} onChange={e=>setOutputName(e.target.value)}/><button disabled={!outputName.trim()||Object.hasOwn(value,outputName.trim())||['__proto__','constructor','prototype'].includes(outputName.trim())||!assets.some((a:any)=>a.type==='Curve')} onClick={()=>{const name=outputName.trim();const curve=assets.find((a:any)=>a.path==='Assets/CurveAssets/Bezier/Linear.curve')||assets.find((a:any)=>a.type==='Curve');emit({...value,[name]:{InputRange:{Min:0,Max:1},InputNeutral:0,DeadZone:{Min:0,Max:0},OutputRange:{Min:0,Max:1},OutputNeutral:0,BelowRangePolicy:'Clamp',AboveRangePolicy:'Clamp',Curve:curve.path}});setOutputName('');}}>添加输出</button></div>}{array&&<button className="add-item" onClick={addItem} disabled={!value.length&&!/(Assets|SensitivityAssets|Sources|Flow|Disabled)$/.test(path)}><Icon name="plus"/> 添加项目</button>}</div>;
}
