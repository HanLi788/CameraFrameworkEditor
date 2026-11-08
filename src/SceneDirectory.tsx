import {t,useLanguage} from './i18n';
import Icon from './Icon';
import {postGroupIcon,postGroupLabel} from './postProcessingLabels.mjs';
export default function SceneDirectory({catalog,group,onSelect}:any){
 const language=useLanguage(),groups=[...new Set<string>(catalog.map((c:any)=>c.group))];
 return <nav className="scene-directory" aria-label={t('后处理分组')}><header><Icon name="post-palette"/>{t('后处理分组')}</header>
 <div role="tree" aria-label={t('后处理分组')}>{groups.map(name=><button key={name} role="treeitem" aria-selected={name===group} className={'scene-tree-group '+(name===group?'selected':'')} onClick={()=>onSelect(name)}><Icon name={postGroupIcon(name)}/><span>{postGroupLabel(name,language)}</span></button>)}</div>
 </nav>;
}
