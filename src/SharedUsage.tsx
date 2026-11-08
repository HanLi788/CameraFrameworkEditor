import {useState} from 'react';
import {createPortal} from 'react-dom';
import Icon from './Icon';
import {filename} from './types';
import {t} from './i18n';
export default function SharedUsage({path,owners=[],onOwner}:any){
  const [opened,setOpened]=useState(false);
  if(owners.length<2)return null;
  const description=t('修改此资产会影响以下装置：')+'\n'+owners.join('\n');
  return <><button className="sharing-badge" title={description} aria-label={t('共享引用')+' '+owners.length} onClick={e=>{e.stopPropagation();setOpened(true);}}><Icon name="link" size={13}/><span>{owners.length}</span></button>{opened&&createPortal(<div className="modal-overlay" onClick={()=>setOpened(false)}><div className="modal sharing-dialog" role="dialog" aria-label={t('共享资产影响范围')} onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setOpened(false);}}}><h2>{t('共享资产影响范围')}</h2><strong>{filename(path)}</strong><p>{t('修改此资产会影响以下装置：')}</p><div className="sharing-owners">{owners.map((rig:string)=><button key={rig} onClick={()=>{setOpened(false);onOwner(rig,path);}}><Icon name="camera"/><span><b>{filename(rig)}</b><small>{rig}</small></span><Icon name="open"/></button>)}</div><div className="modal-actions"><button autoFocus onClick={()=>setOpened(false)}>{t('关闭')}</button></div></div></div>,document.querySelector('dialog.asset-detail-dialog[open]')||document.body)}</>;
}
