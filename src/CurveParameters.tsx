import {t,tt} from './i18n';
import {useEffect,useState} from 'react';
import {movePoint} from './curveMath.mjs';
function NumberField({value,label,locked,onChange,onFocus}:any){
 const [text,setText]=useState(String(value));useEffect(()=>setText(String(value)),[value]);
 const commit=()=>{const n=Number(text);if(text.trim()&&Number.isFinite(n)){onChange(n);setText(String(value));}else setText(String(value));};
 return <input type="number" step="any" aria-label={label} readOnly={locked} value={text} onFocus={onFocus} onChange={e=>setText(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setText(String(value));}}}/>;
}
export default function CurveParameters({data,onChange,prefix=t('曲线'),selected=0,onSelect=()=>{}}:any){
 const bezier=data.ParentType==='Bezier',entries=bezier?['P1','P2','P3','P4'].filter(k=>data[k]).map(k=>[k,data[k]]):(data.Points||[]).map((p:any,i:number)=>[String(i),p]);
 return <><label className="curve-selection">{t('选中节点')}<select aria-label={t('选中节点')} value={Math.min(selected,entries.length-1)} onChange={e=>onSelect(Number(e.target.value))}>{entries.map(([key]:any,i:number)=><option key={key} value={i}>{bezier?key:tt`节点 ${i+1}`}</option>)}</select></label><div className="curve-parameters">{entries.map(([key,p]:any,i:number)=><div className={'curve-param-row '+(i===selected?'selected':'')} key={key}><b>{bezier?key:tt`节点 ${i+1}`}</b>{(bezier?['X','Y']:['X','Y','Tangent']).map(axis=><label key={axis}>{axis}<NumberField key={axis} label={`${prefix}.${bezier?key:'Points.'+key}.${axis}`} value={p[axis]??0} locked={(!bezier&&axis==='X'||bezier&&axis==='Y')&&(i===0||i===entries.length-1)} onFocus={()=>onSelect(i)} onChange={(n:number)=>onChange(movePoint(data,i,axis,n))}/></label>)}</div>)}</div></>;
}
