const {test,before}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {Project,encode}=require('../electron/project.cjs'),{Simulation}=require('../electron/simulation.cjs');
let project;
const rigPath='Assets/CameraAssets/ActionCamera/Player/Dash/Dash.rig';
const options={mode:'game',environment:'city',rigPath};
test('game compiles unsaved gameplay bindings and uses final Lua Target/Add values with smoothing',async()=>{
 const {BINDINGS,PLAN,writeBindings}=require('../electron/postprocessing.cjs');
 const post='Assets/PostProcessingAssets/OwnerVelocity/MovementSpeed.postProcessing',add='Assets/PostProcessingAssets/OwnerVelocity/VelocityX.postProcessing';
 const original=await project.read(post),plan=await project.read(PLAN),bindings=await project.read(BINDINGS),p=JSON.parse(original.text);
 p.Domain='[0,1000]';p.Mode='Target';p.Priority=2;p.Outputs={ExposureCompensation:{Range:'{2}'}};
 const a={...p,Mode:'Add',Priority:0,Outputs:{ExposureCompensation:{Range:'{0.5}'}}};
 const config={Bindings:[{Id:'target',Asset:post,Activation:{Kind:'Always'}},{Id:'add',Asset:add,Activation:{Kind:'Always'}}],Channels:{ExposureCompensation:{Default:0,SmoothTime:.1}}};
 const sim=new Simulation();try{
  await sim.start(project,{[post]:encode(p),[add]:encode(a),[BINDINGS]:writeBindings(bindings.text,config)},{...options,environment:'basic'},false);
  await sim.step(1);assert.ok(sim.frame.postProcessing.ExposureCompensation>0&&sim.frame.postProcessing.ExposureCompensation<2.5);
  await sim.step(120);assert.ok(Math.abs(sim.frame.postProcessing.ExposureCompensation-2.5)<1e-6);
  await sim.step(120);assert.ok(Math.abs(sim.frame.postProcessing.ExposureCompensation-2.5)<1e-6);
  assert.equal(sim.frame.postOffsets,undefined);const time=sim.frame.time;await sim.pause();assert.equal(sim.frame.time,time);
  assert.equal((await project.read(post)).text,original.text);assert.equal((await project.read(PLAN)).text,plan.text);assert.equal((await project.read(BINDINGS)).text,bindings.text);
 }finally{sim.stop();}
});
before(async()=>{
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'camera-game-')),source=process.env.CAMERA_FRAMEWORK_TEST_ROOT||'D:/MyWorks/Lua/CameraFramework';
  await fs.cp(source,path.join(temp,'CameraFramework'),{recursive:true});await fs.cp(path.join(path.dirname(source),'Foundation'),path.join(temp,'Foundation'),{recursive:true});await fs.cp(path.join(path.dirname(source),'InputSystem'),path.join(temp,'InputSystem'),{recursive:true});
  for(const name of ['PlayerEvents','MovementValues'])await fs.cp(path.join(path.dirname(source),'Actor','Player',name+'.lua'),path.join(temp,'Actor','Player',name+'.lua'));
  project=await Project.open(path.join(temp,'CameraFramework'),path.join(temp,'data'),path.resolve('runtime/lua54.exe'));
});
// Explicit steps let these tests exercise event sequencing without wall-clock races.
function action(sim,name){if(['jump','dash'].includes(name)){const key=name==='jump'?'SpaceBar':'LeftShift';sim.input({signals:[{kind:'pressed',name:key},{kind:'released',name:key}]});}else sim.actions.push(name);}
function keys(sim,held){sim.input({signals:Object.entries({forward:'W',back:'S',left:'A',right:'D',run:'Q',walk:'C'}).map(([key,name])=>({kind:held[key]?'pressed':'released',name}))});}

