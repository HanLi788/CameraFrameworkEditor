import {t} from './i18n';
import {useId,useMemo} from 'react';
import {curveY} from './curveMath.mjs';

export default function CurveThumbnail({data}:any){
 const clip=useId();
 const path=useMemo(()=>{try{return Array.from({length:81},(_,i)=>{const x=i/80,y=curveY(data,x);if(!Number.isFinite(y))throw Error('Invalid curve');return `${i?'L':'M'}${4+x*92},${44-y*40}`;}).join(' ');}catch{return '';}},[data]);
 return <svg className="curve-thumbnail" viewBox="0 0 100 48" role="img" aria-label={t('\u66f2\u7ebf\u7f29\u7565\u56fe')}><defs><clipPath id={clip}><rect x="3" y="3" width="94" height="42"/></clipPath></defs><path d="M4 4V44H96 M4 24H96 M50 4V44" fill="none" stroke="currentColor" opacity=".2" strokeWidth=".6"/><path clipPath={`url(#${clip})`} d={path} fill="none" stroke="currentColor" strokeWidth="1.3"/></svg>;
}
