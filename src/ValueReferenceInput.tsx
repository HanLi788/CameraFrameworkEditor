import {useState} from 'react';
import {useReferenceCatalog} from './ReferenceCatalog';
import {valueReferences} from './valueChannels.mjs';
export default function ValueReferenceInput({name,value,kind,sequence,onChange}:any){
 const [pending,setPending]=useState(false);
 const catalog=useReferenceCatalog(),options=valueReferences(kind,sequence,catalog);
 const selected=value,parts=String(value??'').split('|');
 const sources=[...new Set(options.map((id:string)=>id.split('|')[0]))] as string[];
 const candidates=options.filter((id:string)=>id.split('|')[0]===parts[0]);
 const slots=[...new Set(candidates.filter((id:string)=>id.includes('|')).map((id:string)=>id.split('|')[1]))] as string[];
 const rotations=candidates.filter((id:string)=>id.split('|')[1]===parts[1]).map((id:string)=>id.split('|')[2]);
 const choose=(source:string,slot=parts[1],rotation=parts[2])=>{const available=options.filter((id:string)=>id.split('|')[0]===source),preferred=[source,slot||catalog?.Defaults?.Slot,rotation||catalog?.Defaults?.RotationSpace].join('|'),fallback=[source,slot||catalog?.Defaults?.Slot,catalog?.Defaults?.RotationSpace].join('|');const next=available.includes(source)?source:available.includes(preferred)?preferred:available.includes(fallback)?fallback:available[0];setPending(true);void Promise.resolve().then(()=>onChange(next)).finally(()=>setPending(false)).catch(()=>{});};
 const select=(suffix:string,current:string,values:string[],change:any,allowed=values)=><select title={current} aria-label={name+'.Reference'+suffix} value={current??''} aria-invalid={!options.includes(selected)} disabled={pending||!values.length} onChange={event=>change(event.target.value)}>{!values.includes(current)&&<option value={current??''}>{current||'—'}</option>}{values.map(id=><option key={id} value={id} disabled={!allowed.includes(id)}>{id}</option>)}</select>;
 const controls=()=> <div className="reference-fields">{select('',parts[0],sources,(source:string)=>choose(source))}{slots.length>0&&<>{select('.Slot',parts[1],slots,(slot:string)=>choose(parts[0],slot))}{select('.RotationSpace',parts[2],catalog?.RotationSpaces||rotations,(rotation:string)=>choose(parts[0],parts[1],rotation),rotations)}</>}</div>;
 return <div className="adaptive-field value-reference-input" data-reference={value}>{controls()}</div>;
}
