import {useState} from 'react';
import {t} from './i18n';
import Icon,{IconButton} from './Icon';
import {performanceBaseOptions,performanceBaseLabels} from './performanceBases.mjs';
export default function PerformanceBaseSelect({value,assets,catalog,onChange}:any){
 const [error,setError]=useState(''),[refreshing,setRefreshing]=useState(false);
 const options=performanceBaseOptions(catalog?.performanceTypes,assets,value);
 const refresh=async()=>{setRefreshing(true);setError('');try{await window.cameraEditor.snapshot();}catch(e){setError(String(e));}finally{setRefreshing(false);}};
 const label=(option:any)=>{const description=performanceBaseLabels[option.value];return option.registered?(description?t(description)+' ('+option.value+')':option.value):option.value+' · '+t('现有自定义类别');};
 return <div className="performance-base-control"><div><select aria-label="PerformanceType.BaseName" title={String(value??'')} value={typeof value==='string'?value:''} aria-invalid={typeof value!=='string'||!/^PERFORMANCE_[A-Z0-9_]+$/.test(value)} onChange={e=>onChange(e.target.value)}>{typeof value!=='string'&&<option value="" disabled>{String(value??'—')}</option>}{options.map(option=><option key={option.value} value={option.value}>{label(option)}</option>)}</select><IconButton icon="reset" label={t('刷新表现类型')} disabled={refreshing} onClick={refresh}/></div>{(error||catalog?.performanceTypeIssue)&&<small className="range-error" role="status"><Icon name="warning" size={12}/>{t('表现类型列表读取失败：')}{error||catalog.performanceTypeIssue}</small>}</div>;
}
