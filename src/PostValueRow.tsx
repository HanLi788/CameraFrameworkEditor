import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import NumberBox from './NumberBox';
import {parseNumber} from './numericText.mjs';
import {postValueIssue,sliderBounds} from './postNumbers.mjs';
import {t} from './i18n';

const navigationKeys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'];
export default function PostValueRow({channel,label,value,written,onValue,onWrite}:any){
 const initial=String(written?value:channel.default),name='Outputs.'+channel.name;
 const [draft,setDraft]=useState(initial),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const row=useRef<HTMLTableRowElement>(null),latest=useRef(initial),accepted=useRef({text:initial,value}),pending=useRef<Promise<any>|null>(null),gesture=useRef<any>(null),pointer=useRef<number|null>(null);
 const update=(text:string)=>{latest.current=text;setDraft(text);setError('');};
 useEffect(()=>{accepted.current={text:initial,value};latest.current=initial;setDraft(initial);setError('');gesture.current=null;pointer.current=null;},[initial,written]);
 const issueText=(issue:any)=>issue?t(issue.message)+(issue.limit===undefined?'':' '+issue.limit):'';
 const read=()=>{const number=parseNumber(latest.current),issue=postValueIssue(channel,number);if(issue)throw Error(issueText(issue));return number;};
 const cancel=()=>{gesture.current=null;pointer.current=null;update(accepted.current.text);};
 const commit=()=>{
  if(pending.current)return pending.current;
  gesture.current=null;pointer.current=null;
  if(!written||latest.current===accepted.current.text)return Promise.resolve();
  let number:number;try{number=read();}catch(reason){const message=(reason as Error).message;setError(message);return Promise.reject(Error(name+': '+message));}
  const base=accepted.current.value;
  setBusy(true);const job=Promise.resolve().then(()=>onValue(number,base)).then(result=>{if(result===undefined)throw Error(t('数值修改未提交，请重试'));accepted.current={text:String(number),value:number};update(String(number));}).catch(reason=>{setError(reason.message);throw reason;}).finally(()=>{pending.current=null;setBusy(false);});pending.current=job;return job;
 };
 useLayoutEffect(()=>{const element=row.current;if(!element)return;const handler=(event:Event)=>(event as CustomEvent<Promise<any>[]>).detail.push(commit());element.addEventListener('commit-range',handler);return()=>element.removeEventListener('commit-range',handler);});
 let number=Number(draft),problem=error;try{number=read();}catch(reason){problem=problem||(reason as Error).message;number=Number(initial);}
 const bounds=gesture.current||sliderBounds(channel,number),disabled=!written||busy;
 const finish=()=>{pointer.current=null;void commit().catch(()=>{});};
 return <tr ref={row} data-range-interval data-post-channel={channel.name} data-written={written} className={written?'':'range-disabled'} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))void commit().catch(()=>{});}} onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancel();}else if(event.key==='Enter'){event.preventDefault();void commit().catch(()=>{});}}}>
  <th scope="row" title={label+' · '+channel.name}>{label}</th>
  <td><input className="post-slider" type="range" aria-label={name+'.Adjust'} min={bounds.min} max={bounds.max} step="any" value={Math.min(bounds.max,Math.max(bounds.min,number))} disabled={disabled||bounds.max<=bounds.min}
   onChange={event=>update(String(Number(Number(event.target.value).toPrecision(8))))}
   onPointerDown={event=>{gesture.current=sliderBounds(channel,number);pointer.current=event.pointerId;event.currentTarget.setPointerCapture(event.pointerId);}}
   onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={()=>{if(pointer.current!==null)finish();}}
   onKeyDown={event=>{if(navigationKeys.includes(event.key)&&!gesture.current)gesture.current=sliderBounds(channel,number);}} onKeyUp={event=>{if(navigationKeys.includes(event.key))finish();}}/></td>
  <td><NumberBox aria-label={name} aria-invalid={!!problem} disabled={disabled} value={draft} onValue={update}/>{problem&&<small className="range-error" role="alert">{problem}</small>}</td>
  <td><input type="checkbox" aria-label={name+'.Write'} checked={written} disabled={busy} onChange={event=>onWrite(event.target.checked)}/></td>
 </tr>;
}