test('procedural lab and seeded exploration use matching terrain, grounded spawn and dialogue target',async()=>{
 for(const environment of ['lab','explore']){
  const s=new Simulation();try{
   await s.start(project,{}, {...options,environment,seed:'Wetland-demo-42',version:1},false);
   assert.equal(s.status,'paused');assert.equal(s.frame.time,0);
   await s.step(120);assert.equal(s.frame.worldKey,`1:${environment}:${environment==='lab'?'camera-lab':'Wetland-demo-42'}`);
   assert.ok(Math.abs(s.frame.owner.Z-88)<.1);
   if(environment==='lab'){assert.equal(s.frame.subject.Z,92);assert.equal(s.frame.canTalk,true);action(s,'dialogue');await s.step(120);assert.equal(s.frame.rigName,'Dialogue');assert.equal(s.frame.npcId,9999);}
   else{assert.equal(s.frame.subject,undefined);assert.equal(s.frame.canTalk,false);action(s,'dialogue');await s.step(120);assert.equal(s.frame.rigName,'Default');assert.equal(s.frame.npcId,undefined);}
   action(s,'close-dialogue');await s.step(120);keys(s,{right:true});await s.step(120);
   assert.ok(s.frame.owner.Y>500);assert.ok(Math.abs(s.frame.owner.Z-88)<.1);
  }finally{s.stop();}
 }
});
test('exploration restores the saved grounded pose without spawning an NPC',async()=>{
 const s=new Simulation();try{await s.start(project,{}, {...options,environment:'explore',seed:'saved',version:1,pose:{position:{X:0,Y:500,Z:88},heading:90}},false);assert.deepEqual(s.frame.owner,{X:0,Y:500,Z:88});assert.equal(s.frame.heading,90);assert.equal(s.frame.subject,undefined);await s.step(60);assert.equal(s.frame.owner.Y,500);assert.equal(s.frame.canTalk,false);}finally{s.stop();}
});
test('play does not activate the edited rig; movement selects real rigs and leaves NPC stationary',async()=>{
  const s=new Simulation();try{
    await s.start(project,{}, {...options,environment:'basic'},false);const npc=structuredClone(s.frame.subject);await s.step(120);await s.step(120);assert.equal(s.frame.rigName,'Default');assert.deepEqual(s.frame.events,[]);
    keys(s,{right:true});await s.step(90);assert.equal(s.frame.rigName,'Jog');assert.ok(s.frame.owner.Y>300);assert.deepEqual(s.frame.subject,npc);
    keys(s,{right:true,run:true});await s.step(90);assert.equal(s.frame.rigName,'Run');assert.ok(s.frame.speed>490);
    keys(s,{right:true,walk:true});await s.step(90);assert.equal(s.frame.rigName,'Walk');assert.ok(Math.abs(s.frame.speed-150)<1);
    s.input({clear:true});await s.step(120);assert.equal(s.frame.rigName,'Default');assert.equal(s.frame.speed,0);
    assert.equal(s.frame.events.filter(e=>e.event==='JogStarted').length,s.frame.events.filter(e=>e.event==='JogEnded').length); // real axis smoothing may briefly return to Jog after releasing the gait modifier
  }finally{s.stop();}
});
test('jump, landing and dash follow ability lifetime, reject midair jump and stop at NPC body',async()=>{
  const s=new Simulation();try{
    await s.start(project,{}, {...options,environment:'basic'},false);const z=s.frame.owner.Z;action(s,'jump');await s.step(10);assert.equal(s.frame.grounded,false);assert.ok(s.frame.owner.Z>z+50);assert.equal(s.frame.ability,'Jump');
    action(s,'jump');await s.step(80);assert.equal(s.frame.grounded,true);assert.ok(Math.abs(s.frame.owner.Z-z)<1);assert.equal(s.frame.events.filter(e=>e.event==='JumpStarted').length,1);assert.equal(s.frame.events.filter(e=>e.event==='JumpEnded').length,1);
    action(s,'dash');await s.step(6);assert.equal(s.frame.ability,'Dash');await s.step(80);assert.ok(s.frame.owner.X<183,'solid NPC blocks the dash');assert.equal(s.frame.ability,'Idle');assert.ok(s.frame.events.some(e=>e.event==='DashEnded'));
  }finally{s.stop();}
});
test('NPC dialogue uses 9999 draft, remains open, suppresses movement and closes while paused without advancing time',async()=>{
  const p='Assets/CameraAssets/InteractiveCamera/Player/Dialogue/ValueAssets/Dialogue_9999.value',data=JSON.parse((await project.read(p)).text);data.Channels.Dist.Value=320;
  const s=new Simulation();try{
    await s.start(project,{[p]:encode(data)},options,false);const owner=structuredClone(s.frame.owner);action(s,'dialogue');action(s,'dialogue');await s.step(120);await s.step(120);
    assert.equal(s.frame.dialogue,true);assert.equal(s.frame.rigName,'Dialogue');assert.equal(s.frame.target.Dist,320);assert.equal(s.frame.events.filter(e=>e.event==='DialogueStarted').length,1);assert.equal(s.frame.events[0].id,9999);
    keys(s,{forward:true,run:true});action(s,'jump');action(s,'dash');await s.step(90);assert.deepEqual(s.frame.owner,owner);
    const time=s.frame.time;await s.input({action:'close-dialogue'});assert.equal(s.frame.dialogue,false);assert.equal(s.frame.time,time);assert.equal(s.status,'paused');
    s.input({clear:true});await s.step(120);assert.equal(s.frame.rigName,'Default');assert.equal(s.frame.dialogueClosing,false);assert.equal(s.frame.events.filter(e=>e.event==='DialogueEnded').length,1);
    action(s,'dialogue');await s.step(90);assert.equal(s.frame.rigName,'Dialogue');assert.equal(s.frame.events.filter(e=>e.event==='DialogueStarted').length,2);
  }finally{s.stop();}
});
test('dialogue waits for an action handoff, supports immediate cancellation and rejects distant interaction',async()=>{
  const s=new Simulation();try{
    await s.start(project,{},options,false);keys(s,{right:true});await s.step(5);assert.equal(s.frame.ability,'Jog');s.input({clear:true});action(s,'dialogue');await s.step(120);assert.equal(s.frame.rigName,'Dialogue');
    action(s,'close-dialogue');await s.step(120);action(s,'dialogue');action(s,'close-dialogue');await s.step(120);assert.equal(s.frame.dialogue,false);assert.equal(s.frame.rigName,'Default');
    keys(s,{right:true,run:true});await s.step(120);s.input({clear:true});assert.equal(s.frame.canTalk,false);action(s,'dialogue');await s.step(60);assert.equal(s.frame.dialogue,false);
  }finally{s.stop();}
});
test('camera inputs change real output and map walls obstruct movement even when camera collision is off',async()=>{
  const s=new Simulation();try{
    await s.start(project,{}, {...options,environment:'city-corner',mapCollision:false},false);s.input({signals:[{kind:'changed',name:'MouseX',value:80},{kind:'changed',name:'MouseY',value:-20}]});await s.step(60);assert.ok(Math.abs(s.frame.output.Yaw)>1);assert.ok(Math.abs(s.frame.output.Pitch)>1);
    keys(s,{back:true,run:true});let travelled=0,previous=s.frame.owner;for(let i=0;i<8;i++){await s.step(60);travelled+=Math.hypot(s.frame.owner.X-previous.X,s.frame.owner.Y-previous.Y);previous=s.frame.owner;}
    assert.ok(travelled<3900,'static geometry must block at least part of the attempted 4000 cm movement');assert.ok(s.frame.owner.Z>-1000);
  }finally{s.stop();}
});

