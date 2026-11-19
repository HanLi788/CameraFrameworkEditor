import {useLayoutEffect,useState} from 'react';
// Measure the committed value. A draft cannot replace its own focused editor.
export default function useFieldOverflow(host:any,values:string[]){
 const [overflow,setOverflow]=useState(false),signature=JSON.stringify(values);
 useLayoutEffect(()=>{
  const element=host.current;if(!element)return;
  let disposed=false;const canvas=document.createElement('canvas'),context=canvas.getContext('2d')!;
  const measure=()=>{if(disposed||!element.isConnected)return;const control=element.querySelector('input,select,button')||element;context.font=getComputedStyle(control).font||'12px sans-serif';const available=element.clientWidth;if(!available)return;const needed=Math.max(...values.map(value=>context.measureText(String(value??'')).width),0)*values.length+28;setOverflow(needed>available);};
  const observer=new ResizeObserver(measure);observer.observe(element);measure();document.fonts.ready.then(measure);
  return()=>{disposed=true;observer.disconnect();};
 },[signature]);
 return overflow;
}
