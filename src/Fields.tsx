import {referenceType} from './assetPaths.mjs';
import SensitivityTable from './SensitivityTable';
import UserInputTable from './UserInputTable';
import ValueTable from './ValueTable';
import SmoothTable from './SmoothTable';
import RangeTable from './RangeTable';
import HelpTip from './HelpTip';
import {t,tt} from './i18n';
import {useEffect,useState} from 'react';
import {mountType} from './types';
import MountSlots from './MountSlots';
import CallParams from './CallParams';
import {curveY} from './CurveEditor';
import AssetSlot from './AssetSlot';
import Icon from './Icon';
import ValueSlots from './ValueSlots';
import RigInputEditor from './RigInputEditor';
import {EffectSetField,EffectOutput} from './EffectFields';
import {effectOutputTemplate} from './effectSets.mjs';
const labels:Record<string,string>={AnchorOffsetX:'锚点偏移 X',AnchorOffsetY:'锚点偏移 Y',AnchorOffsetZ:'锚点偏移 Z',RotationPitch:'俯仰角',RotationYaw:'水平角',RotationRoll:'翻滚角',Distance:'距离',PerformanceType:'表现类型',DefaultValueAsset:'默认解除聚焦目标',Focus:'聚焦输入',Unfocus:'解除聚焦输入',Domain:'定义域',Range:'增量值域',Mode:'遮挡模式',FallbackExitMargin:'退出半透明余量',ValueAssets:'目标值资产',Value:'目标值',ValueType:'值类型',bEnabled:'启用',Pipelines:'管线资产',RangeAsset:'参考范围',Object:'上下文对象',Interface:'接口名称',Params:'有序参数',bMemberFunction:'成员函数',Transitions:'过渡生命周期',SensitivityAssets:'灵敏度资产',Processors:'处理器',Ranges:'范围约束',Channels:'通道',Sources:'输入源',Assets:'资产挂载',Weight:'贡献权重',Priority:'优先级',ResponseCurve:'响应曲线',LowerCurve:'下边缘曲线',UpperCurve:'上边缘曲线',Curve:'曲线',FreeZone:'自由区',DeadZone:'死区',SensitivityRange:'灵敏度倍率',SpeedRange:'速度范围',Min:'最小值',Max:'最大值',Duration:'时长（秒）',Reference:'参考系',Sample:'采样方式',Phase:'阶段',Input:'输入',Effects:'效果',Smooth:'平滑',Occlusion:'遮挡',Render:'渲染目标',Dist:'距离',FOV:'视场角',Yaw:'水平角',Pitch:'俯仰角',Roll:'翻滚角',AnchorLocOffset:'锚点偏移',AnchorLoc:'锚点位置',CameraRot:'相机旋转',MaxLag:'最大滞后',Description:'描述',Name:'名称',Id:'业务 ID',SchemaVersion:'协议版本',ParentType:'曲线父类型',Points:'样条节点',Tangent:'切线 dy/dx',ProbeRadius:'探测半径',MaterialSlot:'材质槽',Opacity:'透明度',FadeHoldDuration:'透明保持时长',OutputRange:'输出范围',InputRange:'输入范围',Outputs:'输出参数',Source:'数据来源',Defaults:'默认状态'};
const hints:Record<string,string>={Source:'对象使用预声明的直接槽位，例如 Viewpoint、CurrentTarget；接口填写已注册的方法名，运行时对象需提供对应实现。','Source.Params':'按顺序传入参数；支持数字、字符串和布尔值。成员调用会自动传入 self。'};
function expectedType(key:string){if(key==='Focus'||key==='Unfocus')return 'TransitionInput';if(key==='DefaultValueAsset')return 'Value';if(/Curve$/.test(key))return 'Curve';if(key==='RangeAsset')return 'Range';return null;}
function Scalar({value,onChange,numeric=false,readOnly=false,label}:any){
  const [draft,setDraft]=useState(String(value??''));useEffect(()=>setDraft(String(value??'')),[value]);
  const commit=()=>{if(numeric&&(!draft.trim()||!Number.isFinite(Number(draft))))setDraft(String(value));};
  return <input aria-label={label} readOnly={readOnly} type={numeric?'number':'text'} step="any" value={draft} onChange={e=>{const text=e.target.value;setDraft(text);if(readOnly)return;if(numeric){const n=Number(text);if(text.trim()&&Number.isFinite(n))onChange(n);}else onChange(text);}} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setDraft(String(value));e.currentTarget.blur();}}}/>;
}
export default function Fields({inputCatalog,value,onChange,assets,onNavigate,path='',depth=0,parts=[],onField,onTransform,assetType,effectDomain}:any){
  const [outputName,setOutputName]=useState('');
  if(value===null||typeof value!=='object')return <span>{t("请在源码中编辑此值")}</span>;
  const array=Array.isArray(value);
  const emit=(v:any)=>onField?onField(parts,v,value):onChange(v);
  const update=(key:string,v:any)=>{if(onField){onField([...parts,key],v,value[key]);return;}const copy=array?[...value]:{...value};copy[key]=v;onChange(copy);};
  function addItem(){
    if(path==='Points'&&value.length>=2){const a=value[value.length-2],b=value[value.length-1];const x=(a.X+b.X)/2;const data={ParentType:'CubicHermiteSpline',Points:value};const h=Math.min(.00001,(b.X-a.X)/100);const point={X:x,Y:curveY(data,x),Tangent:(curveY(data,x+h)-curveY(data,x-h))/(2*h)};emit([...value.slice(0,-1),point,b]);return;}
    let item:any=value.length?structuredClone(value[value.length-1]):null;
    if(!item && /Flow|Disabled/.test(path))item='';
    if(item!==null)emit([...value,item]);
  }
  if(assetType==='Rig'&&path==='Processors.Input')return <RigInputEditor value={value} assets={assets} onNavigate={onNavigate} onField={onField} onTransform={onTransform}/>;
  if(assetType==='Sensitivity'&&!path)return <SensitivityTable value={value} onField={onField} assets={assets} onNavigate={onNavigate}/>;
  if(assetType==='Input'&&!path&&value.IMCName!==undefined)return <UserInputTable value={value} onField={onField} inputCatalog={inputCatalog} assets={assets} onNavigate={onNavigate}/>;
  if(assetType==='Effect'&&parts.length===2&&parts[0]==='Outputs')return <EffectOutput value={value} onChange={emit} onRange={(v:any)=>update('Range',v)} domain={effectDomain} path={path} assets={assets} onNavigate={onNavigate}/>;
  if(array&&mountType(path))return <MountSlots value={value} onChange={emit} assets={assets} onNavigate={onNavigate} path={path} title={t(labels[path.split('.').at(-1)]||path)} type={mountType(path)}/>;
  if(path==='Source.Params'&&array)return <CallParams value={value} onChange={emit}/>;
  if(path==='ValueAssets'&&array)return <ValueSlots value={value} onChange={emit} assets={assets} onNavigate={onNavigate}/>;
  return <div className={'fields depth-'+depth}>{Object.entries(value).sort(([a],[b])=>assetType==='Effect'&&!path?(['Name','Description','Source','Domain','Outputs'].indexOf(a)-['Name','Description','Source','Domain','Outputs'].indexOf(b)):0).map(([key,v])=>{
    if(key==='SchemaVersion'||(!path&&(key==='Description'||(['Range','Smooth','Value'].includes(assetType)&&key==='Name'))))return null;
    const at=path?path+'.'+key:key;const label=t(at==='Processors.Input.Assets'?'输入资产':labels[key]||key);
    if(assetType==='Value'&&at==='Channels'&&v&&typeof v==='object'&&!Array.isArray(v))return <ValueTable key={key} value={v} onTransform={onTransform} onField={onField} assets={assets} onNavigate={onNavigate}/>;
    if(assetType==='Smooth'&&at==='Channels'&&v&&typeof v==='object'&&!Array.isArray(v))return <SmoothTable key={key} value={v} onField={onField} assets={assets} onNavigate={onNavigate}/>;
    if(assetType==='Range'&&at==='Channels'&&v&&typeof v==='object'&&!Array.isArray(v))return <RangeTable key={key} value={v} onField={onField}/>;
    if(assetType==='Effect'&&at==='Domain')return <EffectSetField key={key} value={v} path={at} onChange={(n:any)=>update(key,n)}/>;
    if(assetType==='Occlusion'&&at==='Mode')return <div className="field" key={key}><label htmlFor="occlusion-mode">{label}</label><div className="field-control"><select id="occlusion-mode" aria-label="Mode" value={String(v)} onChange={e=>update(key,e.target.value)}>{!['Retract','Fade'].includes(String(v))&&<option value={String(v)}>{String(v)}</option>}<option value="Retract">Retract</option><option value="Fade">Fade</option></select></div></div>;
    if(Array.isArray(v)&&mountType(at))return <MountSlots key={key} value={v} onChange={(n:any)=>update(key,n)} assets={assets} onNavigate={onNavigate} path={at} type={mountType(at)} title={label} open={depth<2}/>;
    if(Array.isArray(v)&&at==='ValueAssets')return <ValueSlots key={key} value={v} onChange={(n:any)=>update(key,n)} assets={assets} onNavigate={onNavigate} title={label} open={depth<2}/>;
    if(v!==null&&typeof v==='object')return <details key={key} open={depth<2} className="field-group"><summary><Icon name="chevron" className="disclosure-icon"/><span>{array?tt`项目 ${Number(key)+1}`:label}</span>{hints[at]&&<HelpTip label={label+' '+t('说明')}>{t(hints[at])}</HelpTip>}<small>{Array.isArray(v)?tt`${v.length} 项`:Object.keys(v).length+t(' 字段')}</small>{(array||path==='Outputs')&&<button title={t("移除此项")} onClick={e=>{e.preventDefault();if(array)emit(value.filter((_:any,i:number)=>i!==Number(key)));else{const next={...value};delete next[key];emit(next);}}}><Icon name="close"/></button>}</summary><Fields inputCatalog={inputCatalog} onTransform={onTransform} value={v} onChange={(n:any)=>update(key,n)} assets={assets} onNavigate={onNavigate} path={at} depth={depth+1} parts={[...parts,key]} onField={onField} assetType={assetType} effectDomain={effectDomain}/></details>;
    const refType=referenceType(v)||expectedType(key);const isRef=!!refType;
    if(isRef&&typeof v==='string')return <AssetSlot key={key} value={v} type={refType} assets={assets} label={at} onNavigate={onNavigate} onChange={(id:string)=>update(key,id)}/>;
    return <div className="field" key={key} title={at}><label><span>{label}</span></label><div className="field-control">{typeof v==='boolean'?<button aria-label={at} className={'switch '+(v?'on':'')} role="switch" aria-checked={v} onClick={()=>update(key,!v)}><i/></button>:<Scalar value={v} numeric={typeof v==='number'} readOnly={key==='SchemaVersion'} label={at} onChange={(n:any)=>update(key,n)}/>}</div></div>;
  })}{path==='Outputs'&&assetType==='Effect'&&<div className="output-add"><input aria-label={t("新增输出参数")} placeholder={t("参数名，例如 FOV 或 AnchorLocOffset.X")} value={outputName} onChange={e=>setOutputName(e.target.value)}/><button disabled={!outputName.trim()||Object.hasOwn(value,outputName.trim())||['__proto__','constructor','prototype'].includes(outputName.trim())} onClick={()=>{const name=outputName.trim();emit({...value,[name]:effectOutputTemplate(effectDomain,assets)});setOutputName('');}}>{t("添加输出")}</button></div>}{array&&<button className="add-item" onClick={addItem} disabled={!value.length&&!/(Assets|SensitivityAssets|Sources|Flow|Disabled)$/.test(path)}><Icon name="plus"/>{t("添加项目")}</button>}</div>;
}
