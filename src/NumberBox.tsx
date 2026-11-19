import {useRef} from 'react';
import {t} from './i18n';
import {stepNumber} from './numericText.mjs';
export default function NumberBox({value,onValue,step=1,...props}:any){
 const input=useRef<HTMLInputElement>(null),label=props['aria-label']||'';
 const move=(direction:number)=>onValue(stepNumber(value,direction*step));
 return <span className="number-box"><input {...props} ref={input} type="text" inputMode="decimal" value={value} title={String(value)} onChange={e=>onValue(e.target.value)} onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();move((e.key==='ArrowUp'?1:-1)*(e.shiftKey?10:e.altKey?0.1:1));}}}/><span className="number-stepper">{[1,-1].map(direction=><button key={direction} type="button" disabled={props.disabled} aria-label={label+' '+t(direction>0?'增加':'减少')} tabIndex={-1} onPointerDown={e=>{e.preventDefault();input.current?.focus();}} onClick={()=>move(direction)}><span className={direction>0?'step-up':'step-down'}/></button>)}</span></span>;
}
