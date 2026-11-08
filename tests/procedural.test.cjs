const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {generate,normalize}=require('../electron/procedural-world.cjs'),{getWorld}=require('../electron/world-service.cjs');
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
test('seed + version reproduce geometry, ecology, water and collision; lab ignores seed',()=>{
 const a=generate({environment:'explore',seed:'原野-42'}),b=generate({environment:'explore',seed:'原野-42'}),c=generate({environment:'explore',seed:'原野-43'});
 assert.equal(digest(a),digest(b));assert.notEqual(digest(a.world.boxes),digest(c.world.boxes));assert.equal(digest(generate({environment:'lab',seed:'a'})),digest(generate({environment:'lab',seed:'b'})));
 assert.throws(()=>normalize({environment:'explore',seed:' '}),/种子/);assert.throws(()=>normalize({environment:'explore',seed:'x'.repeat(65)}),/种子/);assert.throws(()=>normalize({version:99}),/版本/);
});
test('generated maps keep spawn, guide and crossing paths dry with bounded geometry budgets',()=>{
 for(const seed of ['0','1','-1','湖泊','4294967295','Camera-2026']){
  const {world:w,collision:c}=generate({environment:'explore',seed});
  assert.ok(w.boxes.length<1800);assert.ok(c.triangles.length<20000);assert.equal(c.meshes.length,w.boxes.length);assert.ok(w.water.some(t=>t.kind==='lake'));assert.ok(w.water.some(t=>t.kind==='swamp'));
  const terrain=w.boxes.filter(b=>b.name.startsWith('terrain'));
  const ground=(x,y)=>terrain.find(b=>x>=b.x-b.w/2&&x<b.x+b.w/2&&y>=b.y-b.d/2&&y<b.y+b.d/2);
  for(let x=-4;x<=44;x+=2)assert.equal(ground(x,0).z+ground(x,0).h,0);
  for(const [x,y] of [[0,0],[2.5,1.6]]){assert.equal(ground(x,y).z+ground(x,y).h,0);assert.equal(w.water.some(t=>Math.abs(t.x-x)<2&&Math.abs(t.y-y)<2),false);}
  for(const t of c.triangles)assert.ok(Number.isInteger(t[9])&&t[9]>0&&t[9]<=w.boxes.length);
 }
 const lab=generate({environment:'lab'}).world;assert.ok(lab.boxes.some(b=>b.shape==='ramp'));assert.ok(lab.boxes.some(b=>b.name==='passage-wall'));assert.equal(lab.boxes.filter(b=>b.name.startsWith('step-')).length,6);
});
test('background generation deduplicates concurrent requests and survives eviction',async()=>{
 const options={environment:'explore',seed:'worker-42'},start=performance.now();const [a,b]=await Promise.all([getWorld(options),getWorld(options)]);assert.strictEqual(a,b);
 const hash=digest(a);await getWorld({environment:'lab'});await getWorld({environment:'explore',seed:'other'});assert.equal(digest(await getWorld(options)),hash);console.log('Worker generation plus cache checks:',Math.round(performance.now()-start),'ms');
});
test('integer-coordinate sweeps do not overflow and invent floors outside a triangle',()=>{
 const {spawnSync}=require('node:child_process'),path=require('node:path');
 const lua=`local C=dofile('electron/preview-collision.lua')
local world={nodes={{b={-800,-400,-300,400,400,0},s=1,n=3}},triangles={{-800,0,0,-400,0,0,-400,400,0,1},{-400,-400,0,400,-400,0,400,400,0,2},{-400,-400,0,400,400,0,-400,400,0,2}}}
local hit,index=C.Trace(world,{X=0,Y=0,Z=188},{X=0,Y=0,Z=-162},0,true)
assert(math.abs(hit-188)<1e-6,tostring(hit));assert(index==2)
local miss=C.Trace({nodes={{b={-800,-400,-300,400,400,0},s=1,n=1}},triangles={world.triangles[1]}},{X=0,Y=0,Z=188},{X=0,Y=0,Z=-162},0,true)
assert(miss==nil,tostring(miss))`;
 const result=spawnSync(path.resolve('runtime/lua54.exe'),['-'],{input:lua,encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);
});