test('real InputSystem honors workspace rebinding and scaling instead of hardcoded physical keys',async()=>{
 const file=path.join(project.workspaceRoot,'InputSystem/MyIMC/Definition/Definitions/Character.json'),original=await fs.readFile(file,'utf8');
 const config=JSON.parse(original);config.Mappings.MoveRight.KeyName='[]+[L]';config.Mappings.MoveRight.TransformerMeta.Scale=.25;config.Mappings.MoveRight.SmoothingMeta.bEnabled=false;
 const s=new Simulation();try{
  await fs.writeFile(file,JSON.stringify(config));await s.start(project,{}, {...options,environment:'basic'},false);
  assert.equal(s.frame.inputRuntime,'InputSystem');assert.ok(s.frame.activeIMCs.includes('IdleCamera'));
  s.input({signals:[{kind:'pressed',name:'D'}]});await s.step(60);assert.equal(s.frame.owner.Y,0);
  s.input({signals:[{kind:'pressed',name:'L'}]});await s.step(60);assert.ok(Math.abs(s.frame.owner.Y-70)<.01);
  const time=s.frame.time;await Promise.all([s.pause(),s.pause(),s.pause()]);assert.equal(s.frame.time,time);const y=s.frame.owner.Y;await s.step(120);assert.equal(s.frame.owner.Y,y);assert.equal(s.frame.speed,0);
 }finally{s.stop();await fs.writeFile(file,original);}
});
test('camera uses real IMC response and transformer, malformed definitions fail before play',async()=>{
 const file=path.join(project.workspaceRoot,'InputSystem/MyIMC/Definition/Definitions/IdleCamera.json'),original=await fs.readFile(file,'utf8');
 const config=JSON.parse(original),m=config.Mappings.LookTurn;m.SmoothingMeta.bEnabled=false;m.ResponseMeta.bEnabled=false;m.TransformerMeta.Scale=2;
 // This test isolates the IMC transform from editable position-dependent sensitivity curves.
 const inputPath='Assets/CameraAssets/IdleCamera/Player/Default/InputAssets/Default_User.input';
 const input=JSON.parse((await project.read(inputPath)).text),weight=.2;
 input.SensitivityAssets=[];input.Channels.Yaw.DefaultSensitivity=weight;
 const drafts={[inputPath]:encode(input)};
 const s=new Simulation();try{
  await fs.writeFile(file,JSON.stringify(config));await s.start(project,drafts, {...options,environment:'basic'},false);
  const yaw=s.frame.target.Yaw;s.input({signals:[{kind:'changed',name:'MouseX',value:10}]});await s.step(1);assert.ok(Math.abs(s.frame.target.Yaw-yaw-10*2*weight)<.01);
  await fs.writeFile(file,'{');await assert.rejects(()=>s.start(project,drafts, {...options,environment:'basic'},false));assert.equal(s.status,'error');assert.equal(s.process,null);
 }finally{s.stop();await fs.writeFile(file,original);}
});

