import {useSyncExternalStore} from 'react';
import dictionary from './translations.json';

export type Language='zh'|'en';
let language:Language='zh';
const listeners=new Set<()=>void>();
export function setLanguage(value:Language){if(value!==language){language=value;document.documentElement.lang=value==='zh'?'zh-CN':'en';listeners.forEach(fn=>fn());}}
export function useLanguage(){return useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn);},()=>language);}
// Only authored UI strings pass through this function. Asset data and source values do not.
export function t(value:string):string {
  const key=value.trim(), translated=(dictionary as Record<string,string>)[key];
  return language==='en'&&translated?value.replace(key,translated):value;
}
export function tt(parts:TemplateStringsArray,...values:unknown[]){return parts.reduce((text,part,i)=>text+t(part)+(i<values.length?String(values[i]):''),'');}
