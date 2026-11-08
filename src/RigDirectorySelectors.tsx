import {t} from './i18n';
export default function RigDirectorySelectors({selection,onChange,disabled}:any){
 return <nav className="rig-directory-selectors" aria-label={t('装置目录选择')}>
  {(['space','host','device'] as const).map((field,i)=>{
   const labels=['相机空间','宿主','装置'],options=selection[['spaces','hosts','devices'][i]];
   return <label key={field}><span>{t(labels[i])}</span><select aria-label={t(labels[i])} value={selection[field]} disabled={disabled||!options.length} onChange={e=>onChange(field,e.target.value)}><option value="" disabled>{t(options.length?'请选择':'无可用目录')}</option>{options.map((name:string)=><option key={name} value={name}>{name}</option>)}</select></label>;
  })}
 </nav>;
}
