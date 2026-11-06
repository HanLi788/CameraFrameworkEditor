import {t,tt} from './i18n';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Asset,filename} from './types';
import CurveEditor from './CurveEditor';
import AssetPicker from './AssetPicker';
import Icon,{IconButton,assetIcons} from './Icon';

export default function AssetSlot({value,type,assets,onChange,onNavigate,label,choices:providedChoices,compact=false,onRemove,canRemove=true}:any){
  const [picker,setPicker]=useState(false),[showRefs,setShowRefs]=useState(false),[error,setError]=useState(''),[menu,setMenu]=useState<any>(null);
  const timer=useRef<any>(null);useEffect(()=>()=>clearTimeout(timer.current),[]);
  useEffect(()=>{if(!menu)return;const close=()=>setMenu(null),key=(e:KeyboardEvent)=>{if(e.key==='Escape')close();};window.addEventListener('pointerdown',close);window.addEventListener('keydown',key);window.addEventListener('resize',close);window.addEventListener('scroll',close,true);return()=>{window.removeEventListener('pointerdown',close);window.removeEventListener('keydown',key);window.removeEventListener('resize',close);window.removeEventListener('scroll',close,true);};},[menu]);
  const asset=assets.find((a:Asset)=>a.path===value),curve=type==='Curve'||asset?.type==='Curve';
  const choices=providedChoices||assets.filter((a:Asset)=>!type||a.type===type);
  const choose=(id:string)=>{const a=assets.find((a:Asset)=>a.path===id);if(!id||!a||type&&a.type!==type||!choices.some((item:Asset)=>item.path===id)){setError(t('资产类型不匹配'));return;}onChange(id);setPicker(false);setError('');};
  const users=assets.filter((a:Asset)=>a.refs.some(r=>r.path===value));
  const transition=asset?.type==='Input'&&asset.data?.Type==='Transition';
  const duration=asset?.data?.Duration;
  const durationText=typeof duration==='number'&&Number.isFinite(duration)&&duration>=0?`${duration} s`:'—';
  const durationHint=t(asset?.data?.Phase==='Enter'?'进入时长，打开资产编辑':asset?.data?.Phase==='Exit'?'退出时长，打开资产编辑':'过渡时长，打开资产编辑');
  const details=[value,asset?.data?.Description,transition&&tt`时长：${durationText}`,asset?.data?.Phase&&tt`阶段：${asset.data.Phase}`,asset?.data?.Weight!==undefined&&tt`资产权重：${asset.data.Weight}`].filter(Boolean).join('\n');
  return <div className={'asset-slot '+(compact?'compact-slot ':'')+(curve?'curve-slot':'')} data-field={label}
    onDragOver={e=>{if(e.dataTransfer.types.includes('application/x-camera-asset')){e.preventDefault();e.dataTransfer.dropEffect='link';}}}
    onDrop={e=>{e.preventDefault();e.stopPropagation();choose(e.dataTransfer.getData('application/x-camera-asset'));}}>
    {!compact&&<div className="slot-heading"><span>{label.split('.').at(-1)}</span></div>}
    <div className="slot-body"><button className={'slot-icon type-'+(type||asset?.type)} aria-label={t('选择 ')+label} title={t("单击选择，双击打开资产编辑器")} onClick={()=>{clearTimeout(timer.current);timer.current=setTimeout(()=>setPicker(true),250);}} onDoubleClick={()=>{clearTimeout(timer.current);if(asset)onNavigate(value);}}><Icon name={assetIcons[type||asset?.type]||'file'} size={compact?22:26}/></button>
      <div className="slot-name" title={details}>{curve?<select aria-label={t('选择曲线 ')+label} value={value} onChange={e=>choose(e.target.value)}>{!choices.some((a:Asset)=>a.path===value)&&<option value={value}>{filename(value)||t('请选择曲线')}</option>}{choices.map((a:Asset)=><option key={a.path} value={a.path}>{filename(a.path)}</option>)}</select>:<b>{filename(value)||t('未挂载资产')}</b>}{transition&&<span className="duration-tag" title={durationHint}>{durationText}</span>}</div>
      <div className="slot-actions"><IconButton icon="replace" label={t('替换 ')+label} onClick={()=>setPicker(true)}/><IconButton icon="open" label={t('打开 ')+label} disabled={!asset} onClick={()=>onNavigate(value)}/><IconButton icon="locate" label={t('定位 ')+label} title={t("在内容浏览器中定位")} disabled={!asset} onClick={()=>window.cameraEditor.reveal(asset.path).catch((e:any)=>setError(e.message))}/><IconButton icon="link" label={t('查看引用 ')+label} title={tt`查看引用（${users.length}）`} disabled={!asset} onClick={()=>setShowRefs(v=>!v)}/>
        {onRemove&&<IconButton icon="more" label={t('更多操作 ')+label} aria-haspopup="menu" aria-expanded={!!menu} onClick={e=>{const b=e.currentTarget.getBoundingClientRect();setMenu({left:Math.max(8,Math.min(innerWidth-180,b.right-168)),top:Math.min(innerHeight-52,b.bottom+4)});}}/>}
      </div>
    </div>
    {error&&<div className="notice">{error}</div>}{showRefs&&<div className="slot-users">{users.length?users.map((a:Asset)=><button key={a.path} title={t('打开 ')+a.path} onClick={()=>onNavigate(a.path)}>{a.path}<Icon name="open"/></button>):<small>{t("没有引用方")}</small>}</div>}
    {curve&&asset?.data&&<div className="inline-curve"><CurveEditor compact readOnly data={asset.data}/><div className="inline-curve-footer"><span><Icon name="lock" size={12}/>{t("只读预览 ·")}{asset.data.ParentType}</span></div></div>}
    {picker&&<AssetPicker type={type} choices={choices} value={value} onChoose={choose} onClose={()=>setPicker(false)}/>}
    {menu&&createPortal(<div className="context-menu mount-menu" role="menu" style={menu} onPointerDown={e=>e.stopPropagation()}><button role="menuitem" aria-label={t('移除 ')+label} disabled={!canRemove} title={canRemove?t('移除挂载'):t('至少保留一个挂载')} onClick={()=>{setMenu(null);onRemove();}}><Icon name="trash"/>{t("移除挂载")}</button></div>,document.body)}
  </div>;
}
