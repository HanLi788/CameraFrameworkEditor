import {useEffect,useLayoutEffect,useId,useRef,useState} from 'react';
import {t} from './i18n';
import {rangeError,parseRangeNumber} from './rangeChannels.mjs';

export default function NumericInput({name,value,onChange,validate=rangeError,single=false}:any){
  const keys=single?['Value']:['Min','Max'];
  const initial=keys.map(key=>String(value[key]));
  const [draft,setDraft]=useState(initial),[error,setError]=useState('');
  const host=useRef<HTMLDivElement>(null),pending=useRef<Promise<any>|null>(null),id=useId();
  useEffect(()=>{setDraft(initial);setError('');},[value.Min,value.Max,value.Value]);
  const commit=()=>{
    if(pending.current)return pending.current;
    if(draft.every((text,i)=>text===initial[i]))return Promise.resolve();
    const numbers=draft.map(parseRangeNumber),problem=validate(name,...numbers);
    if(problem){setError(problem);return Promise.reject(Error(name+': '+t(problem)));}
    const job=Promise.resolve().then(()=>onChange({...value,...Object.fromEntries(keys.map((key,i)=>[key,numbers[i]]))})).then(result=>{
      if(result===undefined)throw Error(t('数值修改未提交，请重试'));
      setDraft(numbers.map(String));setError('');
    }).catch(e=>{setError(e.message);throw e;}).finally(()=>{pending.current=null;});
    pending.current=job;return job;
  };
  useLayoutEffect(()=>{const el=host.current;if(!el)return;const handler=(e:Event)=>(e as CustomEvent<Promise<any>[]>).detail.push(commit());el.addEventListener('commit-range',handler);return()=>el.removeEventListener('commit-range',handler);});
  const shownError=error||validate(name,...keys.map(key=>value[key]));
  return <div className="range-cell"><div ref={host} data-range-interval className={'range-interval '+(single?'numeric-single ':'')+(shownError?'invalid':'')} role={single?undefined:'group'} aria-label={single?undefined:name+' '+t('范围')}
    onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))void commit().catch(()=>{});}}
    onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void commit().catch(()=>{});}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setDraft(initial);setError('');}}}>
    {!single&&<span aria-hidden="true">[</span>}{draft.map((v,i)=><span className="range-bound" key={i}><input type="text" inputMode="decimal" spellCheck={false} aria-label={single?name:name+'.'+keys[i]} aria-invalid={!!shownError} aria-describedby={shownError?id:undefined} value={v} style={{width:Math.max(3,Math.min(18,v.length+1))+'ch'}} onChange={e=>{const next=[...draft];next[i]=e.target.value;setDraft(next);setError('');}}/>{!single&&i===0&&<span aria-hidden="true">, </span>}</span>)}{!single&&<span aria-hidden="true">]</span>}
  </div>{shownError&&<small id={id} className="range-error" role="alert">{t(shownError)}</small>}</div>;
}
