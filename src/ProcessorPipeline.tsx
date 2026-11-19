import {t} from './i18n';
import {IconButton} from './Icon';
import RigSelector from './RigSelector';
import PublicConfiguration from './PublicConfiguration';
import ProcessorAssets from './ProcessorAssets';
export default function ProcessorPipeline({assets,model,stage,onRig,onStage,onCollapse}:any){return <div className="rig-sidebar"><header className="context-heading"><h2>{t('装置与处理器')}</h2><IconButton icon="expandRight" label={t('收起装置与处理器')} onClick={onCollapse}/></header><RigSelector assets={assets} rig={model.rig} onRig={onRig} onOverview={()=>onStage('')}/><PublicConfiguration rig={model.rig} stage={stage} onSelect={onStage}/><ProcessorAssets model={model} stage={stage} onStage={onStage}/></div>;}
