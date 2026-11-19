const {test,before}=require('node:test'),assert=require('node:assert/strict');
const {fixture,referenceFor,readReference}=require('./framework-fixture.cjs');
const {encode}=require('../electron/project.cjs');
let project;
const base='Assets/GameplayCameraSystem/CameraAssets/ActionCamera/Run/';
before(async()=>{project=await fixture();});

test('all rigs expose indexed input blends with navigable typed source references',async()=>{
 const snapshot=await project.snapshot(),{blendUsers,blendProblems}=await import('../src/inputBlend.mjs');
 const blends=snapshot.assets.filter(a=>a.type==='InputBlend'),rigs=snapshot.assets.filter(a=>a.type==='Rig');
 assert.equal(blends.length,rigs.length);assert.equal(blends.length,22);assert.deepEqual(snapshot.issues,[]);
 for(const blend of blends){
  const users=blendUsers(snapshot.assets,blend.path);assert.equal(users.length,1);
  assert.deepEqual(blendProblems(blend.data,snapshot.assets,users),[]);
  assert.equal(blend.refs.length,blend.data.Rows.length);
  assert.ok(blend.refs.every(ref=>['Input','TransitionInput'].includes(ref.type)&&snapshot.assets.some(a=>a.path===ref.path)));
 }
 assert.deepEqual((await project.validate()).issues,[]);
});

test('literal zero negative and amplified weights round trip without normalizing columns',async()=>{
 const file=base+'InputBlendAssets/Run_Default.inputBlend',doc=await project.read(file),data=JSON.parse(doc.text);
 for(const [index,value] of [0,-2,0.5,3].entries())data.Rows[index].Weights.RotationYaw=value;
 const saved=await project.save({...doc,text:encode(data)});
 assert.deepEqual(JSON.parse(saved.text).Rows.map(row=>row.Weights.RotationYaw),[0,-2,0.5,3]);
 const {weightError}=await import('../src/inputBlend.mjs');
 for(const value of [0,-2,.5,3,1e100])assert.equal(weightError('',value),'');
 for(const value of [NaN,Infinity,-Infinity,undefined,null])assert.ok(weightError('',value));
 await project.save({...saved,text:doc.text});
});

test('saving incomplete mismatched or nonfinite blend cells leaves the source unchanged',async()=>{
 const file=base+'InputBlendAssets/Run_Default.inputBlend',doc=await project.read(file),original=JSON.parse(doc.text);
 for(const change of [d=>delete d.Rows[0].Weights.FOV,d=>d.Rows[0].Weights.FOV=null,d=>d.Rows[0].Weights.FOV='1',d=>d.Rows.push(d.Rows[0]),d=>d.Rows.pop(),d=>d.Channels.AnchorLocOffset.Type='Scalar']){
  const data=structuredClone(original);change(data);
  await assert.rejects(()=>project.save({...doc,text:encode(data)}));assert.equal((await project.read(file)).text,doc.text);
 }
});

test('syncing changed rig inputs preserves contributions and validates the combined draft',async()=>{
 const snapshot=await project.snapshot(),{synchronizeBlend,blendProblems,blendChannels}=await import('../src/inputBlend.mjs');
 const rig=snapshot.assets.find(a=>a.path===base+'Run.rig'),blend=snapshot.assets.find(a=>a.path===base+'InputBlendAssets/Run_Default.inputBlend');
 const draft=structuredClone(rig);draft.data.Processors.Input.Assets=[];
 const configured=structuredClone(blend.data);configured.Rows.forEach(row=>row.Weights.FOV=-.25);
 assert.ok(blendProblems(configured,snapshot.assets,[draft]).length);
 const synchronized=synchronizeBlend(configured,draft,snapshot.assets);
 assert.equal(synchronized.Rows.length,3);assert.ok(synchronized.Rows.every(row=>row.Weights.FOV===-.25));
 assert.deepEqual(blendProblems(synchronized,snapshot.assets,[draft]),[]);
 assert.deepEqual((await project.validate({[rig.path]:encode(draft.data),[blend.path]:encode(synchronized)})).issues,[]);
 const rebuilt=synchronizeBlend({Name:'New',Rows:[]},rig,snapshot.assets);
 assert.ok(rebuilt.Rows.every(row=>blendChannels.every(([name])=>row.Weights[name]===1)));
});

test('new blend assets retain document references and register their identity transactionally',async()=>{
 const sourcePath=base+'InputBlendAssets/Run_Default.inputBlend',file=base+'InputBlendAssets/Run_Extra.inputBlend';
 const result=await project.mutate({kind:'create-asset',type:'InputBlend',sourcePath,path:file,snapshotRevision:(await project.snapshot()).snapshotRevision});
 const snapshot=await project.snapshot(),created=snapshot.assets.find(a=>a.path===result.path);
 assert.equal(created.type,'InputBlend');assert.ok(created.documentId.endsWith('.inputBlend'));
 assert.deepEqual(JSON.parse((await readReference(project,await referenceFor(project,file))).text),created.data);
 assert.deepEqual((await project.validate()).issues,[]);
});
