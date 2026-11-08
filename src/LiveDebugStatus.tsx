import {t} from './i18n';
const labels:Record<string,string>={ready:'UE 调试就绪 · Ctrl+S',saving:'正在保存到 UE…',waiting:'等待 UE 重装…',reloaded:'UE 相机已更新',error:'UE 调试失败',offline:'UE 调试未连接'};
export default function LiveDebugStatus({state}:any){
 return <span role="status" className={'live-debug-status '+(state?.status||'offline')} data-live-debug={state?.status||'offline'} title={state?.message||t('保持 UE 游戏视口焦点，按左 Ctrl+S 保存全部草稿并重装相机。保存失败时保留原相机。')}>
  {t(labels[state?.status]||labels.offline)}
 </span>;
}
