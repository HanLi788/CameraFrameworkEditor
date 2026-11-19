import {useEffect,useState} from 'react';

function AxisField({value,label,locked,onChange,onFocus}:any){
 const [text,setText]=useState(String(value));useEffect(()=>setText(String(value)),[value]);
 const commit=()=>{const next=Number(text);if(text.trim()&&Number.isFinite(next)){onChange(next);setText(String(value));}else setText(String(value));};
 return <input type="number" step="any" aria-label={label} title={text} readOnly={locked} value={text} onFocus={onFocus} onChange={event=>setText(event.target.value)} onBlur={commit} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setText(String(value));}}}/>;
}
export default function CurvePointPanel({label,path,point,axes,locked,selected,onSelect,onChange}:any){
 return <section className={'curve-point-panel '+(selected?'selected':'')} aria-label={label} data-curve-point={label}>
  <header><button type="button" aria-pressed={selected} onClick={onSelect}>{label}</button></header>
  <div className="curve-point-values">{axes.map((axis:string)=><label key={axis} className={axis==='Tangent'?'curve-point-tangent':''}><span>{axis}</span><AxisField label={path+'.'+axis} value={point[axis]??0} locked={locked(axis)} onFocus={onSelect} onChange={(value:number)=>onChange(axis,value)}/></label>)}</div>
 </section>;
}
