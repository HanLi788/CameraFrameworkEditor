import {useEffect,useState} from 'react';
export default function CheckboxInput({value,onValueChange,disabled=false,...props}:any){
 const [checked,setChecked]=useState(value===true),[pending,setPending]=useState(false);
 useEffect(()=>setChecked(value===true),[value]);
 return <input {...props} type="checkbox" checked={checked} disabled={disabled||pending} onChange={event=>{const next=event.target.checked;setChecked(next);setPending(true);Promise.resolve(onValueChange(next)).then(result=>{if(result===undefined)setChecked(value===true);}).catch(()=>setChecked(value===true)).finally(()=>setPending(false));}}/>;
}
