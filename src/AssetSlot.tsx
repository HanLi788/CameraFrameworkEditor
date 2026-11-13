import {performanceLabel} from './transitionTargets.mjs';
import {assetKey,assetFile} from './assetPaths.mjs';
import CurveHoverPreview from './CurveHoverPreview';
import {curveLabel,curveOptionLabel} from './curveLabels';
import HelpTip from './HelpTip';
import {t,tt} from './i18n';
import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Asset,filename} from './types';
import CurveEditor from './CurveEditor';
import AssetPicker from './AssetPicker';
import Icon,{IconButton,assetIcons} from './Icon';

export default function AssetSlot({value,type,assets,onChange,onNavigate,label,choices:providedChoices,compact=false,hoverPreview=false,onRemove,canRemove=true}:any){
  value=assetFile(value);const emitReference=onChange;onChange=(file:string)=>emitReference(assetKey(file));
  const [picker,setPicker]=useState(false),[showRefs,setShowRefs]=useState(false),[error,setError]=useState(''),[menu,setMenu]=useState<any>(null);
  const [previewAnchor,setPreviewAnchor]=useState<HTMLElement|null>(null),previewId=useId();
  useEffect(()=>{if(!previewAnchor)return;const close=()=>setPreviewAnchor(null);window.addEventListener('scroll',close,true);window.addEventListener('resize',close);return()=>{window.removeEventListener('scroll',close,true);window.removeEventListener('resize',close);};},[previewAnchor]);
  const previewEvents=hoverPreview?{onMouseEnter:(e:any)=>setPreviewAnchor(e.currentTarget),onMouseLeave:()=>setPreviewAnchor(null),onFocus:(e:any)=>setPreviewAnchor(e.currentTarget),onBlur:()=>setPreviewAnchor(null),onPointerDown:()=>setPreviewAnchor(null),onKeyDown:(e:any)=>{if(e.key==='Escape'&&previewAnchor){e.preventDefault();e.stopPropagation();setPreviewAnchor(null);}}}:{};
  useEffect(()=>{if(!menu)return;const close=()=>setMenu(null),key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();close();}};window.addEventListener('pointerdown',close);window.addEventListener('keydown',key);window.addEventListener('resize',close);window.addEventListener('scroll',close,true);return()=>{window.removeEventListener('pointerdown',close);window.removeEventListener('keydown',key);window.removeEventListener('resize',close);window.removeEventListener('scroll',close,true);};},[menu]);
  const asset=assets.find((a:Asset)=>a.path===value),curve=type==='Curve'||asset?.type==='Curve';
  const choices=providedChoices||assets.filter((a:Asset)=>!type||type==='Asset'||a.type===type);
  const choose=(id:string)=>{const a=assets.find((a:Asset)=>a.path===id);if(!id||!a||type&&type!=='Asset'&&a.type!==type||!choices.some((item:Asset)=>item.path===id)){setError(t('资产类型不匹配'));return;}onChange(id);setPicker(false);setError('');};
  const users=assets.filter((a:Asset)=>a.refs.some(r=>r.path===value));
  const transition=asset?.type==='Value',performance=performanceLabel(asset?.data?.PerformanceType);
  const duration=asset?.data?.Duration;
  const durationText=typeof duration==='number'&&Number.isFinite(duration)&&duration>=0?`${duration} s`:'—';
  const durationHint=t('过渡时长，打开资产编辑');
  const details=[value,asset?.data?.Description,transition&&tt`时长：${durationText}`,performance,asset?.data?.Weight!==undefined&&tt`资产权重：${asset.data.Weight}`].filter(Boolean).join('\n');
  return <div className={'asset-slot '+(compact?'compact-slot ':'')+(curve?'curve-slot':'')} data-field={label}
    onDragOver={e=>{if(e.dataTransfer.types.includes('application/x-camera-asset')){e.preventDefault();e.dataTransfer.dropEffect='link';}}}
    onDrop={e=>{e.preventDefault();e.stopPropagation();choose(e.dataTransfer.getData('application/x-camera-asset'));}}>
    {!compact&&<div className="slot-heading"><span>{label.split('.').at(-1)}</span></div>}
    <div className="slot-body"><button {...previewEvents} aria-describedby={hoverPreview&&previewAnchor?previewId:undefined} className={'slot-icon type-'+(type||asset?.type)} aria-label={t('打开 ')+label+' · '+t('图标')} title={t("在标签页中打开资产")} onClick={()=>asset?onNavigate(value):setPicker(true)}><Icon name={assetIcons[type||asset?.type]||'file'} size={compact?22:26}/></button>
      <div {...previewEvents} className="slot-name" title={details}><button className="mount-name" aria-label={t('打开挂载资产 ')+label} onClick={()=>asset?onNavigate(value):setPicker(true)}>{curve?curveLabel(value):filename(value)||t('未挂载资产')}</button>{performance&&<small className="slot-performance">{performance}</small>}{transition&&<span className="duration-tag" title={durationHint}>{durationText}</span>}</div>
      <div className="slot-actions">{curve&&asset?.data&&<HelpTip icon="lock" label={t('曲线只读预览')}>{t("只读预览 ·")}{asset.data.ParentType}</HelpTip>}<IconButton icon="replace" label={t('替换 ')+label} onClick={()=>setPicker(true)}/><IconButton icon="open" label={t('打开 ')+label} disabled={!asset} onClick={()=>onNavigate(value)}/><IconButton icon="locate" label={t('定位 ')+label} title={t("在目录中定位")} disabled={!asset} onClick={()=>window.cameraEditor.reveal(asset.path).catch((e:any)=>setError(e.message))}/><IconButton icon="link" label={t('查看引用 ')+label} title={tt`查看引用（${users.length}）`} disabled={!asset} onClick={()=>setShowRefs(v=>!v)}/>
        {onRemove&&<IconButton icon="more" label={t('更多操作 ')+label} aria-haspopup="menu" aria-expanded={!!menu} onClick={e=>{const b=e.currentTarget.getBoundingClientRect(),bounds=e.currentTarget.closest('dialog')?.getBoundingClientRect();const left=bounds?.left??0,right=bounds?.right??innerWidth,top=bounds?.top??0,bottom=bounds?.bottom??innerHeight;setMenu({left:Math.max(left+8,Math.min(right-176,b.right-168)),top:Math.max(top+8,b.bottom+52<bottom?b.bottom+4:b.top-52)});}}/>}
      </div>
    </div>
    {error&&<div className="notice">{error}</div>}{showRefs&&<div className="slot-users">{users.length?users.map((a:Asset)=><button key={a.path} title={t('打开 ')+a.path} onClick={()=>onNavigate(a.path)}>{a.path}<Icon name="open"/></button>):<small>{t("没有引用方")}</small>}</div>}
    {curve&&asset?.data&&!hoverPreview&&<div className="inline-curve"><CurveEditor compact readOnly data={asset.data}/></div>}
    {hoverPreview&&previewAnchor&&curve&&asset?.data&&<CurveHoverPreview anchor={previewAnchor} data={asset.data} name={filename(value)} id={previewId}/>}
    {picker&&<AssetPicker type={type} choices={choices} value={value} onChoose={choose} onClose={()=>setPicker(false)}/>}
    {menu&&createPortal(<div className="context-menu mount-menu" role="menu" style={menu} onPointerDown={e=>e.stopPropagation()}><button role="menuitem" aria-label={t('移除 ')+label} disabled={!canRemove} title={canRemove?t('移除挂载'):t('至少保留一个挂载')} onClick={()=>{setMenu(null);onRemove();}}><Icon name="trash"/>{t("移除挂载")}</button></div>,document.querySelector('dialog.asset-detail-dialog[open]')||document.body)}
  </div>;
}
