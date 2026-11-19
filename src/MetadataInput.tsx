import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {t} from './i18n';
import FieldDialog from './FieldDialog';
import useFieldOverflow from './useFieldOverflow';
export default function MetadataInput({name,value,onChange,validate=()=>''}:any){
 const initial=typeof value==='string'?value:'';
 const [draft,setDraft]=useState(initial),[error,setError]=useState(''),[expanded,setExpanded]=useState(false),[focused,setFocused]=useState(false);
 const host=useRef<HTMLDivElement>(null),pending=useRef<Promise<any>|null>(null),overflow=useFieldOverflow(host,[initial]);
 useEffect(()=>{setDraft(initial);setError('');},[initial]);
 const commit=()=>{if(pending.current)return pending.current;if(draft===initial)return Promise.resolve();const problem=validate(draft);if(problem){setError(problem);return Promise.reject(Error(name+': '+t(problem)));}const job=Promise.resolve().then(()=>onChange(draft)).then(result=>{if(result===undefined)throw Error(t('修改未提交，请重试'));setError('');}).catch(e=>{setError(e.message);throw e;}).finally(()=>{pending.current=null;});pending.current=job;return job;};
 useLayoutEffect(()=>{const element=host.current;if(!element)return;const handler=(event:Event)=>(event as CustomEvent<Promise<any>[]>).detail.push(commit());element.addEventListener('commit-range',handler);return()=>element.removeEventListener('commit-range',handler);});
 const problem=error||validate(initial),cancel=()=>{setDraft(initial);setError('');setExpanded(false);};
 return <div ref={host} className="adaptive-field metadata-input" data-range-interval onFocusCapture={event=>{if(!expanded&&['INPUT','TEXTAREA'].includes((event.target as HTMLElement).tagName))setFocused(true);}} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node)){setFocused(false);if(!expanded)void commit().catch(()=>{});}}} onKeyDown={event=>{if(event.key==='Enter'&&!expanded){event.preventDefault();void commit().catch(()=>{});}if(event.key==='Escape'&&!expanded){event.preventDefault();event.stopPropagation();cancel();}}}>
  {overflow&&!focused||expanded?<button className="field-details" aria-label={name+' '+t('查看详情')} onClick={()=>{setDraft(initial);setExpanded(true);}}>{t('查看详情')}</button>:<input type="text" aria-label={name} value={draft} aria-invalid={!!problem} onChange={event=>{setDraft(event.target.value);setError('');}}/>}
  {!expanded&&problem&&<small className="range-error" role="alert">{t(problem)}</small>}
  {expanded&&<FieldDialog label={name} error={problem&&t(problem)} onConfirm={()=>void commit().then(()=>setExpanded(false)).catch(()=>{})} onCancel={cancel}><textarea aria-label={name} value={draft} rows={4} onChange={event=>{setDraft(event.target.value);setError('');}}/></FieldDialog>}
 </div>;
}
