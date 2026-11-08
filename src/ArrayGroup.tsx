import {t,tt} from './i18n';
import type {ReactNode} from 'react';
import HelpTip from './HelpTip';
import Icon,{IconButton} from './Icon';

export function orderHint(path:string){
  if(path==='PostProcessingAssets')return t('共享所属效果的来源与定义域；各挂载输出贡献相加，空数组不贡献后处理。');
  if(path==='Pipelines')return t('必须且只能挂载一个管线，决定处理阶段及执行顺序。');
  if(path==='Processors.Occlusion')return t('最多挂载一个遮挡资产；空数组关闭遮挡处理。');
  if(path==='Processors.Input.Assets')return t('逐通道选取最靠前的已启用且活跃的输入；零增量或零权重仍占有通道。Enter、Exit 各最多一份，阶段时长来自对应资产；未挂载的阶段立即完成。');
  if(path==='Processors.Effects')return t('按数组顺序求值，多个效果的输出贡献相加；输入不在定义域内时，该资产当帧不贡献效果。空数组不贡献效果。');
  if(path==='ValueAssets')return t('未传业务 ID 时使用第一槽；传入 ID 时匹配对应目标。退出使用自身第一槽。候选槽不是播放序列，至少保留一槽。');
  return t('每个通道选取最靠前的启用配置；未启用的通道可由后续资产补充，不叠加同一通道的配置。空数组不挂载。');
}

export function OrderHelp({path}:{path:string}){
  return <HelpTip label={t('顺序说明 ')+path}>{orderHint(path)}</HelpTip>;
}

export default function ArrayGroup({title,path,count,canAdd,onAdd,children,open=true}:{title:string;path:string;count:number;canAdd:boolean;onAdd:()=>void;children:ReactNode;open?:boolean}){
  return <details className="field-group mount-group" open={open}><summary><Icon name="chevron" className="disclosure-icon"/><span>{title}</span><OrderHelp path={path}/><small>{count}{' '}{t("项")}</small>
    <IconButton icon="plus" label={t('添加挂载 ')+path} disabled={!canAdd} onClick={e=>{e.preventDefault();e.stopPropagation();e.currentTarget.closest('details')!.open=true;onAdd();}}/>
  </summary>{children}</details>;
}
