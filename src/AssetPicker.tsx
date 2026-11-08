import {t,tt} from './i18n';
import {useState} from 'react';
import {createPortal} from 'react-dom';
import {Asset,typeNames,filename} from './types';
import Icon,{IconButton,assetIcons} from './Icon';

export default function AssetPicker({type,choices,value,onChoose,onClose}: {type:string;choices:Asset[];value?:string;onChoose:(path:string)=>void;onClose:()=>void}){
  const [query,setQuery]=useState('');
  const matches=choices.filter(a=>`${a.path} ${a.data?.Name||''}`.toLowerCase().includes(query.toLowerCase()));
  return createPortal(<div className="modal-overlay" onPointerDown={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();}}}>
    <div className="modal asset-picker" role="dialog" aria-label={t('选择')+(typeNames[type]||t('引用资产'))}>
      <h2>{t("选择")}{typeNames[type]||t('引用资产')}</h2>
      <input autoFocus aria-label={t("筛选引用资产")} placeholder={t("名称或路径")} value={query} onChange={e=>setQuery(e.target.value)}/>
      <div className="picker-list">{matches.map(a=><button key={a.path} onClick={()=>onChoose(a.path)}><span className={'type-'+a.type}><Icon name={assetIcons[a.type]} size={26}/></span><div><b>{filename(a.path)}</b><small>{a.path}</small></div>{a.path===value&&<Icon name="check"/>}</button>)}{!matches.length&&<p className="notice">{t("没有可选资产")}</p>}</div>
      <div className="modal-actions"><IconButton icon="close" label={t("取消")} onClick={onClose}>{t("取消")}</IconButton></div>
    </div>
  </div>,document.querySelector('dialog.asset-detail-dialog[open]')||document.body);
}
