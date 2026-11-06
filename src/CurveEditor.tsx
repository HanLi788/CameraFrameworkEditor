import {t,tt} from './i18n';
import {useState} from 'react';
export function curveY(data:any,x:number){
  if(data.ParentType==='Bezier'){
    const p=[data.P1,data.P2,data.P3,data.P4];if(p.some(v=>!v))return NaN;
    const sample=(t:number,key:string)=>((1-t)**3*p[0][key]+3*(1-t)**2*t*p[1][key]+3*(1-t)*t*t*p[2][key]+t**3*p[3][key]);
    if(x<=p[0].X)return p[0].Y;if(x>=p[3].X)return p[3].Y;let lo=0,hi=1;for(let i=0;i<36;i++){const m=(lo+hi)/2;if(sample(m,'X')<x)lo=m;else hi=m;}return sample((lo+hi)/2,'Y');
  }
  const p=data.Points;if(!Array.isArray(p)||p.length<2)return NaN;
  const i=p.findIndex((n:any)=>n.X>=x);const a=p[Math.max(0,(i<0?p.length-1:i)-1)],b=p[Math.max(1,i<0?p.length-1:i)];const dx=b.X-a.X,t=(x-a.X)/dx;
  return (2*t**3-3*t*t+1)*a.Y+(t**3-2*t*t+t)*dx*a.Tangent+(-2*t**3+3*t*t)*b.Y+(t**3-t*t)*dx*b.Tangent;
}
export function curveTemplate(parentType:string){return parentType==='Bezier'?{SchemaVersion:3,ParentType:parentType,P1:{X:0,Y:0},P2:{X:1/3,Y:1/3},P3:{X:2/3,Y:2/3},P4:{X:1,Y:1}}:{SchemaVersion:3,ParentType:parentType,Points:[{X:0,Y:0,Tangent:0},{X:1,Y:1,Tangent:0}]};}
export default function CurveEditor({data,onChange,compact=false,readOnly=false}:{data:any;onChange?:(v:any)=>void;compact?:boolean;readOnly?:boolean}){
  const [draft,setDraft]=useState<any>(null);const [hover,setHover]=useState(.5);const shown=draft||data;
  const points=shown.ParentType==='Bezier'?[shown.P1,shown.P2,shown.P3,shown.P4]:shown.Points;
  if(!Array.isArray(points)||points.some(p=>!p||typeof p.X!=='number'||typeof p.Y!=='number'))return <div className="notice">{t("控制点无效，请在右侧或源码中修复。")}</div>;
  const pos=(x:number,y:number)=>`${60+x*700},${330-y*280}`;
  const graph=Array.from({length:241},(_,i)=>{const x=i/240;return (i?'L':'M')+pos(x,curveY(shown,x));}).join(' ');
  function coordinates(svg:SVGSVGElement,event:any){const point=svg.createSVGPoint();point.x=event.clientX;point.y=event.clientY;return point.matrixTransform(svg.getScreenCTM()!.inverse());}
  function drag(e:any,index:number){
    if(readOnly||!onChange)return;
    e.preventDefault();const svg=e.currentTarget.ownerSVGElement;const copy=structuredClone(data);e.currentTarget.setPointerCapture(e.pointerId);
    const move=(event:any)=>{const local=coordinates(svg,event);let x=(local.x-60)/700;let y=(330-local.y)/280;x=Math.max(0,Math.min(1,x));y=Math.max(0,Math.min(1,y));const pts=copy.ParentType==='Bezier'?[copy.P1,copy.P2,copy.P3,copy.P4]:copy.Points;
      if(copy.ParentType==='CubicHermiteSpline')x=index===0?0:index===pts.length-1?1:Math.min(pts[index+1].X-.001,Math.max(pts[index-1].X+.001,x));
      pts[index].X=Number(x.toFixed(4));pts[index].Y=Number(y.toFixed(4));setDraft(structuredClone(copy));};
    const end=()=>{onChange(copy);setDraft(null);e.target.removeEventListener('pointermove',move);e.target.removeEventListener('pointerup',end);e.target.removeEventListener('pointercancel',cancel);};
    const cancel=()=>{setDraft(null);e.target.removeEventListener('pointermove',move);e.target.removeEventListener('pointerup',end);e.target.removeEventListener('pointercancel',cancel);};
    e.target.addEventListener('pointermove',move);e.target.addEventListener('pointerup',end);e.target.addEventListener('pointercancel',cancel);
  }
  return <div className={'curve-editor '+(compact?'compact':'')} data-readonly={readOnly}>{!compact&&<><div className="section-kicker">CURVE EDITOR / {data.ParentType}</div><h2>{data.Name||t('曲线')}</h2><p>{readOnly?t('只读曲线预览。'):t('拖动节点或编辑精确参数，保存会更新当前曲线资产。')}</p></>}
    <svg viewBox="0 0 820 390" role={readOnly?'img':undefined} aria-label={readOnly?t('曲线只读预览'):t('曲线编辑图')} onPointerMove={e=>setHover(Math.max(0,Math.min(1,(coordinates(e.currentTarget,e).x-60)/700)))}>
      {Array.from({length:11},(_,i)=><g key={i}><path d={`M${60+i*70},50 V330 M60,${50+i*28} H760`} stroke="#303640" strokeWidth={i%5===0?1.5:.6}/>{i%2===0&&<><text x={60+i*70} y="355">{(i/10).toFixed(1)}</text><text x="35" y={335-i*28}>{(i/10).toFixed(1)}</text></>}</g>)}
      {shown.ParentType==='Bezier'&&<path d={`M${pos(points[0].X,points[0].Y)} L${pos(points[1].X,points[1].Y)} M${pos(points[2].X,points[2].Y)} L${pos(points[3].X,points[3].Y)}`} stroke="#838d9b" strokeDasharray="5 4"/>}
      <path d={graph} fill="none" stroke="#73d4c0" strokeWidth="3"/>
      <path d={`M${60+hover*700},50 V330`} stroke="#535d6b" strokeDasharray="3 4"/>
      {points.map((p:any,i:number)=><g key={i}><circle cx={60+p.X*700} cy={330-p.Y*280} r={readOnly?4:7} fill="#161b22" stroke={readOnly?'#7c9790':'#ecba75'} strokeWidth="3" onPointerDown={readOnly?undefined:e=>drag(e,i)} style={{cursor:readOnly?'default':'grab',touchAction:readOnly?'auto':'none'}}/>{!readOnly&&<text x={60+p.X*700+12} y={330-p.Y*280-9}>{i+1}</text>}</g>)}
    </svg><div className="curve-readout"><span>X <b>{hover.toFixed(3)}</b></span><span>Y <b>{curveY(shown,hover).toFixed(3)}</b></span><span>{points.length}{t("个控制点")}</span></div>
  </div>;
}
