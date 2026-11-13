import HelpTip from './HelpTip';
import {useEffect,useId,useState} from 'react';
import {t} from './i18n';
import AssetSlot from './AssetSlot';
import {constantEffectSet,parseEffectSet} from './effectSets.mjs';

export function EffectSetField({value,onChange,path,domain,readOnly=false,displayValue}:any) {
  const output=path!=='Domain',id=useId();
  const [draft,setDraft]=useState(value);
  useEffect(()=>setDraft(value),[value]);
  let error='';
  try {
    const set=parseEffectSet(draft,output);
    if(output&&constantEffectSet(domain)&&set.min!==set.max)error='单点定义域必须对应单点值域';
  } catch(e) {error=(e as Error).message;}
  const hint=output?'值域是增量贡献范围，例如 [-20,0] 或 {5}；单点值域可省略曲线。':'支持区间、单点和并集，例如 [0,300] or [600,999) or {500}。域外当帧不贡献，所有片段共享上下界归一化；false / true 按 0 / 1 处理。';
  return <div className="effect-set-field">
    <div className="field"><div className="field-label"><label htmlFor={id}>{t(output?'增量值域':'定义域')}</label><HelpTip label={t(output?'增量值域':'定义域')+' '+t('说明')}>{t(hint)}</HelpTip></div><div className="field-control"><input id={id} aria-label={path} aria-invalid={!!error} aria-describedby={error?id+'-error':undefined} type="text" spellCheck={false} readOnly={readOnly} value={displayValue??(typeof draft==='string'?draft:'')} placeholder={output?'[0,20]':'[0,300] or [600,999) or {500}'} onChange={e=>{setDraft(e.target.value);onChange(e.target.value);}}/></div></div>
    {error&&<p id={id+'-error'} className="field-hint effect-set-error" role="alert">{t(error)}</p>}
  </div>;
}

export function EffectOutput({value,onChange,onRange,domain,path,assets,onNavigate,hideRange=false}:any) {
  const constant=constantEffectSet(value.Range,true);
  const unexpected=Object.keys(value).filter(key=>key!=='Type'&&key!=='Range'&&key!=='Curve');
  const curves=assets.filter((a:any)=>a.type==='Curve');
  const addCurve=()=>{const curve=curves.find((a:any)=>a.path==='Assets/Shared/CurveAssets/Bezier/Linear.curve')||curves[0];if(curve)onChange({...value,Curve:curve.path.replace(/^Assets\//,'')});};
  return <div className="effect-output">
    {unexpected.length>0&&<p className="effect-set-error" role="alert">{t('存在旧版或未知字段，请在源码中修复：')}{unexpected.join(', ')}</p>}
    {!hideRange&&<EffectSetField value={value.Range} domain={domain} path={path+'.Range'} onChange={onRange}/>}
    {typeof value.Curve==='string'?<><AssetSlot compact={hideRange} hoverPreview={hideRange} value={value.Curve} type="Curve" assets={assets} label={path+'.Curve'} onNavigate={onNavigate} onChange={(Curve:string)=>onChange({...value,Curve})}/>{constant&&<button className="effect-remove-curve" onClick={()=>{const next={...value};delete next.Curve;onChange(next);}}>{t('移除常量映射曲线')}</button>}</>:<div className="effect-curve-empty">{(!constant||value.Curve!==undefined)&&<span role="alert">{t(value.Curve!==undefined?'曲线必须是资产路径，请选择曲线或在源码中修复。':'非单点值域必须指定曲线。')}</span>}<button disabled={!curves.length} onClick={addCurve}>{t('添加映射曲线')}</button></div>}
  </div>;
}
