import {parseRangeNumber,rangeError} from './rangeChannels.mjs';

const axes=['X','Y','Z'];
// Add decimal steps before converting back to a Lua-compatible finite number.
export function stepNumber(text,delta){
 try{parseNumber(String(text).trim()||'0');if(!Number.isFinite(delta))return text;}catch{return text;}
 const decimal=value=>{
  const match=/^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(String(value).trim()||'0');
  return {coefficient:BigInt((match[1]==='-'?'-':'')+(match[2]||'0')+(match[3]||'')),exponent:Number(match[4]||0)-(match[3]?.length||0)};
 };
 const left=decimal(text),right=decimal(delta),exponent=Math.min(left.exponent,right.exponent);
 const sum=left.coefficient*10n**BigInt(left.exponent-exponent)+right.coefficient*10n**BigInt(right.exponent-exponent);
 const result=Number(sum.toString()+'e'+exponent);
 return Number.isFinite(result)?String(result):text;
}
export function parseNumber(text){
 const value=parseRangeNumber(text),error=rangeError('',value,value);
 if(error)throw Error(error);
 return value;
}
export function vectorValues(value){return Array.isArray(value)?value:axes.map(axis=>value?.[axis]);}
export function formatVector(value){return '['+vectorValues(value).map((v,i)=>axes[i]+' = '+(v??'?')).join(', ')+']';}
export function formatRatio(value){
 const parts=[[16,9],[4,3],[21,9],[3,2],[1,1]].find(([a,b])=>a/b===value)||[value,1];
 return parts.join(' / ');
}
export function parseRatio(text){
 const parts=text.split('/');
 if(parts.length!==2||parts.some(part=>!part.trim()))throw Error('请输入完整的宽高比，例如 16 / 9');
 const [a,b]=parts.map(parseNumber);
 if(b<=0)throw Error('分母必须大于零');
 const value=a/b,error=rangeError('',value,value);
 if(error)throw Error(error);
 return value;
}
