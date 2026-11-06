import {t,tt} from './i18n';
import {useId,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import Icon,{IconButton} from './Icon';

export function orderHint(path:string){
  if(path==='Pipelines')return t('必须且只能挂载一个管线，决定处理阶段及执行顺序。');
  if(path==='Processors.Occlusion')return t('最多挂载一个遮挡资产；空数组关闭遮挡处理。');
  if(path==='Processors.Input.Assets')return t('逐通道选取最靠前的已启用且活跃的输入；零增量或零权重仍占有通道。Enter、Exit 各最多一份，阶段时长来自对应资产；未挂载的阶段立即完成。');
  if(path==='Processors.Effects')return t('按数组顺序求值，多个效果的输出贡献相加；整体权重在各效果资产内设置。空数组不贡献效果。');
  if(path==='ValueAssets')return t('未传业务 ID 时使用第一槽；传入 ID 时匹配对应目标。退出使用自身第一槽。候选槽不是播放序列，至少保留一槽。');
  return t('每个通道选取最靠前的启用配置；未启用的通道可由后续资产补充，不叠加同一通道的配置。空数组不挂载。');
}

export function OrderHelp({path}:{path:string}){
  const [position,setPosition]=useState<{left:number;top:number}|null>(null),id=useId();
  const show=(el:HTMLElement)=>{const box=el.getBoundingClientRect();setPosition({left:Math.max(8,Math.min(box.left,innerWidth-328)),top:box.bottom+8});};
  return <><button type="button" className="order-help" aria-label={t('顺序说明 ')+path} aria-describedby={position?id:undefined}
    onMouseEnter={e=>show(e.currentTarget)} onMouseLeave={()=>setPosition(null)} onFocus={e=>show(e.currentTarget)} onBlur={()=>setPosition(null)}
    onClick={e=>{e.preventDefault();e.stopPropagation();show(e.currentTarget);}} onKeyDown={e=>{if(e.key==='Escape'){setPosition(null);e.stopPropagation();}}}><Icon name="help" size={14}/></button>
    {position&&createPortal(<div id={id} role="tooltip" className="order-tooltip" style={position}>{orderHint(path)}</div>,document.body)}</>;
}

export default function ArrayGroup({title,path,count,canAdd,onAdd,children,open=true}:{title:string;path:string;count:number;canAdd:boolean;onAdd:()=>void;children:ReactNode;open?:boolean}){
  return <details className="field-group mount-group" open={open}><summary><Icon name="chevron" className="disclosure-icon"/><span>{title}</span><OrderHelp path={path}/><small>{count}{' '}{t("项")}</small>
    <IconButton icon="plus" label={t('添加挂载 ')+path} disabled={!canAdd} onClick={e=>{e.preventDefault();e.stopPropagation();e.currentTarget.closest('details')!.open=true;onAdd();}}/>
  </summary>{children}</details>;
}
