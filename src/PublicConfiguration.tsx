import {t} from './i18n';
import Icon from './Icon';
import {commonRigSections} from './pipelineViewModel.mjs';
export default function PublicConfiguration({rig,stage,onSelect}:any){return <section className="sidebar-control" aria-label={t('公共配置')} data-sidebar-control="common"><h3>{t('公共配置')}</h3><div className="common-choices">{commonRigSections.map(item=><button key={item.key} data-rig-section={item.key} className={'public-config-button '+(stage===item.key?'active':'')} disabled={!rig} aria-pressed={stage===item.key} onClick={()=>onSelect(item.key)}><Icon name={item.icon}/>{t(item.label)}</button>)}</div></section>;}
