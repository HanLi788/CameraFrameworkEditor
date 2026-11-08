const {test}=require('node:test'),assert=require('node:assert/strict');
test('0.1 grid stays anchored across zoom and pan without negative zero',async()=>{
 const {curveTicks}=await import('../src/curveMath.mjs');
 assert.deepEqual(curveTicks(-.2,1.4),Array.from({length:15},(_,i)=>(i-2)/10));
 assert.deepEqual(curveTicks(.03,.31),[.1,.2,.3]);assert.deepEqual(curveTicks(-.31,.31),[-.3,-.2,-.1,0]);
 assert.ok(curveTicks(-.2,1.4).every(x=>!Object.is(x,-0)));assert.equal(curveTicks(-4,8).length,81);
});
test('point snapping uses pixel hysteresis, both corner edges and continuous interior values',async()=>{
 const {curveTemplate,snapPoint}=await import('../src/curveMath.mjs'),d=curveTemplate('Bezier');
 for(const scale of [100,500,1400]){
  const pixels={X:scale,Y:scale},enter=snapPoint(d,1,{X:5/scale,Y:1-5/scale},pixels);
  assert.deepEqual([enter.data.P2.X,enter.data.P2.Y],[0,1]);assert.deepEqual(enter.boundaries,['x0','y1']);
  const hold=snapPoint(d,1,{X:9/scale,Y:1-9/scale},pixels,enter.snaps);assert.deepEqual([hold.data.P2.X,hold.data.P2.Y],[0,1]);
  const release=snapPoint(d,1,{X:11/scale,Y:1-11/scale},pixels,hold.snaps);assert.equal(release.data.P2.X,11/scale);assert.deepEqual(release.boundaries,[]);
  const outside=snapPoint(d,1,{X:-.5,Y:2},pixels);assert.deepEqual([outside.data.P2.X,outside.data.P2.Y],[0,1]);
 }
 const interior=snapPoint(d,1,{X:.347,Y:.618},{X:500,Y:200});assert.equal(interior.data.P2.X,.347);assert.equal(interior.data.P2.Y,.618);
 assert.deepEqual(d,curveTemplate('Bezier'));
});
test('snapping respects fixed endpoints, ordered Hermite points and Bezier endpoint range',async()=>{
 const {curveTemplate,insertPoint,snapPoint,movePoint}=await import('../src/curveMath.mjs'),pixels={X:500,Y:200};
 const d=insertPoint(curveTemplate('CubicHermiteSpline')).data;
 const middle=snapPoint(d,1,{X:-1,Y:1},pixels);assert.ok(middle.data.Points[1].X>0);assert.ok(!middle.boundaries.includes('x0'));assert.deepEqual(middle.boundaries,['y1']);
 const end=snapPoint(d,0,{X:.5,Y:.5},pixels);assert.equal(end.data.Points[0].X,0);assert.ok(end.boundaries.includes('x0'));
 const bezier=movePoint(movePoint(curveTemplate('Bezier'),0,'X',.2),3,'X',.8);
 const inner=snapPoint(bezier,1,{X:0,Y:.5},pixels);assert.equal(inner.data.P2.X,.2);assert.ok(!inner.boundaries.includes('x0'));
 const first=snapPoint(bezier,0,{X:1,Y:.5},pixels);assert.ok(first.data.P1.X<first.data.P4.X);assert.equal(first.data.P1.Y,0);
});
test('inserting a Hermite point preserves the entire original curve and derivative',async()=>{
 const {curveTemplate,curveY,insertPoint,removePoint}=await import('../src/curveMath.mjs');
 const original=curveTemplate('CubicHermiteSpline'),result=insertPoint(original,.37);
 assert.equal(original.Points.length,2);assert.equal(result.index,1);
 for(let i=0;i<=1000;i++)assert.ok(Math.abs(curveY(original,i/1000)-curveY(result.data,i/1000))<1e-12);
 assert.deepEqual(removePoint(result.data,1),original);assert.equal(removePoint(original,0),original);
 assert.equal(insertPoint(original,0),null);assert.equal(insertPoint(result.data,.37),null);
});
test('curve editing locks endpoints and X ordering, allows signed tangents and reports exact overshoot',async()=>{
 const {curveTemplate,insertPoint,movePoint,splineOvershoots}=await import('../src/curveMath.mjs');
 let d=insertPoint(curveTemplate('CubicHermiteSpline')).data;
 d=movePoint(d,1,'X',2);assert.ok(d.Points[1].X<1);assert.ok(d.Points[1].X>0);
 assert.equal(movePoint(d,0,'X',.5).Points[0].X,0);
 assert.equal(movePoint(d,2,'X',.5).Points[2].X,1);
 d=movePoint(d,0,'Tangent',-2);assert.equal(d.Points[0].Tangent,-2);assert.equal(splineOvershoots(d),true);
 const bezier=movePoint(curveTemplate('Bezier'),0,'X',.5);
 assert.equal(bezier.P2.X,.5);assert.equal(movePoint(bezier,0,'Y',.9).P1.Y,0);
});
test('dragging a tangent stops at the exact adjacent-segment boundary without changing other data',async()=>{
 const {curveTemplate,constrainTangent,splineOvershoots,movePoint}=await import('../src/curveMath.mjs');
 const original=curveTemplate('CubicHermiteSpline'),snapshot=structuredClone(original);
 const upper=constrainTangent(original,0,10000),lower=constrainTangent(original,0,-10000);
 assert.ok(upper.limited&&lower.limited);assert.ok(Math.abs(upper.data.Points[0].Tangent-3)<.001);
 assert.ok(Math.abs(lower.data.Points[0].Tangent)<.0001);
 assert.equal(splineOvershoots(upper.data),false);assert.equal(splineOvershoots(lower.data),false);
 assert.equal(splineOvershoots(movePoint(upper.data,0,'Tangent',upper.data.Points[0].Tangent+.001)),true);
 assert.deepEqual(original,snapshot);assert.deepEqual(upper.data.Points[1],original.Points[1]);
});
test('tangent constraints check both neighbours and preserve legal negative slopes',async()=>{
 const {constrainTangent,splineOvershoots,curveY,movePoint}=await import('../src/curveMath.mjs');
 const d={ParentType:'CubicHermiteSpline',Points:[{X:0,Y:.9,Tangent:0},{X:.4,Y:.5,Tangent:-1},{X:1,Y:.1,Tangent:0}]};
 assert.equal(constrainTangent(d,1,-2).data.Points[1].Tangent,-2);
 for(const target of [-10000,10000]){
  const result=constrainTangent(d,1,target);assert.equal(result.limited,true);assert.equal(splineOvershoots(result.data),false);
  for(let i=0;i<=10000;i++){const y=curveY(result.data,i/10000);assert.ok(y>=-1e-11&&y<=1+1e-11);}
  assert.equal(splineOvershoots(movePoint(result.data,1,'Tangent',result.data.Points[1].Tangent+Math.sign(target)*.001)),true);
 }
 // This segment lies completely between the 501 displayed graph samples.
 const narrow={ParentType:'CubicHermiteSpline',Points:[{X:0,Y:0,Tangent:0},{X:.00001,Y:1,Tangent:0},{X:1,Y:1,Tangent:0}]};
 const result=constrainTangent(narrow,1,10000);assert.ok(result.limited);assert.equal(splineOvershoots(result.data),false);
});
test('rotation consumes blocked movement, prevents vertical flips and reverses immediately',async()=>{
 const {curveTemplate,rotateTangent,splineOvershoots}=await import('../src/curveMath.mjs');
 const aspect=4/15,rad=d=>d*Math.PI/180;let d=curveTemplate('CubicHermiteSpline'),previous=0;
 for(const angle of [45,89,91,150,179,-179]){
  const result=rotateTangent(d,0,rad(previous),rad(angle),aspect);d=result.data;previous=angle;
  assert.ok(result.limited);assert.ok(d.Points[0].Tangent>0);assert.equal(splineOvershoots(d),false);
 }
 const before=d.Points[0].Tangent,result=rotateTangent(d,0,rad(-179),rad(176),aspect);
 assert.ok(result.data.Points[0].Tangent<before-.01);assert.equal(result.limited,false);
 // Tiny neighbouring segments allow very steep slopes: finite cap still prevents a flip.
 const steep={ParentType:'CubicHermiteSpline',Points:[{X:0,Y:.5,Tangent:0},{X:1e-8,Y:.5,Tangent:0},{X:1,Y:.5,Tangent:0}]};
 const cap=rotateTangent(steep,0,0,rad(100),aspect);assert.ok(cap.limited);assert.ok(cap.data.Points[0].Tangent>9999);
 assert.ok(Number.isFinite(cap.data.Points[0].Tangent));
});
test('invalid numeric tangents can recover and unrelated bad segments do not lock dragging',async()=>{
 const {curveTemplate,movePoint,constrainTangent,splineOvershoots}=await import('../src/curveMath.mjs');
 const invalid=movePoint(curveTemplate('CubicHermiteSpline'),0,'Tangent',-10);
 assert.equal(constrainTangent(invalid,0,-20).data,invalid);
 const repair=constrainTangent(invalid,0,-5);assert.equal(repair.data.Points[0].Tangent,-5);
 assert.equal(splineOvershoots(constrainTangent(repair.data,0,1).data),false);
 const separated={ParentType:'CubicHermiteSpline',Points:[{X:0,Y:0,Tangent:-20},{X:.3,Y:.5,Tangent:0},{X:.6,Y:.5,Tangent:0},{X:1,Y:1,Tangent:0}]};
 const last=constrainTangent(separated,3,1);assert.equal(last.data.Points[3].Tangent,1);assert.equal(last.limited,false);
});
