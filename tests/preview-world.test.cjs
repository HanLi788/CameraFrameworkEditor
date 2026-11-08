const {test,before}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const {Project,encode}=require('../electron/project.cjs'),{Simulation}=require('../electron/simulation.cjs');
let project;
before(async()=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'camera-presets-')),source=process.env.CAMERA_FRAMEWORK_TEST_ROOT||'D:/MyWorks/Lua/CameraFramework';await fs.cp(source,path.join(dir,'CameraFramework'),{recursive:true});await fs.cp(path.join(path.dirname(source),'Foundation'),path.join(dir,'Foundation'),{recursive:true});await fs.cp(path.join(path.dirname(source),'InputSystem'),path.join(dir,'InputSystem'),{recursive:true});for(const name of ['PlayerEvents','MovementValues'])await fs.cp(path.join(path.dirname(source),'Actor','Player',name+'.lua'),path.join(dir,'Actor','Player',name+'.lua'));project=await Project.open(path.join(dir,'CameraFramework'),path.join(dir,'data'),path.resolve('runtime/lua54.exe'));});
test('continuous map sweep handles faces, edges, initial overlap, tangencies and misses',()=>{
 const script=`local C=dofile('electron/preview-collision.lua')
local world={nodes={{b={0,-100,-100,0,100,100},s=1,n=1}},triangles={{0,-100,-100,0,100,-100,0,0,100,1}}}
local function v(x,y,z) return {X=x,Y=y,Z=z} end
local function near(actual,expected) assert(actual and math.abs(actual-expected)<1e-6,tostring(actual)..' expected '..expected) end
near(C.Trace(world,v(-100,0,0),v(100,0,0),10),90)
near(C.Trace(world,v(100,0,0),v(-100,0,0),10),90)
near(C.Trace(world,v(-100,105,-100),v(100,105,-100),10),100-math.sqrt(75))
near(C.Trace(world,v(-100,110,-100),v(100,110,-100),10),100)
near(C.Trace(world,v(5,0,0),v(5,0,0),10),0)
near(C.Trace(world,v(-100,0,0),v(100,0,0),0),100)
assert(C.Trace(world,v(-100,200,0),v(100,200,0),10)==nil)
assert(C.Trace(world,v(11,-10,0),v(11,10,0),10)==nil)
print('sweep ok')`;
 const result=spawnSync(path.resolve('runtime/lua54.exe'),['-'],{input:script,encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/sweep ok/);
});
test('downloaded map geometry drives real occlusion and stationary presets are deterministic',async()=>{
 const rig='Assets/CameraAssets/IdleCamera/Player/Default/Default.rig',range='Assets/CameraAssets/IdleCamera/Player/Default/RangeAssets/Default_Default.range',original=await project.read(range),data=JSON.parse(original.text);data.Channels.Dist.Min=50;
 const sim=new Simulation();try{
  await sim.start(project,{[range]:encode(data)},{rigPath:rig,environment:'city-corner',mapCollision:false},false);await sim.step(120);const free=sim.frame.output.Dist;
  await sim.start(project,{[range]:encode(data)},{rigPath:rig,environment:'city-corner',mapCollision:true},false);await sim.step(120);assert.ok(sim.frame.output.Dist<free-10,JSON.stringify({free,blocked:sim.frame.output.Dist}));assert.ok(sim.frame.output.Dist>=50);
  assert.deepEqual(sim.frame.owner,{X:-500,Y:1000,Z:114});assert.equal((await project.read(range)).text,original.text);
 }finally{sim.stop();}
});
test('patrol updates owner, target and heading together and resets to the initial pose',async()=>{
 const sim=new Simulation();try{
  await sim.start(project,{}, {rigPath:'Assets/CameraAssets/IdleCamera/Player/Default/Default.rig',environment:'city',motion:'patrol',speed:180},false);const start=structuredClone(sim.frame);await sim.step(60);assert.ok(Math.abs(sim.frame.owner.Y-180)<1e-7);assert.equal(sim.frame.owner.X,0);assert.equal(sim.frame.heading,90);assert.equal(sim.frame.subject.X-sim.frame.owner.X,250);assert.equal(sim.frame.subject.Y,sim.frame.owner.Y);assert.ok(Math.abs(sim.frame.location.Y-start.location.Y)>50);
  sim.stop();assert.deepEqual(sim.frame,start);
  await assert.rejects(()=>sim.start(project,{}, {rigPath:start.rigPath,environment:'unknown'},false),/地图/);
 }finally{sim.stop();}
});
test('bundled downloads retain source provenance and expected animation clips',async()=>{
 const crypto=require('node:crypto'),sources=JSON.parse(await fs.readFile('public/preview/sources.json','utf8'));for(const record of sources){const bytes=await fs.readFile(path.join('public/preview',record.file));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),record.sha256);}
 const bytes=await fs.readFile('public/preview/characters/robot/RobotExpressive.glb'),json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());for(const name of ['Idle','Walking','Running'])assert.ok(json.animations.some(a=>a.name===name));
 const city=JSON.parse(await fs.readFile('public/preview/maps/city/scene.gltf','utf8'));assert.match(city.asset.extras.license,/CC-BY-4.0/);
});
