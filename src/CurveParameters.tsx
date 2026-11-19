import {t,tt} from './i18n';
import CurvePointPanel from './CurvePointPanel';
import {movePoint} from './curveMath.mjs';
export default function CurveParameters({data,onChange,prefix=t('曲线'),selected=0,onSelect=()=>{}}:any){
 const bezier=data.ParentType==='Bezier',entries=bezier?['P1','P2','P3','P4'].filter(k=>data[k]).map(k=>[k,data[k]]):(data.Points||[]).map((p:any,i:number)=>[String(i),p]);
 return <><label className="curve-selection">{t('选中节点')}<select aria-label={t('选中节点')} value={Math.min(selected,entries.length-1)} onChange={e=>onSelect(Number(e.target.value))}>{entries.map(([key]:any,i:number)=><option key={key} value={i}>{bezier?key:tt`节点 ${i+1}`}</option>)}</select></label><div className="curve-parameters">{entries.map(([key,point]:any,index:number)=><CurvePointPanel key={key} label={bezier?key:tt`节点 ${index+1}`} path={`${prefix}.${bezier?key:'Points.'+key}`} point={point} axes={bezier?['X','Y']:['X','Y','Tangent']} selected={index===selected} onSelect={()=>onSelect(index)} locked={(axis:string)=>(!bezier&&axis==='X'||bezier&&axis==='Y')&&(index===0||index===entries.length-1)} onChange={(axis:string,next:number)=>onChange(movePoint(data,index,axis,next))}/>)}</div></>;
}
