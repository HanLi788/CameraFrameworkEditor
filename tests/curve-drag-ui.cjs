const {_electron:electron}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'camera-curve-drag-')),source=process.env.CAMERA_FRAMEWORK_TEST_ROOT||'D:/MyWorks/Lua/CameraFramework';
 for(const name of ['CameraFramework','Foundation','InputSystem'])await fs.cp(path.join(path.dirname(source),name),path.join(dir,name),{recursive:true});
 for(const name of ['PlayerEvents','MovementValues'])await fs.cp(path.join(path.dirname(source),'Actor/Player',name+'.lua'),path.join(dir,'Actor/Player',name+'.lua'));
 const {curveTemplate,splineOvershoots}=await import('../src/curveMath.mjs'),file='Assets/CurveAssets/CubicHermiteSpline/DragConstraint.curve',original=curveTemplate('CubicHermiteSpline');
 await fs.mkdir(path.dirname(path.join(dir,'CameraFramework',file)),{recursive:true});await fs.writeFile(path.join(dir,'CameraFramework',file),JSON.stringify(original,null,2)+'\n');
 const data=path.join(dir,'data');await fs.mkdir(data);await fs.writeFile(path.join(data,'settings.json'),JSON.stringify({recent:[dir]}));
 const env={...process.env,CAMERA_EDITOR_TEST_DATA:data};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch(process.argv.includes('--packaged')?{executablePath:path.resolve('release/win-unpacked/相机框架编辑器.exe'),env}:{args:[path.resolve('.')],env});
 const page=await app.firstWindow(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 const panel=page.getByRole('tabpanel',{name:file,exact:true}),detail=page.locator('dialog.asset-detail-dialog'),svg=panel.getByLabel('曲线编辑图',{exact:true});
 const state=()=>page.evaluate(()=>window.cameraEditor.bootstrap()),draft=async()=>JSON.parse((await state()).session.docs.find(d=>d.path===file).text);
 const until=async fn=>{for(let i=0;i<200;i++){if(await fn())return;await page.waitForTimeout(30);}throw Error('State did not settle');};
 const view=async()=>JSON.parse(await svg.getAttribute('data-view')),defaultView={x:-.2,y:-.2,w:1.4,h:1.4};
 const point=async(i,tangent=false)=>svg.locator(`[data-${tangent?'tangent':'control-point'}="${i}"]`).evaluate(el=>{const p=el.ownerSVGElement.createSVGPoint();p.x=el.cx.baseVal.value;p.y=el.cy.baseVal.value;const v=p.matrixTransform(el.getScreenCTM());return {x:v.x,y:v.y};});
 const begin=async i=>{const p=await point(i),h=await point(i,true);await page.mouse.move(h.x,h.y);await page.mouse.down();return {p,r:Math.hypot(h.x-p.x,h.y-p.y),side:i===1?-1:1};};
 const rotate=async(g,angle)=>{const rad=angle*Math.PI/180;await page.mouse.move(g.p.x+g.side*g.r*Math.cos(rad),g.p.y-g.side*g.r*Math.sin(rad));};
 const boxEqual=(a,b)=>{for(const k of ['x','y','width','height'])assert.ok(Math.abs(a[k]-b[k])<.01,`${k}: ${a[k]} / ${b[k]}`);};
 const world=async(X,Y)=>svg.evaluate((el,{X,Y})=>{const view=JSON.parse(el.dataset.view),p=el.createSVGPoint();p.x=60+(X-view.x)/view.w*700;p.y=330-(Y-view.y)/view.h*280;const v=p.matrixTransform(el.getScreenCTM());return {x:v.x,y:v.y};},{X,Y});
 const active=()=>svg.locator('[data-boundary][data-active="true"]').evaluateAll(els=>els.map(el=>el.dataset.boundary).sort());
 const guides=()=>svg.locator('[data-grid-guide]').evaluateAll(els=>Object.fromEntries(els.map(el=>[el.dataset.gridGuide,Number(el.dataset.value)])));
 const tickValues=axis=>svg.locator(`[data-tick-${axis}]`).evaluateAll((els,axis)=>els.map(el=>Number(el.getAttribute('data-tick-'+axis))),axis);
 const undo=()=>detail.getByRole('button',{name:'撤销',exact:true}).click();
 try{
  await page.locator('.recent button').click();await page.locator('.workbench-body').waitFor();assert.deepEqual((await state()).project.issues,[]);
  await page.evaluate(p=>window.cameraEditor.openFile({path:p}),file);await panel.waitFor();assert.deepEqual(await view(),defaultView);assert.equal(await svg.locator('.curve-unit-region').count(),1);for(const axis of ['x','y'])assert.deepEqual(await tickValues(axis),Array.from({length:15},(_,i)=>(i-2)/10));
  const box=await svg.boundingBox(),g=await begin(0);await rotate(g,60);await panel.getByRole('status').waitFor();assert.equal(await panel.getByRole('status').textContent(),'已到达切线边界');
  const stopped=await point(0,true);
  for(const angle of [80,100,140,179,181]){await rotate(g,angle);const h=await point(0,true);assert.ok(Math.hypot(h.x-stopped.x,h.y-stopped.y)<.1);assert.ok(h.x>g.p.x);boxEqual(box,await svg.boundingBox());assert.deepEqual(await view(),defaultView);}
  assert.deepEqual(await draft(),original); // One edit is committed on release, not per frame.
  await rotate(g,176);await until(async()=>await panel.getByRole('status').count()===0);assert.ok((await point(0,true)).y>stopped.y+1);await page.mouse.up();
  await until(async()=>(await draft()).Points[0].Tangent>0);assert.equal(splineOvershoots(await draft()),false);
  await undo();await until(async()=>JSON.stringify(await draft())===JSON.stringify(original));
  const last=await begin(1);for(const angle of [50,89,110])await rotate(last,angle);assert.ok((await point(1,true)).x<last.p.x);await page.mouse.up();await until(async()=>(await draft()).Points[1].Tangent>2.9);assert.equal(splineOvershoots(await draft()),false);
  await undo();await until(async()=>JSON.stringify(await draft())===JSON.stringify(original));
  const cancel=await begin(0);await rotate(cancel,20);await page.keyboard.press('Escape');await page.mouse.up();assert.deepEqual(await draft(),original);assert.equal(await panel.getByRole('status').count(),0);
  const pointerCancel=await begin(0);await rotate(pointerCancel,20);await svg.dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();assert.deepEqual(await draft(),original);
  const input=panel.getByLabel('曲线.Points.0.Tangent',{exact:true});await input.fill('-10');await input.press('Enter');await until(async()=>(await draft()).Points[0].Tangent===-10);await panel.getByRole('status').waitFor();boxEqual(box,await svg.boundingBox());assert.match(await panel.getByRole('status').textContent(),/超出/);
  await undo();await until(async()=>JSON.stringify(await draft())===JSON.stringify(original));
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.keyboard.down('Control');await page.mouse.wheel(0,-150);await page.keyboard.up('Control');await until(async()=>(await view()).w<1.4);
  await page.mouse.down({button:'right'});await page.mouse.move(box.x+box.width/2+35,box.y+box.height/2+20,{steps:4});await page.mouse.up({button:'right'});
  await panel.getByRole('button',{name:'重置视图',exact:true}).click();assert.deepEqual(await view(),defaultView);
  const saved=await begin(0);await rotate(saved,20);await page.mouse.up();await until(async()=>(await draft()).Points[0].Tangent>.1);await detail.getByRole('button',{name:'保存',exact:true}).click();await until(async()=>!(await state()).session.docs.find(d=>d.path===file).dirty);
  assert.equal(splineOvershoots(JSON.parse(await fs.readFile(path.join(dir,'CameraFramework',file),'utf8'))),false);
  await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/curve-drag.png'});
  await page.evaluate(()=>window.cameraEditor.preferences({language:'en'}));await panel.getByRole('button',{name:'Reset view',exact:true}).waitFor();
  // Query the SVG independent of translated labels for the language check.
  const handle=panel.locator('[data-tangent="0"]'),hb=await handle.boundingBox();await page.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);await page.mouse.down();await page.mouse.move(hb.x,hb.y-100,{steps:5});await panel.getByRole('status').waitFor();assert.equal(await panel.getByRole('status').textContent(),'Tangent limit reached');await page.keyboard.press('Escape');await page.mouse.up();
  await page.evaluate(()=>window.cameraEditor.preferences({language:'zh'}));await panel.getByLabel('曲线父类型',{exact:true}).selectOption('Bezier');await until(async()=>(await draft()).ParentType==='Bezier');assert.deepEqual(await view(),defaultView);assert.equal(await panel.locator('[data-tangent]').count(),0);
  const bezier=await draft();
  for(const zoom of [false,true]){
   if(zoom){const b=await svg.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.keyboard.down('Control');await page.mouse.wheel(0,180);await page.keyboard.up('Control');await until(async()=>(await view()).w>1.4);}
   for(const axis of ['x','y']){const ticks=await tickValues(axis);for(let i=1;i<ticks.length;i++)assert.ok(Math.abs(ticks[i]-ticks[i-1]-.1)<1e-12);}
   // Internal guides follow proximity without quantizing the actual node.
   const gridStart=await point(1),intersection=await world(.4,.6);
   await page.mouse.move(gridStart.x,gridStart.y);await page.mouse.down();await page.mouse.move(intersection.x+4,intersection.y+4);
   await until(async()=>Object.keys(await guides()).length===2);assert.deepEqual(await guides(),{X:.4,Y:.6});
   const actual=await point(1);assert.ok(Math.abs(actual.x-intersection.x-4)<.3);assert.ok(Math.abs(actual.y-intersection.y-4)<.3);assert.deepEqual(await draft(),bezier);
   const onlyX=await world(.4,.65);await page.mouse.move(onlyX.x+4,onlyX.y);await until(async()=>JSON.stringify(await guides())===JSON.stringify({X:.4}));
   const onlyY=await world(.45,.6);await page.mouse.move(onlyY.x,onlyY.y+4);await until(async()=>JSON.stringify(await guides())===JSON.stringify({Y:.6}));
   const between=await world(.45,.65);await page.mouse.move(between.x,between.y);await until(async()=>Object.keys(await guides()).length===0);
   await page.mouse.move(intersection.x+4,intersection.y+4);await until(async()=>Object.keys(await guides()).length===2);
   if(!zoom)await page.screenshot({path:'test-results/curve-grid-guides.png'});
   await page.mouse.up();await until(async()=>(await draft()).P2.X!==bezier.P2.X);assert.deepEqual(await guides(),{});assert.notEqual((await draft()).P2.X,.4);assert.notEqual((await draft()).P2.Y,.6);
   await page.mouse.move(intersection.x,intersection.y);assert.deepEqual(await guides(),{});
   await undo();await until(async()=>JSON.stringify(await draft())===JSON.stringify(bezier));
   for(const corner of [{X:0,Y:1},{X:1,Y:0}]){
    const start=await point(1),target=await world(corner.X,corner.Y),signX=corner.X===0?1:-1,signY=corner.Y===1?1:-1;
    const moveNear=distance=>page.mouse.move(target.x+signX*distance,target.y+signY*distance);
    await page.mouse.move(start.x,start.y);await page.mouse.down();await moveNear(5);
    await until(async()=>(await active()).length===2);assert.deepEqual(await active(),['x'+corner.X,'y'+corner.Y]);
    let h=await point(1);assert.ok(Math.hypot(h.x-target.x,h.y-target.y)<.2);assert.deepEqual(await draft(),bezier);
    await moveNear(9);h=await point(1);assert.ok(Math.hypot(h.x-target.x,h.y-target.y)<.2);
    await moveNear(12);await until(async()=>(await active()).length===0);h=await point(1);assert.ok(Math.abs(Math.abs(h.x-target.x)-12)<.3);assert.ok(Math.abs(Math.abs(h.y-target.y)-12)<.3);
    await moveNear(5);await until(async()=>(await active()).length===2);
    if(!zoom&&corner.X===0)await page.screenshot({path:'test-results/curve-snap.png'});
    await page.mouse.up();await until(async()=>(await draft()).P2.X===corner.X&&(await draft()).P2.Y===corner.Y);assert.deepEqual(await active(),[]);
    await undo();await until(async()=>JSON.stringify(await draft())===JSON.stringify(bezier));
   }
  }
  await panel.getByRole('button',{name:'重置视图',exact:true}).click();assert.deepEqual(await view(),defaultView);
  for(const cancelMode of ['escape','pointercancel']){
   const start=await point(1),target=await world(.4,.6);await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(target.x+4,target.y+4);await until(async()=>Object.keys(await guides()).length===2);
   if(cancelMode==='escape')await page.keyboard.press('Escape');else await svg.dispatchEvent('pointercancel',{pointerId:1});
   await page.mouse.up();assert.deepEqual(await guides(),{});assert.deepEqual(await draft(),bezier);
  }
  const cancelStart=await point(1),cancelTarget=await world(0,1);await page.mouse.move(cancelStart.x,cancelStart.y);await page.mouse.down();await page.mouse.move(cancelTarget.x+5,cancelTarget.y+5);await until(async()=>(await active()).length===2);await page.keyboard.press('Escape');await page.mouse.up();assert.deepEqual(await active(),[]);assert.deepEqual(await draft(),bezier);
  await undo();
  assert.deepEqual(errors,[]);console.log('Curve drag UI passed: internal grid guides without snapping, 0.1 ticks, boundary highlight/snap/hysteresis across zoom, default bounds, continuous limits/no flip, immediate reversal, stable SVG, undo/cancel, numeric warning, zoom/pan/reset, Lua save, Bezier and translations. Fixture:',dir);
 }catch(e){await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/curve-drag-failure.png'}).catch(()=>{});throw e;}
 finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1;});
