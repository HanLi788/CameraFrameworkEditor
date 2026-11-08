import HelpTip from './HelpTip';
import {t} from './i18n';
import {useEffect,useId,useRef,useState} from 'react';
import {curveY,clamp,insertPoint,removePoint,splineOvershoots,rotateTangent,curveTicks,snapPoint} from './curveMath.mjs';
export {curveY,curveTemplate} from './curveMath.mjs';
const unit={x:0,y:0,w:1,h:1};
const editingView={x:-.2,y:-.2,w:1.4,h:1.4};
function nearbyGridLine(value:number,pixelsPerUnit:number){
 const tick=Math.round(value*10),line=tick/10;
 return tick>0&&tick<10&&Math.abs(value-line)*pixelsPerUnit<=6?line:null;
}
export default function CurveEditor({data,onChange,compact=false,readOnly=false,selected=0,onSelect=()=>{}}:{data:any;onChange?:(v:any)=>void;compact?:boolean;readOnly?:boolean;selected?:number;onSelect?:(i:number)=>void}){
 const [draft,setDraft]=useState<any>(null),[hover,setHover]=useState(.5),[view,setView]=useState(readOnly?unit:editingView),[limited,setLimited]=useState(false),[boundaries,setBoundaries]=useState<string[]>([]);
 const svgRef=useRef<SVGSVGElement>(null),gesture=useRef<any>(null),clip=useId();
 const shown=draft||data,bezier=shown.ParentType==='Bezier',points=bezier?[shown.P1,shown.P2,shown.P3,shown.P4]:shown.Points;
 const valid=Array.isArray(points)&&points.length>=2&&points.every((p:any)=>p&&Number.isFinite(p.X)&&Number.isFinite(p.Y));
 const index=valid?Math.min(selected,points.length-1):0;
 const local=(svg:SVGSVGElement,e:any)=>{const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM()!.inverse());};
 useEffect(()=>{const el=svgRef.current;if(!el||readOnly)return;const wheel=(e:WheelEvent)=>{if(!e.ctrlKey)return;e.preventDefault();if(gesture.current)return;const p=local(el,e),u=(p.x-60)/700,v=(330-p.y)/280,f=Math.exp(clamp(e.deltaY*(e.deltaMode===1?.03:.002),-.8,.8));setView(old=>{const w=clamp(old.w*f,.05,8),h=clamp(old.h*f,.05,8);return{x:old.x+u*(old.w-w),y:old.y+v*(old.h-h),w,h};});};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);},[readOnly,valid]);
 const position=(x:number,y:number)=>({x:60+(x-view.x)/view.w*700,y:330-(y-view.y)/view.h*280});
 const pos=(x:number,y:number)=>{const p=position(x,y);return `${p.x},${p.y}`;};
 const valueAt=(p:any,v=view)=>({x:v.x+(p.x-60)/700*v.w,y:v.y+(330-p.y)/280*v.h});
 const add=(x?:number,y?:number)=>{const result=insertPoint(data,x,y);if(result&&onChange){onChange(result.data);onSelect(result.index);}};
 const remove=()=>{const next=removePoint(data,index);if(next!==data&&onChange){onChange(next);onSelect(Math.max(0,index-1));}};
 const fit=()=>{let lo=0,hi=1;for(let i=0;i<=500;i++){const y=curveY(shown,i/500);if(Number.isFinite(y)){lo=Math.min(lo,y);hi=Math.max(hi,y);}}setView({x:-.05,y:lo-(hi-lo)*.08,w:1.1,h:(hi-lo)*1.16});};
 const start=(e:any,kind:string,i=index)=>{if(readOnly||e.button!==(kind==='pan'?2:0))return;e.preventDefault();e.stopPropagation();svgRef.current?.focus();if(kind!=='pan')onSelect(i);const origin=local(svgRef.current!,e),point=position(points[i].X,points[i].Y),side=i===points.length-1?-1:1;setLimited(false);setBoundaries(kind==='point'?['X','Y'].filter(axis=>points[i][axis]===0||points[i][axis]===1).map(axis=>axis.toLowerCase()+points[i][axis]):[]);const at=valueAt(origin);gesture.current={kind,index:i,origin,view:{...view},data:structuredClone(data),side,offset:{x:points[i].X-at.x,y:points[i].Y-at.y},snaps:{},pointerAngle:Math.atan2((point.y-origin.y)*side,(origin.x-point.x)*side)};svgRef.current!.setPointerCapture(e.pointerId);};
 const move=(e:any)=>{const p=local(e.currentTarget,e),g=gesture.current;setHover(clamp(valueAt(p).x,0,1));if(!g)return;
  if(g.kind==='pan'){setView({...g.view,x:g.view.x-(p.x-g.origin.x)/700*g.view.w,y:g.view.y+(p.y-g.origin.y)/280*g.view.h});return;}
  const v=valueAt(p,g.view);let next=g.data;
  if(g.kind==='point'){
   const matrix=e.currentTarget.getScreenCTM(),result=snapPoint(next,g.index,{X:v.x+g.offset.x,Y:v.y+g.offset.y},{X:700/g.view.w*Math.hypot(matrix.a,matrix.b),Y:280/g.view.h*Math.hypot(matrix.c,matrix.d)},g.snaps);
   next=result.data;g.snaps=result.snaps;setBoundaries(result.boundaries);
  }else{
   const point=next.Points[g.index],dx=(v.x-point.X)*700/g.view.w*g.side,dy=(v.y-point.Y)*280/g.view.h*g.side;
   if(Math.hypot(dx,dy)<3){g.pointerAngle=null;return;}
   const angle=Math.atan2(dy,dx);
   if(g.pointerAngle===null){g.pointerAngle=angle;return;}
   const result=rotateTangent(g.result||g.data,g.index,g.pointerAngle,angle,(280/g.view.h)/(700/g.view.w));
   next=result.data;g.pointerAngle=angle;setLimited(result.limited);
  }
  g.result=next;setDraft(next);
 };
 const end=(e:any,cancel=false)=>{const g=gesture.current;gesture.current=null;if(!cancel&&g?.result)onChange?.(g.result);setDraft(null);setLimited(false);setBoundaries([]);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);};
 if(!valid)return <div className="notice">{t('控制点无效，请在右侧或源码中修复。')}</div>;
 const xTicks=curveTicks(view.x,view.w),yTicks=curveTicks(view.y,view.h),xLabels=readOnly?2:Math.max(1,Math.ceil(26/(70/view.w))),yLabels=readOnly?2:Math.max(1,Math.ceil(14/(28/view.h)));
 // Use the actual constrained node position, not the pointer. These guides
 // only render during node dragging and never change the stored coordinates.
 const gridPoint=!readOnly&&gesture.current?.kind==='point'?points[gesture.current.index]:null,matrix=svgRef.current?.getScreenCTM();
 const guides={X:gridPoint&&matrix?nearbyGridLine(gridPoint.X,700/view.w*Math.hypot(matrix.a,matrix.b)):null,Y:gridPoint&&matrix?nearbyGridLine(gridPoint.Y,280/view.h*Math.hypot(matrix.c,matrix.d)):null};
 const graph=Array.from({length:501},(_,i)=>{const x=i/500;return(i?'L':'M')+pos(x,curveY(shown,x));}).join(' ');
 return <div className={'curve-editor '+(compact?'compact':'')} data-readonly={readOnly}>
  {!readOnly&&<div className="curve-tools"><HelpTip label={t('曲线操作说明')}>{t('拖动节点与切线手柄；Ctrl + 滚轮缩放，右键拖动平移。')}</HelpTip><button onClick={fit}>{t('适应曲线')}</button><button onClick={()=>setView(editingView)}>{t('重置视图')}</button>{!bezier&&<><button onClick={()=>add()}>{t('添加节点')}</button><button disabled={index===0||index===points.length-1} onClick={remove}>{t('删除选中节点')}</button></>}</div>}
  <svg ref={svgRef} viewBox="0 0 820 390" data-view={JSON.stringify(view)} tabIndex={readOnly?undefined:0} role={readOnly?'img':undefined} aria-label={t(readOnly?'曲线只读预览':'曲线编辑图')} onContextMenu={e=>e.preventDefault()} onPointerDown={e=>start(e,'pan')} onPointerMove={move} onPointerUp={e=>end(e)} onPointerCancel={e=>end(e,true)} onLostPointerCapture={()=>{gesture.current=null;setDraft(null);setLimited(false);setBoundaries([]);}} onKeyDown={e=>{if(e.key==='Delete'&&!readOnly){e.preventDefault();remove();}if(e.key==='Escape'&&gesture.current){e.preventDefault();e.stopPropagation();gesture.current=null;setDraft(null);setLimited(false);setBoundaries([]);}}} onDoubleClick={e=>{if(!readOnly&&!bezier&&!(e.target as Element).closest('[data-control-point],[data-tangent]')){const v=valueAt(local(e.currentTarget,e));add(v.x,v.y);}}}>
   <defs><clipPath id={clip}><rect x="60" y="50" width="700" height="280"/></clipPath></defs>
   {!readOnly&&<rect className="curve-unit-region" clipPath={`url(#${clip})`} x={position(0,1).x} y={position(0,1).y} width={700/view.w} height={280/view.h} fill="#77cbbb0c"/>}
   {xTicks.map(value=>{const x=position(value,0).x;return <g key={'x'+value} data-tick-x={value}><path d={`M${x},50 V330`} stroke={value===0?'#56656b':'#303640'} strokeWidth={value===0?1:.6}/>{Math.round(value*10)%xLabels===0&&<text x={x} y="355">{value.toFixed(1)}</text>}</g>;})}
   {yTicks.map(value=>{const y=position(0,value).y;return <g key={'y'+value} data-tick-y={value}><path d={`M60,${y} H760`} stroke={value===0?'#56656b':'#303640'} strokeWidth={value===0?1:.6}/>{Math.round(value*10)%yLabels===0&&<text x="31" y={y+5}>{value.toFixed(1)}</text>}</g>;})}
   <g clipPath={`url(#${clip})`}>
    {bezier&&<path d={`M${pos(points[0].X,points[0].Y)} L${pos(points[1].X,points[1].Y)} M${pos(points[2].X,points[2].Y)} L${pos(points[3].X,points[3].Y)}`} stroke="#838d9b" strokeDasharray="5 4"/>}
    <path d={graph} fill="none" stroke="#73d4c0" strokeWidth="3"/>
    <path d={`M${position(hover,0).x},50 V330`} stroke="#535d6b" strokeDasharray="3 4"/>
    {(['X','Y'] as const).map(axis=>{const value=guides[axis];if(value===null)return null;const d=axis==='X'?`M${position(value,0).x},50 V330`:`M60,${position(0,value).y} H760`;return <path key={axis} data-grid-guide={axis} data-value={value} d={d} stroke="#ecba75" strokeWidth="1.5" vectorEffect="non-scaling-stroke" pointerEvents="none"/>;})}
    {!readOnly&&['x0','x1','y0','y1'].map(edge=>{const value=Number(edge[1]),active=boundaries.includes(edge),d=edge[0]==='x'?`M${pos(value,0)} L${pos(value,1)}`:`M${pos(0,value)} L${pos(1,value)}`;return <path key={edge} data-boundary={edge} data-active={active} d={d} fill="none" stroke={active?'#ecba75':'#658f85'} strokeWidth={active?2:1} strokeDasharray={active?undefined:'5 4'} vectorEffect="non-scaling-stroke" pointerEvents="none"/>;})}
    {!bezier&&!readOnly&&points.map((p:any,i:number)=>{const dx=(i===points.length-1?-1:1)*52/Math.hypot(700/view.w,p.Tangent*280/view.h),h=position(p.X+dx,p.Y+p.Tangent*dx);return <g key={i}><path d={`M${pos(p.X,p.Y)} L${h.x},${h.y}`} stroke={i===index?'#ecba75':'#838d9b'}/><circle data-tangent={i} data-limited={limited&&i===index} aria-label={t('切线')+' '+(i+1)} cx={h.x} cy={h.y} r="5" fill={limited&&i===index?'#ecba75':'#76a4df'} onPointerDown={e=>start(e,'tangent',i)} style={{cursor:'crosshair'}}/></g>;})}
    {points.map((p:any,i:number)=>{const v=position(p.X,p.Y);return <g key={i}><circle data-control-point={i} aria-label={t('节点')+' '+(i+1)} cx={v.x} cy={v.y} r={readOnly?4:i===index?8:6} fill={i===index&&!readOnly?'#ecba75':'#161b22'} stroke={readOnly?'#7c9790':'#ecba75'} strokeWidth="2" onPointerDown={readOnly?undefined:e=>start(e,'point',i)} style={{cursor:readOnly?'default':'grab'}}/>{!readOnly&&<text x={v.x+12} y={v.y-9}>{i+1}</text>}</g>;})}
   </g>
   {!readOnly&&(limited||splineOvershoots(shown))&&<text className="curve-constraint-status" role="status" x="70" y="28">{t(limited?'已到达切线边界':'切线使曲线超出 [0,1]，请调整后保存。')}</text>}
  </svg><div className="curve-readout"><span>X <b>{hover.toFixed(3)}</b></span><span>Y <b>{curveY(shown,hover).toFixed(3)}</b></span><span>{points.length}{t('个控制点')}</span></div>
 </div>;
}
