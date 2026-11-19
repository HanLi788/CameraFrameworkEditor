import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {t} from './i18n';
import {rangeError} from './rangeChannels.mjs';
import {parseNumber,formatRatio,parseRatio,vectorValues} from './numericText.mjs';
import NumberBox from './NumberBox';

// A compound field commits all of its components as one document edit.
function CompoundNumbers({name,values,groups,onChange,parse,validate=()=>'',className=''}:any){
 const signature=JSON.stringify(values),initial=values.map(String);
 const [draft,setDraft]=useState<string[]>(initial),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const host=useRef<HTMLDivElement>(null),pending=useRef<Promise<any>|null>(null);
 useEffect(()=>{setDraft(initial);setError('');},[signature]);
 const commit=()=>{
  if(pending.current)return pending.current;
  if(draft.every((text,i)=>text===initial[i]))return Promise.resolve();
  let next:any;
  try{next=parse(draft);const issue=validate(next);if(issue)throw Error(issue);}
  catch(reason){const message=(reason as Error).message;setError(message);return Promise.reject(Error(name+': '+t(message)));}
  setBusy(true);
  const job=Promise.resolve().then(()=>onChange(next)).then(result=>{if(result===undefined)throw Error(t('数值修改未提交，请重试'));setError('');}).catch(reason=>{setError(reason.message);throw reason;}).finally(()=>{pending.current=null;setBusy(false);});
  pending.current=job;return job;
 };
 useLayoutEffect(()=>{const node=host.current;if(!node)return;const handler=(event:Event)=>(event as CustomEvent<Promise<any>[]>).detail.push(commit());node.addEventListener('commit-range',handler);return()=>node.removeEventListener('commit-range',handler);});
 return <div ref={host} data-range-interval role="group" aria-label={name} className={'compound-numbers '+className} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))void commit().catch(()=>{});}} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();void commit().catch(()=>{});}if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setDraft(initial);setError('');}}}>
  {groups.map((group:any,index:number)=><div key={index} className="compound-number-row">{group.label&&<span className="compound-group-label">{group.label}</span>}{group.fields.map((field:any)=><label key={field.index} className="compound-number">{field.label&&<span>{field.label}</span>}<NumberBox aria-label={name+'.'+field.name} aria-invalid={!!error} disabled={busy} value={draft[field.index]??''} onValue={(text:string)=>{setDraft(current=>current.map((old,i)=>i===field.index?text:old));setError('');}}/>{field.separator&&<span className="compound-separator">{field.separator}</span>}</label>)}</div>)}
  {error&&<small className="range-error" role="alert">{t(error)}</small>}
 </div>;
}
const axes=['X','Y','Z'];
const vectorFields=(offset=0,prefix='')=>axes.map((axis,index)=>({index:index+offset,name:prefix+axis,label:axis}));
export function VectorInput({name,value,onChange,axes:components=axes}:any){
 return <CompoundNumbers name={name} className="inline-vector" values={Array.isArray(value)?value:components.map((axis:string)=>value?.[axis])} groups={[{fields:components.map((axis:string,index:number)=>({index,name:axis,label:axis}))}]} parse={(draft:string[])=>{const numbers=draft.map(parseNumber);return Array.isArray(value)?numbers:Object.fromEntries(components.map((axis:string,i:number)=>[axis,numbers[i]]));}} onChange={onChange}/>;
}
export function VectorRangeInput({name,value,onChange}:any){
 return <CompoundNumbers name={name} className="inline-vector vector-range" values={[...vectorValues(value.Min),...vectorValues(value.Max)]} groups={[{label:'Min',fields:vectorFields(0,'Min.')},{label:'Max',fields:vectorFields(3,'Max.')}]} parse={(draft:string[])=>{const numbers=draft.map(parseNumber);return {...value,Min:numbers.slice(0,3),Max:numbers.slice(3)};}} validate={(next:any)=>next.Min.some((number:number,i:number)=>number>next.Max[i])?'最小值不能大于最大值':''} onChange={onChange}/>;
}
const ratioFields=(offset=0,prefix='')=>[{index:offset,name:prefix+'Numerator',separator:'/'},{index:offset+1,name:prefix+'Denominator'}];
export function RatioInput({name,value,onChange,validate=(number:number)=>rangeError('AspectRatio',number,number)}:any){
 return <CompoundNumbers name={name} className="inline-ratio" values={formatRatio(value).split(' / ')} groups={[{fields:ratioFields()}]} parse={(draft:string[])=>parseRatio(draft.join('/'))} validate={validate} onChange={onChange}/>;
}
export function RatioRangeInput({name,value,onChange}:any){
 return <CompoundNumbers name={name} className="inline-ratio ratio-range" values={[...formatRatio(value.Min).split(' / '),...formatRatio(value.Max).split(' / ')]} groups={[{label:'Min',fields:ratioFields(0,'Min.')},{label:'Max',fields:ratioFields(2,'Max.')}]} parse={(draft:string[])=>({...value,Min:parseRatio(draft.slice(0,2).join('/')),Max:parseRatio(draft.slice(2).join('/'))})} validate={(next:any)=>rangeError('AspectRatio',next.Min,next.Max)} onChange={onChange}/>;
}
