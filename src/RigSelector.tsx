import {useEffect,useMemo,useState} from 'react';
import {t} from './i18n';
import {rigChoicesBySpace} from './pipelineViewModel.mjs';
import {IconButton} from './Icon';
const labels:any={Action:'动作',Battle:'战斗',Idle:'空闲',Interactive:'交互',Preview:'预览',Roam:'漫游',Unassigned:'未识别空间'};
export default function RigSelector({assets,rig,onRig,onOverview}:any){
 const groups=useMemo(()=>rigChoicesBySpace(assets),[assets]);
 const current=groups.find(group=>group.rigs.some(item=>item.path===rig?.path))?.space||'';
 const [space,setSpace]=useState(current);useEffect(()=>setSpace(current),[current,rig?.path]);
 const rigs=groups.find(group=>group.space===space)?.rigs||[];
 return <section className="sidebar-control" aria-label={t('装置选择')} data-sidebar-control="selector"><h3 className="sidebar-control-heading"><span>{t('装置选择')}</span><IconButton icon="camera" label={t('装置总览')} disabled={!rig} onClick={onOverview}/></h3><label><span>{t('空间')}</span><select aria-label={t('相机空间')} value={space} onChange={e=>setSpace(e.target.value)}><option value="" disabled>{t('选择空间')}</option>{groups.map(group=><option key={group.space} value={group.space}>{t(labels[group.space]||group.space)}</option>)}</select></label><label><span>{t('当前装置')}</span><select aria-label={t('当前装置')} disabled={!space||!rigs.length} value={space===current?rig?.path||'':''} onChange={e=>onRig(e.target.value)}><option value="" disabled>{t('选择装置')}</option>{rigs.map(item=><option key={item.path} value={item.path}>{item.name}</option>)}</select></label></section>;
}
