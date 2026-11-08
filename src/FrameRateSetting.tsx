import HelpTip from './HelpTip';
import {t} from './i18n';
export default function FrameRateSetting({value,onChange}:{value:number;onChange:(value:number)=>void}){
 return <label><span className="field-label">{t('帧率上限')}<HelpTip label={t('帧率说明')}>{t('画面与 Lua 逻辑共同以 30、60、90、120 帧为目标。直接显示最新逻辑结果，实际频率和落后时间显示在视口右下角；实际表现取决于屏幕刷新率和性能。')}</HelpTip></span><select aria-label={t('帧率上限')} value={value} onChange={e=>onChange(Number(e.target.value))}>
  {[30,60,90,120].map(fps=><option key={fps} value={fps}>{fps} FPS</option>)}
 </select></label>;
}