test('movement multiplier changes locomotion, preserves dash and simulation time, and applies while paused',async()=>{
 const a=new Simulation(),b=new Simulation();try{
  await a.start(project,{}, {...options,environment:'basic'},false);
  await b.start(project,{}, {...options,environment:'basic',movementMultiplier:2},false);
  keys(a,{right:true});keys(b,{right:true});await a.step(30);await b.step(30);
  assert.ok(Math.abs(b.frame.speed/a.frame.speed-2)<.001);assert.equal(a.frame.time,b.frame.time);
  await b.pause();const time=b.frame.time;await b.setMovementMultiplier(.5);assert.equal(b.frame.time,time);assert.equal(b.frame.movementMultiplier,.5);
  keys(b,{right:true,run:true});await b.step(30);assert.ok(Math.abs(b.frame.speed-250)<.01);
  action(a,'dash');action(b,'dash');await a.step(2);await b.step(2);assert.ok(Math.abs(a.frame.speed-1000)<.01);assert.ok(Math.abs(b.frame.speed-1000)<.01);
  await assert.rejects(()=>b.setMovementMultiplier(10));
 }finally{a.stop();b.stop();}
});
test('live scheduler emits every 1/60 second Lua step and measures cost',async()=>{
 const times=[],s=new Simulation(state=>{if(state.status==='running'&&state.frame)times.push(state.frame.time);});
 try{await s.start(project,{}, {...options,environment:'basic'});await new Promise(r=>setTimeout(r,650));await s.pause();
  const unique=times.filter((v,i)=>!i||v!==times[i-1]);assert.ok(unique.length>12);
  for(let i=1;i<unique.length;i++)assert.ok(Math.abs(unique[i]-unique[i-1]-1/60)<1e-9);
  assert.ok(s.timing.stepMs>=0);console.log('Live Lua timing:',s.timing,'frames:',unique.length);
 }finally{s.stop();}
});

test('saved NPC actors spawn in exploration, nearest reference drives Lua dialogue and deleted actors stay absent',async()=>{
 const npcs=[{id:'far',name:'Far',position:[1000,0,88],heading:90,dialogueId:9999},{id:'near',name:'Near',position:[150,0,88],heading:180,dialogueId:9999}],sim=new Simulation();
 try{await sim.start(project,{}, {...options,environment:'explore',seed:'scene-npcs',version:1,npcs},false);assert.equal(sim.frame.npcs.length,2);assert.equal(sim.frame.subject.X,150);assert.equal(sim.frame.canTalk,true);action(sim,'dialogue');await sim.step(120);assert.equal(sim.frame.rigName,'Dialogue');assert.equal(sim.frame.npcId,9999);assert.equal(sim.frame.subject.X,150);assert.equal(sim.frame.events.find(e=>e.event==='DialogueStarted').id,9999);
 await sim.start(project,{}, {...options,environment:'lab',npcs:[]},false);assert.equal(sim.frame.subject,undefined);assert.equal(sim.frame.canTalk,false);
 await assert.rejects(()=>sim.start(project,{}, {...options,environment:'lab',npcs:[{...npcs[0],dialogueId:123456}]},false));
 }finally{sim.stop();}
});
