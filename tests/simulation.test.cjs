const {test,before}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {Project,encode}=require('../electron/project.cjs');
const {Simulation}=require('../electron/simulation.cjs');
let project,snapshot;
before(async()=>{const temp=await fs.mkdtemp(path.join(os.tmpdir(),'camera-simulation-'));const source=process.env.CAMERA_FRAMEWORK_TEST_ROOT||'F:/MyWorks/Lua/CameraFramework';await fs.cp(source,path.join(temp,'CameraFramework'),{recursive:true});await fs.cp(path.join(path.dirname(source),'Foundation'),path.join(temp,'Foundation'),{recursive:true});project=await Project.open(path.join(temp,'CameraFramework'),path.join(temp,'data'),path.resolve('runtime/lua54.exe'));snapshot=await project.snapshot();});
test('real framework initializes all 12 channels from idle and executes enter, two-second hold and exit',async()=>{
  const sim=new Simulation();try{
    await sim.start(project,{}, {rigId:'Rig.InteractiveCamera.Player.Dialogue'},false);
    const d=snapshot.assets.find(a=>a.id==='Rig.IdleCamera.Default').data.Defaults;
    const expected={...d,'AnchorLocOffset.X':d.AnchorLocOffset[0],'AnchorLocOffset.Y':d.AnchorLocOffset[1],'AnchorLocOffset.Z':d.AnchorLocOffset[2]};delete expected.AnchorLocOffset;
    assert.deepEqual(sim.frame.output,expected);assert.equal(Object.keys(sim.frame.output).length,12);
    await sim.step(120);assert.equal(sim.frame.phase,'Holding');assert.equal(sim.frame.target.Dist,200);assert.ok(Math.abs(sim.frame.output.Dist-200)<1);
    await sim.step(120);assert.equal(sim.frame.phase,'Idle');const events=sim.frame.events;assert.deepEqual(events.map(e=>e.phase),['Entering','Holding','Exiting','Idle']);assert.ok(Math.abs(events[2].time-events[1].time-2)<1e-8);
    assert.notEqual(sim.frame.location.X,undefined);assert.ok(Number.isFinite(sim.frame.up.Z));
  }finally{sim.stop();}
});
test('paused simulation freezes time, resume continues and stop resets to initial state',async()=>{
  const sim=new Simulation();try{await sim.start(project,{}, {rigId:'Rig.ActionCamera.Player.Run'});await new Promise(r=>setTimeout(r,150));await sim.pause();const time=sim.frame.time;assert.ok(time>0);await new Promise(r=>setTimeout(r,120));assert.equal(sim.frame.time,time);sim.resume();await new Promise(r=>setTimeout(r,100));await sim.pause();assert.ok(sim.frame.time>time);sim.stop();assert.equal(sim.frame.time,0);assert.equal(sim.process,null);assert.equal(sim.status,'stopped');}finally{sim.stop();}
});
test('current asset drafts are used and remain frozen throughout a run',async()=>{
  const input=snapshot.assets.find(a=>a.id==='Transition.Player.InteractiveCamera.Dialogue.Enter');const target=snapshot.assets.find(a=>a.id===input.data.ValueAssets[0].AssetId);
  const data=structuredClone(target.data);data.Channels.Dist.Value=280;const drafts={[target.path]:encode(data)};const sim=new Simulation();
  try{await sim.start(project,drafts,{rigId:'Rig.InteractiveCamera.Player.Dialogue'},false);await sim.step(90);assert.equal(sim.frame.target.Dist,280);data.Channels.Dist.Value=350;drafts[target.path]=encode(data);await sim.step(15);assert.equal(sim.frame.target.Dist,280);await sim.start(project,drafts,{rigId:'Rig.InteractiveCamera.Player.Dialogue'},false);await sim.step(90);assert.equal(sim.frame.target.Dist,350);assert.equal(JSON.parse((await project.read(target.path)).text).Channels.Dist.Value,target.data.Channels.Dist.Value);}finally{sim.stop();}
});
test('explicit interactive ID resolves the selected target and unknown IDs fail without a running child',async()=>{
  const input=snapshot.assets.find(a=>a.id==='Transition.Player.InteractiveCamera.Dialogue.Enter');const target=snapshot.assets.find(a=>a.id===input.data.ValueAssets[1].AssetId);const data=structuredClone(target.data);data.Channels.Dist.Value=320;
  const sim=new Simulation();try{await sim.start(project,{[target.path]:encode(data)},{rigId:input.data.Id.replace('Transition.Player.InteractiveCamera.Dialogue.Enter','Rig.InteractiveCamera.Player.Dialogue'),id:10002},false);await sim.step(120);assert.equal(sim.frame.target.Dist,320);await assert.rejects(()=>sim.start(project,{}, {rigId:'Rig.InteractiveCamera.Player.Dialogue',id:99999},false),/Id/);assert.equal(sim.status,'error');assert.equal(sim.process,null);}finally{sim.stop();}
});
test('battle and idle spaces use real pipelines and invalid drafts prevent playback',async()=>{
  const sim=new Simulation();try{await sim.start(project,{}, {rigId:'Rig.BattleCamera.Player.LockTarget'},false);await sim.step(120);assert.equal(sim.frame.phase,'Holding');await sim.step(120);assert.equal(sim.frame.phase,'Idle');await sim.start(project,{}, {rigId:'Rig.IdleCamera.Default'},false);await sim.step(120);assert.equal(sim.frame.phase,'Idle');assert.equal(sim.frame.time>1,true);const asset=snapshot.assets.find(a=>a.type==='Value');await assert.rejects(()=>sim.start(project,{[asset.path]:'invalid'}, {rigId:'Rig.ActionCamera.Player.Dash'},false),/校验/);assert.equal(sim.status,'error');assert.equal(sim.process,null);}finally{sim.stop();}
});
test('stopping while preparing cancels activation and leaves no timer or child',async()=>{const sim=new Simulation();const pending=sim.start(project,{}, {rigId:'Rig.ActionCamera.Player.Dash'});sim.stop();await pending;assert.equal(sim.status,'stopped');assert.equal(sim.process,null);});

test('preview collision drives the real occlusion stage while respecting configured minimum distance',async()=>{
  const range=snapshot.assets.find(a=>a.id==='Range.IdleCamera.Default'),data=structuredClone(range.data);data.Channels.Dist.Min=100;const sim=new Simulation();try{
    await sim.start(project,{[range.path]:encode(data)},{rigId:'Rig.IdleCamera.Default',obstacle:true},false);await sim.step(120);assert.ok(Math.abs(sim.frame.target.Dist-130)<.01);assert.ok(sim.frame.output.Dist>=100);assert.ok(sim.frame.output.Dist<140);
    data.Channels.Dist.Min=200;await sim.start(project,{[range.path]:encode(data)},{rigId:'Rig.IdleCamera.Default',obstacle:true},false);await sim.step(120);assert.equal(sim.frame.target.Dist,200);
  }finally{sim.stop();}
});
