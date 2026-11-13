import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {t} from './i18n';
// Text metadata participates in the same commit barrier as numeric drafts.
export default function MetadataInput({name,value,onChange,validate}:any){
 const initial=typeof value==='string'?value:'';
 const [draft,setDraft]=useState(initial),[error,setError]=useState('');
 const host=useRef<HTMLDivElement>(null),pending=useRef<Promise<any>|null>(null);
 useEffect(()=>{setDraft(initial);setError('');},[initial]);
 const commit=()=>{
  if(pending.current)return pending.current;
  if(draft===initial)return Promise.resolve();
  const problem=validate(draft);if(problem){setError(problem);return Promise.reject(Error(name+': '+t(problem)));}
  const job=Promise.resolve().then(()=>onChange(draft)).then(result=>{if(result===undefined)throw Error(t('修改未提交，请重试'));setError('');}).catch(e=>{setError(e.message);throw e;}).finally(()=>{pending.current=null;});pending.current=job;return job;
 };
 useLayoutEffect(()=>{const el=host.current;if(!el)return;const handler=(e:Event)=>(e as CustomEvent<Promise<any>[]>).detail.push(commit());el.addEventListener('commit-range',handler);return()=>el.removeEventListener('commit-range',handler);});
 const problem=error||validate(initial);
 return <div className="metadata-input" ref={host} data-range-interval onBlur={()=>void commit().catch(()=>{})}><input type="text" spellCheck={false} aria-label={name} value={draft} aria-invalid={!!problem} onChange={e=>{setDraft(e.target.value);setError('');}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void commit().catch(()=>{});}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setDraft(initial);setError('');}}}/>{problem&&<small role="alert" className="range-error">{t(problem)}</small>}</div>;
}
