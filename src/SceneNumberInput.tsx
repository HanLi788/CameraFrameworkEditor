import {useEffect,useRef,useState} from 'react';
import {t} from './i18n';
export default function SceneNumberInput({label,value,onChange,min,max,integer=false}:any){
 const [draft,setDraft]=useState(String(value)),focused=useRef(false),input=useRef<HTMLInputElement>(null);
 const numeric=draft.trim()!==''&&/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(draft.trim()),n=Number(draft);
 const valid=numeric&&Number.isFinite(n)&&(min===undefined||n>=min)&&(max===undefined||n<=max)&&(!integer||Number.isSafeInteger(n));
 useEffect(()=>{if(!focused.current)setDraft(String(value));},[value]);
 useEffect(()=>{input.current?.setCustomValidity(valid?'':t('请输入有效范围内的数值'));},[valid]);
 return <input ref={input} data-scene-number type="text" inputMode="decimal" spellCheck={false} aria-label={label} aria-invalid={!valid} title={!valid?t('请输入有效范围内的数值'):undefined} value={draft} onFocus={()=>{focused.current=true;}} onBlur={()=>{focused.current=false;if(valid)setDraft(String(n));}} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setDraft(String(value));}if(e.key==='Enter'){if(valid)e.currentTarget.blur();else e.currentTarget.reportValidity();}}} onChange={e=>{const text=e.target.value,num=Number(text);setDraft(text);if(text.trim()&&/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(text.trim())&&Number.isFinite(num)&&(min===undefined||num>=min)&&(max===undefined||num<=max)&&(!integer||Number.isSafeInteger(num)))onChange(num);}}/>;
}
