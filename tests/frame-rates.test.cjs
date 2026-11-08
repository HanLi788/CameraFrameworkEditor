const {test,before}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {Project,encode}=require('../electron/project.cjs'),{Simulation}=require('../electron/simulation.cjs');
let project;
const rates=[30,60,90,120],rigPath='Assets/CameraAssets/IdleCamera/Player/Default/Default.rig';
before(async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'camera-logic-fps-')),source=process.env.CAMERA_FRAMEWORK_TEST_ROOT||'D:/MyWorks/Lua/CameraFramework';
 for(const name of ['CameraFramework','Foundation','InputSystem'])await fs.cp(path.join(path.dirname(source),name),path.join(temp,name),{recursive:true});
 for(const name of ['PlayerEvents','MovementValues'])await fs.cp(path.join(path.dirname(source),'Actor/Player',name+'.lua'),path.join(temp,'Actor/Player',name+'.lua'));
 project=await Project.open(temp,path.join(temp,'data'),path.resolve('runtime/lua54.exe'));
});
async function steps(sim,count){while(count){const batch=Math.min(120,count);await sim.step(batch);count-=batch;}}
test('real input, movement and camera consume the selected fixed step at all four rates',async()=>{
 for(const frameRate of rates){const sim=new Simulation();try{
  await sim.start(project,{}, {mode:'game',environment:'basic',rigPath,frameRate},false);
  const initial=sim.frame.owner;sim.input({signals:[{kind:'pressed',name:'D'}]});await steps(sim,frameRate);
  assert.equal(sim.frame.frameRate,frameRate);assert.ok(Math.abs(sim.frame.deltaTime-1/frameRate)<1e-12);assert.ok(Math.abs(sim.frame.time-1)<1e-9);
  const distance=Math.hypot(sim.frame.owner.X-initial.X,sim.frame.owner.Y-initial.Y);
  assert.ok(Math.abs(distance-280)<=280/frameRate+1e-6,`${frameRate}Hz moved ${distance}`);assert.equal(sim.frame.rigName,'Jog');
  sim.input({signals:[{kind:'released',name:'D'}]});await sim.step(1);
  sim.input({signals:[{kind:'pressed',name:'SpaceBar'},{kind:'released',name:'SpaceBar'}]});await steps(sim,frameRate*2);
  assert.equal(sim.frame.grounded,true);assert.ok(Math.abs(sim.frame.owner.Z-initial.Z)<1);
  assert.equal(sim.frame.events.filter(e=>e.event==='JumpStarted').length,1);assert.equal(sim.frame.events.filter(e=>e.event==='JumpEnded').length,1);
 }finally{sim.stop();}}
});
test('camera enter/hold/exit durations follow elapsed seconds at 30/60/90/120Hz',async()=>{
 const dialogue='Assets/CameraAssets/InteractiveCamera/Player/Dialogue/Dialogue.rig',rig=JSON.parse((await project.read(dialogue)).text);
 const inputs=await Promise.all(rig.Processors.Input.Assets.map(file=>project.read(file).then(d=>JSON.parse(d.text))));
 const enter=inputs.find(a=>a.Phase==='Enter').Duration,exit=inputs.find(a=>a.Phase==='Exit').Duration;
 for(const frameRate of rates){const sim=new Simulation();try{
  await sim.start(project,{}, {rigPath:dialogue,frameRate},false);await steps(sim,Math.ceil((enter+exit+2)*frameRate)+5);
  const events=sim.frame.events;assert.deepEqual(events.map(e=>e.phase),['Entering','Holding','Exiting','Idle']);
  assert.ok(Math.abs(events[1].time-events[0].time-enter)<=2/frameRate+1e-8);
  assert.ok(Math.abs(events[2].time-events[1].time-2)<=1/frameRate+1e-8);
  assert.ok(Math.abs(events[3].time-events[2].time-exit)<=2/frameRate+1e-8);
 }finally{sim.stop();}}
});
test('postprocessing smoothing reaches the same elapsed-time response at every rate',async()=>{
 const {BINDINGS,writeBindings}=require('../electron/postprocessing.cjs'),asset='Assets/PostProcessingAssets/OwnerVelocity/MovementSpeed.postProcessing';
 const definition=JSON.parse((await project.read(asset)).text),bindings=await project.read(BINDINGS);
 Object.assign(definition,{Domain:'[0,1000]',Mode:'Target',Priority:1,Outputs:{ExposureCompensation:{Range:'{2.5}'}}});
 const config={Bindings:[{Id:'rate-test',Asset:asset,Activation:{Kind:'Always'}}],Channels:{ExposureCompensation:{Default:0,SmoothTime:.1}}};
 for(const frameRate of rates){const sim=new Simulation();try{
  await sim.start(project,{[asset]:encode(definition),[BINDINGS]:writeBindings(bindings.text,config)},{mode:'game',environment:'basic',rigPath,frameRate},false);
  await steps(sim,frameRate/2);assert.ok(Math.abs(sim.frame.postProcessing.ExposureCompensation-2.5*(1-Math.exp(-5)))<1e-6);
 }finally{sim.stop();}}
});
test('paused rate changes preserve time, pose and rig, then use the new delta without restarting',async()=>{
 const sim=new Simulation();try{
  await sim.start(project,{}, {mode:'game',environment:'basic',rigPath,frameRate:60},false);
  sim.input({signals:[{kind:'pressed',name:'D'}]});await sim.step(30);const before=structuredClone(sim.frame);
  await sim.setFrameRate(120);assert.equal(sim.frame.time,before.time);assert.deepEqual(sim.frame.owner,before.owner);assert.equal(sim.frame.rigName,before.rigName);
  await sim.step(60);assert.ok(Math.abs(sim.frame.time-1)<1e-9);await sim.setFrameRate(90);await sim.step(90);assert.ok(Math.abs(sim.frame.time-2)<1e-9);
  await assert.rejects(()=>sim.setFrameRate(144));assert.equal(sim.frame.frameRate,90);
  sim.resume();await assert.rejects(()=>sim.setFrameRate(60));await sim.pause();
 }finally{sim.stop();}
});
test('a stalled live scheduler catches up in bounded batches rather than dropping elapsed time',async()=>{
 const samples=[],sim=new Simulation(state=>{if(state.status==='running'&&state.timing)samples.push({time:state.frame.time,...state.timing});});
 try{
  await sim.start(project,{}, {mode:'game',environment:'basic',rigPath,frameRate:120});
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,150);
  await new Promise(resolve=>setTimeout(resolve,250));await sim.pause();
  assert.ok(samples.some(sample=>sample.batchSteps>1));assert.ok(samples.every(sample=>sample.batchSteps<=8));
  assert.ok(samples.some(sample=>sample.lateMs>0));assert.ok(sim.frame.time>.15);
  assert.equal(sim.timing.targetHz,120);assert.ok(Number.isFinite(sim.timing.actualHz));
 }finally{sim.stop();}
});
