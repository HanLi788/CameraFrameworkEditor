import {useState} from 'react';
import {createPortal} from 'react-dom';
import {assetFile,assetReference} from './assetPaths.mjs';
import {filename} from './types';
import {t} from './i18n';
import AssetPicker from './AssetPicker';
import CurveHoverPreview from './CurveHoverPreview';
import Icon,{assetIcons} from './Icon';

export default function AssetSlot({value,type,assets,onChange,onNavigate,label,choices:providedChoices,compact=false,caption,hoverPreview=false,onRemove,canRemove=true}:any){
 const file=assetFile(value,assets),asset=assets.find((a:any)=>a.path===file);
 const [picker,setPicker]=useState(false),[menu,setMenu]=useState<any>(null),[references,setReferences]=useState(false),[error,setError]=useState(''),[anchor,setAnchor]=useState<HTMLElement|null>(null);
 const choices=providedChoices||assets.filter((a:any)=>!type||type==='Asset'||a.type===type);
 const size=/^(Channels|Outputs)\./.test(label)?'cell':/^Rows\./.test(label)?'source':'mount';
 const choose=(path:string)=>{try{const next=choices.find((a:any)=>a.path===path);if(!next||type&&type!=='Asset'&&next.type!==type)throw Error(t('资产类型不匹配'));if(!onChange)throw Error(t('此挂载不可修改'));onChange(assetReference(path,assets));setPicker(false);setError('');}catch(e){setError((e as Error).message);}};
 const openMenu=(element:HTMLElement)=>{const box=element.getBoundingClientRect();setMenu({left:Math.max(8,Math.min(innerWidth-190,box.right-180)),top:Math.max(8,Math.min(innerHeight-220,box.bottom+4))});};
 const users=assets.filter((a:any)=>a.refs?.some((ref:any)=>ref.path===file));
 return <div className="asset-field" data-field={label}>
  {!compact&&caption&&<span className="asset-field-label">{t(caption)}</span>}
  <div className="asset-card" data-size={size} data-asset-card onDragOver={e=>{if(onChange&&e.dataTransfer.types.includes('application/x-camera-asset')){e.preventDefault();e.dataTransfer.dropEffect='link';}}} onDrop={e=>{e.preventDefault();choose(e.dataTransfer.getData('application/x-camera-asset'));}}>
   <button className={'asset-card-icon type-'+(asset?.type||type)} aria-label={t('打开 ')+label+' · '+t('图标')} disabled={!asset&&!onChange} onClick={()=>asset?onNavigate(file):setPicker(true)}><Icon name={assetIcons[asset?.type||type]||'file'} size={18}/></button>
   <button className="asset-card-name" aria-label={t('打开挂载资产 ')+label} title={filename(file)||t('未挂载资产')} disabled={!asset&&!onChange} onClick={()=>asset?onNavigate(file):setPicker(true)} onMouseEnter={e=>{if(hoverPreview&&asset?.type==='Curve')setAnchor(e.currentTarget);}} onMouseLeave={()=>setAnchor(null)} onFocus={e=>{if(hoverPreview&&asset?.type==='Curve')setAnchor(e.currentTarget);}} onBlur={()=>setAnchor(null)}>{filename(file)||t('未挂载资产')}</button>
   <div className="asset-card-actions">{onChange&&size!=='cell'&&<button aria-label={t('替换 ')+label} title={t('替换')} onClick={()=>setPicker(true)}><Icon name="replace" size={14}/></button>}<button aria-label={t('更多操作 ')+label} title={t('更多操作')} aria-haspopup="menu" aria-expanded={!!menu} onClick={e=>openMenu(e.currentTarget)}><Icon name="more" size={14}/></button></div>
  </div>
  {error&&<small role="alert" className="range-error">{error}</small>}
  {picker&&<AssetPicker type={type} choices={choices} value={file} onChoose={choose} onClose={()=>setPicker(false)}/>}
  {menu&&createPortal(<div className="menu-dismiss" onPointerDown={()=>setMenu(null)} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();setMenu(null);}}}><div className="context-menu asset-card-menu" role="menu" style={menu} onPointerDown={e=>e.stopPropagation()}>
   {onChange&&<button role="menuitem" onClick={()=>{setMenu(null);setPicker(true);}}>{t('替换')}</button>}
   <button role="menuitem" disabled={!asset} onClick={()=>{setMenu(null);onNavigate(file);}}>{t('打开资产')}</button>
   <button role="menuitem" disabled={!asset} onClick={()=>{setMenu(null);window.cameraEditor.reveal(file).catch((e:any)=>setError(e.message));}}>{t('在目录中定位')}</button>
   <button role="menuitem" disabled={!asset} onClick={()=>{setMenu(null);setReferences(true);}}>{t('查看引用')}</button>
   {onRemove&&<button role="menuitem" aria-label={t('移除 ')+label} disabled={!canRemove} onClick={()=>{setMenu(null);onRemove();}}>{t('移除挂载')}</button>}
  </div></div>,document.body)}
  {references&&createPortal(<div className="modal-overlay"><div className="modal" role="dialog" aria-label={t('资产引用')}><h2>{t('资产引用')}</h2>{users.map((a:any)=><button key={a.path} className="reference-file" onClick={()=>{setReferences(false);onNavigate(a.path);}}>{filename(a.path)}</button>)}{!users.length&&<span>{t('没有引用方')}</span>}<div className="modal-actions"><button onClick={()=>setReferences(false)}>{t('关闭')}</button></div></div></div>,document.body)}
  {anchor&&asset?.data&&<CurveHoverPreview anchor={anchor} data={asset.data} name={filename(file)} id={'curve-'+label}/>}
 </div>;
}
