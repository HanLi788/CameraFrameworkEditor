export function curveY(data,x){
  if(data.ParentType==='Bezier'){
    const p=[data.P1,data.P2,data.P3,data.P4];if(p.some(v=>!v))return NaN;
    const sample=(t,key)=>((1-t)**3*p[0][key]+3*(1-t)**2*t*p[1][key]+3*(1-t)*t*t*p[2][key]+t**3*p[3][key]);
    if(x<=p[0].X)return p[0].Y;if(x>=p[3].X)return p[3].Y;let lo=0,hi=1;for(let i=0;i<36;i++){const m=(lo+hi)/2;if(sample(m,'X')<x)lo=m;else hi=m;}return sample((lo+hi)/2,'Y');
  }
  const p=data.Points;if(!Array.isArray(p)||p.length<2)return NaN;
  if(x<=p[0].X)return p[0].Y;if(x>=p.at(-1).X)return p.at(-1).Y;
  const i=p.findIndex((n)=>n.X>=x);const a=p[Math.max(0,(i<0?p.length-1:i)-1)],b=p[Math.max(1,i<0?p.length-1:i)];const dx=b.X-a.X,t=(x-a.X)/dx;
  return (2*t**3-3*t*t+1)*a.Y+(t**3-2*t*t+t)*dx*a.Tangent+(-2*t**3+3*t*t)*b.Y+(t**3-t*t)*dx*b.Tangent;
}
export function curveTemplate(parentType){return parentType==='Bezier'?{SchemaVersion:3,ParentType:parentType,P1:{X:0,Y:0},P2:{X:1/3,Y:1/3},P3:{X:2/3,Y:2/3},P4:{X:1,Y:1}}:{SchemaVersion:3,ParentType:parentType,Points:[{X:0,Y:0,Tangent:0},{X:1,Y:1,Tangent:0}]};}
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
// Integer tick indices keep the 0.1 grid anchored while panning and avoid -0.
export function curveTicks(start,size){
 const first=Math.ceil(start*10-1e-9),last=Math.floor((start+size)*10+1e-9);
 return Array.from({length:Math.max(0,last-first+1)},(_,i)=>(first+i)/10);
}
const controlPoints=data=>data.ParentType==='Bezier'?[data.P1,data.P2,data.P3,data.P4]:data.Points;
// Snap only to reachable unit boundaries. Hysteresis is measured in CSS pixels,
// independent of view zoom and SVG scaling; no quantization of interior values.
export function snapPoint(data,index,position,pixelsPerUnit,previous={}){
 let next=data;const snaps={X:null,Y:null};
 for(const axis of ['X','Y']){
  const scale=pixelsPerUnit[axis],raw=position[axis];
  const reachable=[0,1].filter(bound=>controlPoints(movePoint(next,index,axis,bound))[index][axis]===bound);
  const held=previous[axis];
  const near=(bound,pixels)=>bound===0?raw*scale<=pixels:(1-raw)*scale<=pixels;
  let bound=reachable.includes(held)&&near(held,10)?held:null;
  if(bound===null)bound=reachable.filter(b=>near(b,6)).sort((a,b)=>Math.abs(raw-a)-Math.abs(raw-b))[0]??null;
  next=movePoint(next,index,axis,bound??raw);snaps[axis]=bound;
 }
 const point=controlPoints(next)[index],boundaries=[];
 for(const axis of ['X','Y'])if(point[axis]===0||point[axis]===1)boundaries.push(axis.toLowerCase()+point[axis]);
 return {data:next,snaps,boundaries};
}
export function movePoint(data,index,axis,value){
 const next=structuredClone(data),bezier=next.ParentType==='Bezier',pts=bezier?[next.P1,next.P2,next.P3,next.P4]:next.Points;
 if(!Number.isFinite(value)||!pts[index])return data;
 if(axis==='Tangent'){pts[index].Tangent=value;return next;}
 value=clamp(value,0,1);
 if(!bezier&&axis==='X')value=index===0?0:index===pts.length-1?1:clamp(value,pts[index-1].X+Math.min(.0001,(pts[index].X-pts[index-1].X)/2),pts[index+1].X-Math.min(.0001,(pts[index+1].X-pts[index].X)/2));
 if(bezier){if(axis==='Y'&&(index===0||index===3))value=index===0?0:1;if(axis==='X')value=index===0?Math.min(value,pts[3].X-.0001):index===3?Math.max(value,pts[0].X+.0001):clamp(value,pts[0].X,pts[3].X);}
 pts[index][axis]=value;
 if(bezier&&axis==='X'){pts[1].X=clamp(pts[1].X,pts[0].X,pts[3].X);pts[2].X=clamp(pts[2].X,pts[0].X,pts[3].X);}
 return next;
}
export function insertPoint(data,x,y){
 if(data.ParentType!=='CubicHermiteSpline')return null;
 const pts=data.Points;if(!Array.isArray(pts)||pts.length<2)return null;
 if(x===undefined){let i=0;for(let j=1;j<pts.length-1;j++)if(pts[j+1].X-pts[j].X>pts[i+1].X-pts[i].X)i=j;x=(pts[i].X+pts[i+1].X)/2;}
 const i=pts.findIndex(p=>p.X>x);if(i<1||x-pts[i-1].X<.0001||pts[i].X-x<.0001)return null;
 const a=pts[i-1],b=pts[i],w=b.X-a.X,u=(x-a.X)/w;
 const tangent=((6*u*u-6*u)*a.Y+(-6*u*u+6*u)*b.Y)/w+(3*u*u-4*u+1)*a.Tangent+(3*u*u-2*u)*b.Tangent;
 const next=structuredClone(data);next.Points.splice(i,0,{X:x,Y:clamp(y??curveY(data,x),0,1),Tangent:tangent});return {data:next,index:i};
}
export function removePoint(data,index){
 if(data.ParentType!=='CubicHermiteSpline'||index<=0||index>=data.Points.length-1)return data;
 const next=structuredClone(data);next.Points.splice(index,1);return next;
}
// Exact segment extrema, including overshoot between sampled graph points.
function splineOverflow(data,index){
 if(data.ParentType!=='CubicHermiteSpline')return 0;
 const pts=data.Points||[];let overflow=0;
 for(let i=1;i<pts.length;i++){
  if(index!==undefined&&i!==index&&i!==index+1)continue;
  const l=pts[i-1],r=pts[i],w=r.X-l.X,d=r.Y-l.Y,a=(l.Tangent+r.Tangent)*w-2*d,b=3*d-(2*l.Tangent+r.Tangent)*w,c=l.Tangent*w;
  const roots=[];if(Math.abs(a)<1e-14){if(b)roots.push(-c/(2*b));}else{const disc=4*b*b-12*a*c;if(disc>=0)roots.push((-2*b+Math.sqrt(disc))/(6*a),(-2*b-Math.sqrt(disc))/(6*a));}
  for(const t of [0,1,...roots.filter(t=>t>0&&t<1)]){const y=((a*t+b)*t+c)*t+l.Y;overflow=Math.max(overflow,-y,y-1);}
 }return overflow;
}
export function splineOvershoots(data){return splineOverflow(data)>1e-12;}
// With all other values fixed, the valid slopes form one interval: every
// point on either adjacent segment is affine in this tangent. Bisect toward
// the requested slope, checking exact extrema rather than graph samples.
export function constrainTangent(data,index,requested){
 const current=data.Points?.[index]?.Tangent;
 if(!Number.isFinite(current)||!Number.isFinite(requested))return {data,limited:true};
 const target=clamp(requested,-10000,10000),candidate=movePoint(data,index,'Tangent',target);
 const error=splineOverflow(data,index),nextError=splineOverflow(candidate,index);
 if(nextError<=1e-12)return {data:candidate,limited:target!==requested};
 // Source/numeric edits can already be invalid. Permit gradual repair but
 // never worsen the adjacent segments; unrelated invalid segments don't lock this handle.
 if(error>1e-12)return nextError<error?{data:candidate,limited:target!==requested}:{data,limited:true};
 let lo=0,hi=1;
 for(let n=0;n<56;n++){const fraction=(lo+hi)/2;candidate.Points[index].Tangent=current+(target-current)*fraction;if(splineOverflow(candidate,index)<=1e-12)lo=fraction;else hi=fraction;}
 candidate.Points[index].Tangent=current+(target-current)*lo;
 return {data:candidate,limited:true};
}
// Follow incremental pointer rotation, consuming blocked motion so reversing
// responds immediately. Unwrap the angle at +/- pi; the handle never flips sides.
export function rotateTangent(data,index,previousAngle,pointerAngle,aspect){
 const current=data.Points[index].Tangent,angle=Math.atan(current*aspect);
 const delta=Math.atan2(Math.sin(pointerAngle-previousAngle),Math.cos(pointerAngle-previousAngle));
 const limit=Math.atan(10000*aspect),requested=angle+delta,bounded=clamp(requested,-limit,limit);
 const result=constrainTangent(data,index,Math.tan(bounded)/aspect);
 return {...result,limited:result.limited||Math.abs(requested-bounded)>1e-10};
}
