const {_electron:electron}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'camera-fps-ui-')),source=process.env.CAMERA_FRAMEWORK_TEST_ROOT||'D:/MyWorks/Lua/CameraFramework';
 for(const name of ['CameraFramework','Foundation','InputSystem'])await fs.cp(path.join(path.dirname(source),name),path.join(temp,name),{recursive:true});
 for(const name of ['PlayerEvents','MovementValues'])await fs.cp(path.join(path.dirname(source),'Actor/Player',name+'.lua'),path.join(temp,'Actor/Player',name+'.lua'));
 const data=path.join(temp,'data');await fs.mkdir(data);await fs.writeFile(path.join(data,'settings.json'),JSON.stringify({recent:[temp]}));
 const env={...process.env,CAMERA_EDITOR_TEST_DATA:data};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch(process.argv.includes('--packaged')?{executablePath:path.resolve('release/win-unpacked/相机框架编辑器.exe'),env}:{args:[path.resolve('.')],env});
 const main=await app.firstWindow(),errors=[];let game;
 const watch=page=>{page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));};watch(main);app.on('window',watch);
 const until=async fn=>{const end=Date.now()+30000;while(!await fn()){if(Date.now()>end)throw Error('frame-rate UI timeout');await new Promise(r=>setTimeout(r,30));}};
 const frame=async()=>(await game.evaluate(()=>window.cameraEditor.bootstrap())).simulation.frame;
 try{
  await main.locator('.recent button').click();await main.locator('.workbench-body').waitFor();
  const opened=app.waitForEvent('window');await main.getByRole('button',{name:'打开游戏窗口',exact:true}).click();game=await opened;
  for(const fps of [90,120]){
   await game.getByRole('button',{name:'游戏设置',exact:true}).click();
   const setting=game.getByLabel('帧率上限',{exact:true});assert.deepEqual(await setting.locator('option').evaluateAll(options=>options.map(o=>o.value)),['30','60','90','120']);
   await setting.selectOption(String(fps));await game.getByRole('button',{name:'保存设置',exact:true}).click();
   assert.equal((await game.evaluate(()=>window.cameraEditor.game('state'))).settings.fps,fps);
  }
  await game.getByRole('button',{name:'开始游戏',exact:true}).click();await until(async()=>(await frame())?.time>.2);
  const samples=await game.evaluate(()=>new Promise(resolve=>{const result=[],off=window.cameraEditor.onEvent(event=>{if(event.type==='simulation'&&event.payload.status==='running')result.push({time:event.payload.frame.time,rate:event.payload.frame.frameRate,dt:event.payload.frame.deltaTime,steps:event.payload.timing?.batchSteps||0});});setTimeout(()=>{off();resolve(result);},600);}));
  assert.ok(samples.length>2);for(let i=1;i<samples.length;i++){assert.equal(samples[i].rate,120);assert.equal(samples[i].dt,1/120);assert.ok(Math.abs(samples[i].time-samples[i-1].time-samples[i].steps/120)<1e-8);}
  const before=await frame();await game.getByLabel('游戏视口',{exact:true}).focus();await game.keyboard.down('KeyD');
  try{await until(async()=>Math.hypot((await frame()).owner.X-before.owner.X,(await frame()).owner.Y-before.owner.Y)>30);}finally{await game.keyboard.up('KeyD');}
  await until(async()=>/\d+ FPS/.test(await game.locator('.preview-performance').innerText()));
  const position=await game.locator('.canvas-host').evaluate(el=>JSON.parse(el.dataset.observerPosition));assert.equal(position.every(Number.isFinite),true);
  await fs.mkdir('test-results',{recursive:true});await game.screenshot({path:'test-results/game-120-fps.png'});
  await game.getByRole('button',{name:'游戏设置',exact:true}).click();assert.equal(await game.getByLabel('帧率上限',{exact:true}).inputValue(),'120');
  const pausedTime=(await frame()).time;await game.getByLabel('帧率上限',{exact:true}).selectOption('90');await game.getByRole('button',{name:'保存设置',exact:true}).click();
  assert.equal((await frame()).time,pausedTime);assert.equal((await frame()).frameRate,90);
  const current=(await frame()).location;
  await until(async()=>{const p=await game.locator('.canvas-host').evaluate(el=>JSON.parse(el.dataset.observerPosition));return Math.hypot(p[0]-current.X,p[1]-current.Y,p[2]-current.Z)<1e-6;});
  await game.getByRole('button',{name:'继续游戏',exact:true}).click();await until(async()=>(await frame()).time>before.time+.1);
  assert.equal((await game.evaluate(()=>window.cameraEditor.game('state'))).settings.fps,90);assert.deepEqual(errors,[]);
  assert.equal((await frame()).deltaTime,1/90);await until(async()=>/90 Hz/.test(await game.locator('.preview-performance').innerText()));
  console.log('PASS: 90/120 matching Lua steps, paused rate changes, latest-pose rendering and logic-rate diagnostics');
 }finally{await app.close();console.log('FPS UI fixture:',temp);}
})().catch(error=>{console.error(error);process.exitCode=1;});
