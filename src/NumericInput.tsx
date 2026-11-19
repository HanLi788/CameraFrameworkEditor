import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {t} from './i18n';
import {rangeError,parseRangeNumber} from './rangeChannels.mjs';
import NumberBox from './NumberBox';
export default function NumericInput({name,value,onChange,validate=rangeError,single=false}:any){
 const keys=single?['Value']:['Min','Max'],initial=keys.map(key=>String(value[key]));
 const [draft,setDraft]=useState(initial),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const host=useRef<HTMLDivElement>(null),pending=useRef<Promise<any>|null>(null);
 useEffect(()=>{setDraft(initial);setError('');},[value.Min,value.Max,value.Value]);
 const commit=()=>{
  if(pending.current)return pending.current;
  const numbers=draft.map(parseRangeNumber),problem=validate(name,...numbers);
  if(problem){setError(problem);return Promise.reject(Error(name+': '+t(problem)));}
  if(draft.every((text,i)=>text===initial[i]))return Promise.resolve();
  setBusy(true);
  const job=Promise.resolve().then(()=>onChange({...value,...Object.fromEntries(keys.map((key,i)=>[key,numbers[i]]))})).then(result=>{if(result===undefined)throw Error(t('数值修改未提交，请重试'));setDraft(numbers.map(String));setError('');}).catch(reason=>{setError(reason.message);throw reason;}).finally(()=>{pending.current=null;setBusy(false);});pending.current=job;return job;
 };
 useLayoutEffect(()=>{const node=host.current;if(!node)return;const handler=(event:Event)=>(event as CustomEvent<Promise<any>[]>).detail.push(commit());node.addEventListener('commit-range',handler);return()=>node.removeEventListener('commit-range',handler);});
 const problem=error||validate(name,...keys.map(key=>value[key]));
 return <div ref={host} className={'adaptive-field numeric-input '+(single?'number-single':'number-range')} data-range-interval onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))void commit().catch(()=>{});}} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();void commit().catch(()=>{});}if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setDraft(initial);setError('');}}}>
  <div className={'number-fields '+(!single?'number-pair':'')}>{draft.map((text,i)=><label key={i}>{!single&&<span>{keys[i]}</span>}<NumberBox aria-label={single?name:name+'.'+keys[i]} aria-invalid={!!problem} disabled={busy} step={name==='Duration'?0.01:1} value={text} onValue={(next:string)=>{setDraft(current=>current.map((old,j)=>j===i?next:old));setError('');}}/></label>)}</div>
  {problem&&<small role="alert" className="range-error">{t(problem)}</small>}
 </div>;
}
