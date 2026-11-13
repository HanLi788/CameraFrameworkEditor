const {test}=require('node:test'),assert=require('node:assert/strict');
const {openTab,removeTab,moveTabs}=require('../electron/workbench.cjs');
test('following mounts keeps rig and processor context and reuses each file tab',()=>{
 const m={tabs:[]};openTab(m,{path:'Assets/A.rig',rig:true});openTab(m,{path:'Assets/A.rig',rig:true,processor:'Smooth'});
 openTab(m,{path:'Assets/Shared/A.smooth'});openTab(m,{path:'Assets/Shared/C.curve'});openTab(m,{path:'Assets/Shared/A.smooth'});
 assert.equal(m.tabs.length,3);assert.equal(m.rig,'Assets/A.rig');assert.equal(m.processor,'Smooth');
 removeTab(m,m.file);assert.equal(m.file,'Assets/Shared/C.curve');assert.equal(m.processor,'Smooth');
});
test('each rig remembers its processor including the common settings view',()=>{
 const m={tabs:[]};openTab(m,{path:'A.rig',rig:true,processor:''});openTab(m,{path:'B.rig',rig:true,processor:'Render'});
 openTab(m,{path:'A.rig',rig:true});assert.equal(m.processor,'');openTab(m,{path:'B.rig',rig:true});assert.equal(m.processor,'Render');
});
test('transactional moves and deletes update open tabs and rig context',()=>{
 const m={tabs:[]};openTab(m,{path:'A.rig',rig:true});openTab(m,{path:'C.curve'});
 moveTabs(m,{'A.rig':'B.rig','C.curve':'D.curve'});assert.equal(m.rig,'B.rig');assert.equal(m.file,'D.curve');
 moveTabs(m,{'D.curve':null});assert.equal(m.file,'B.rig');moveTabs(m,{'B.rig':null});assert.equal(m.file,'');assert.equal(m.rig,'');assert.equal(m.processor,'');
});
test('pipeline visualization follows mounted Flow and keeps disabled stages separate',async()=>{
 const {processorPipeline,processorReferences}=await import('../src/pipelineViewModel.mjs');
 const rig={type:'Rig',path:'Assets/A.rig',data:{Pipelines:['Shared/A.pipeline'],Processors:{Smooth:['Shared/A.smooth'],Input:{Assets:['Shared/A.userInput']},Effects:[]}}};
 const p={type:'Pipeline',path:'Assets/Shared/A.pipeline',data:{Flow:['Input','Smooth'],Disabled:['Effects'],Stages:{Input:{Implementation:'Common.Input'},Smooth:{Implementation:'Common.Smooth'},Effects:{Implementation:'Common.Effects'}}}};
 const model=processorPipeline([rig,p],rig.path);assert.deepEqual(model.flow.map(s=>s.name),['Input','Smooth']);assert.deepEqual(model.disabled.map(s=>s.name),['Effects']);assert.equal(model.flow[0].implementation,'Common.Input');
 assert.deepEqual(processorReferences(rig,'Input'),['Assets/Shared/A.userInput']);assert.deepEqual(processorReferences(rig,'Effects'),[]);
});

test('invalid pipeline drafts leave a usable workbench while validation reports them',async()=>{
 const {processorPipeline}=await import('../src/pipelineViewModel.mjs');
 const assets=[{type:'Rig',path:'A.rig',data:{Pipelines:['Shared/A.pipeline']}},{type:'Pipeline',path:'Assets/Shared/A.pipeline',data:{Flow:'invalid',Disabled:42}}];
 assert.deepEqual(processorPipeline(assets,'A.rig').flow,[]);assert.deepEqual(processorPipeline(assets,'A.rig').disabled,[]);
});

test('rig choices follow pipeline spaces and show names without directory paths',async()=>{
 const {rigChoicesBySpace}=await import('../src/pipelineViewModel.mjs');
 const assets=[
  {type:'Rig',path:'Assets/GameplayCameraSystem/Custom/Run.rig',data:{Name:'Run',Pipelines:['Shared/Action.pipeline']}},
  {type:'Rig',path:'Assets/GameplayCameraSystem/Custom/Other.rig',data:{Name:'Run',Pipelines:['Shared/Battle.pipeline']}},
  {type:'Pipeline',path:'Assets/Shared/Action.pipeline',data:{SpaceType:'Action'}},
  {type:'Pipeline',path:'Assets/Shared/Battle.pipeline',data:{SpaceType:'Battle'}}
 ];
 const groups=rigChoicesBySpace(assets);
 assert.deepEqual(groups.map(g=>g.space),['Action','Battle']);
 assert.deepEqual(groups[0].rigs,[{path:assets[0].path,name:'Run'}]);assert.equal(groups[1].rigs[0].path,assets[1].path);
});

test('missing or invalid pipeline metadata keeps every rig available for repair',async()=>{
 const {rigChoicesBySpace}=await import('../src/pipelineViewModel.mjs');
 const assets=[{type:'Rig',path:'Assets/GameplayCameraSystem/Custom/Broken.rig',data:{}},{type:'Rig',path:'Assets/GameplayCameraSystem/CameraAssets/IdleCamera/Default/Default.rig',data:{Pipelines:['Shared/Invalid.pipeline']}},{type:'Pipeline',path:'Assets/Shared/Invalid.pipeline',data:{SpaceType:42}}];
 const groups=rigChoicesBySpace(assets);
 assert.deepEqual(groups.map(g=>g.space),['Idle','Unassigned']);assert.equal(groups[0].rigs[0].name,'Default');assert.equal(groups[1].rigs[0].name,'Broken');
});
