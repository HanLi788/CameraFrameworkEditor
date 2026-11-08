import {useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import AssetDocument from './AssetDocument';
import Icon,{IconButton,assetIcons} from './Icon';
import SharedUsage from './SharedUsage';
import {filename} from './types';
import {t} from './i18n';

export default function DetailDialog({effectCatalog,inputCatalog,meta,session,assets,owners,siblings,onSibling,open,onOwner,onClose,onBack,save,send,report,disabled,overlays}:any){
 const dialog=useRef<HTMLDialogElement>(null),close=useRef<HTMLButtonElement>(null);
 const [toolsTarget,setToolsTarget]=useState<HTMLDivElement|null>(null);
 const doc=session.docs.find((d:any)=>d.path===meta.file),asset=assets.find((a:any)=>a.path===meta.file);
 useLayoutEffect(()=>{const el=dialog.current;if(!el)return;if(meta.detailOpen&&!el.open){el.showModal();close.current?.focus({preventScroll:true});}else if(!meta.detailOpen&&el.open)el.close();},[meta.detailOpen]);
 useLayoutEffect(()=>{if(meta.detailOpen&&dialog.current&&!dialog.current.contains(document.activeElement))close.current?.focus({preventScroll:true});},[meta.file]);
 return createPortal(<dialog ref={dialog} className="asset-detail-dialog" aria-label={t('资产详情')} aria-modal="true" onCancel={e=>{e.preventDefault();if(!dialog.current?.querySelector('.modal-overlay,.mount-menu'))onClose();}} onKeyDown={e=>{if(e.key==='Escape'&&dialog.current?.querySelector('.modal-overlay,.mount-menu'))e.preventDefault();}}>
  <header className="detail-dialog-heading"><Icon name={assetIcons[asset?.type]||'file'} size={20} className={asset?'type-'+asset.type:''}/><div className="detail-dialog-title"><strong title={meta.file}>{filename(meta.file)}</strong><small title={meta.file}>{meta.file}</small></div>{doc?.dirty&&<span className="detail-dirty">{t('未保存')}</span>}<SharedUsage path={meta.file||''} owners={owners.get((meta.file||'').toLowerCase())} onOwner={onOwner}/><button className="detail-close" ref={close} aria-label={t('关闭详情')} title={t('关闭详情')} onClick={onClose}><Icon name="close" size={20}/></button></header>
  <div className="detail-dialog-tools"><IconButton icon="undo" label={t('返回上一个资产')} disabled={!meta.canGoBack||disabled} onClick={onBack}/>{siblings.length>1&&<label className="detail-siblings">{t('同级资产')}<select aria-label={t('同级资产')} value={siblings.find((n:any)=>n.selected)?.id||''} onChange={e=>onSibling(siblings.find((n:any)=>n.id===e.target.value))}>{siblings.map((n:any)=><option key={n.id} value={n.id}>{filename(n.path)}{n.edge?' · '+n.edge:''}</option>)}</select></label>}<div className="spacer"/><div className="detail-document-tools" ref={setToolsTarget}/><button disabled={disabled||!doc?.dirty} onClick={()=>save(false)}><Icon name="save"/>{t('保存')}</button><button disabled={disabled||!session.docs.some((d:any)=>d.dirty)} onClick={()=>save(true)}><Icon name="saveAll"/>{t('全部保存')}</button><IconButton icon="undo" label={t('撤销')} disabled={disabled||!doc?.canUndo} onClick={()=>send(window.cameraEditor.history(meta.file,false))}/><IconButton icon="redo" label={t('重做')} disabled={disabled||!doc?.canRedo} onClick={()=>send(window.cameraEditor.history(meta.file,true))}/>{doc?.dirty&&<button onClick={()=>send(window.cameraEditor.discard(meta.file))}>{t('还原草稿')}</button>}</div>
  <div className="detail-dialog-content">{meta.tabs.map((tab:any)=><AssetDocument effectCatalog={effectCatalog} inputCatalog={inputCatalog} key={tab.path} tab={tab} toolsTarget={toolsTarget} active={meta.file===tab.path} doc={session.docs.find((d:any)=>d.path===tab.path)} assets={assets} open={open} report={report}/>)}</div>
  {overlays}
 </dialog>,document.body);
}
