const {test}=require('node:test'),assert=require('node:assert/strict');
const {buildRigTree,rigOwners,findOccurrence,ancestorIds}=require('../src/rigGraph.mjs');
const asset=(path,type,refs=[])=>({path,type,refs,data:{}}),ref=(path,field)=>({path,field});
test('sharing counts distinct rigs through indirect and repeated references, case insensitively',()=>{
 const assets=[asset('a.rig','Rig',[ref('x.input','Processors.Input.Assets.0'),ref('x.input','Processors.Input.Assets.1')]),asset('b.rig','Rig',[ref('y.input','Processors.Input.Assets.0')]),asset('x.input','Input',[ref('shared.curve','Channels.Yaw.Curve')]),asset('y.input','Input',[ref('SHARED.curve','Channels.Pitch.Curve')]),asset('shared.curve','Curve')];
 const owners=rigOwners(assets);assert.deepEqual(owners.get('shared.curve'),['a.rig','b.rig']);assert.deepEqual(owners.get('x.input'),['a.rig']);
 const tree=buildRigTree(assets,'a.rig'),occurrences=[...tree.nodes.values()].filter(n=>n.path==='shared.curve');assert.equal(occurrences.length,2);assert.notEqual(occurrences[0].id,occurrences[1].id);assert.equal(findOccurrence(tree,'shared.curve',occurrences[1].id),occurrences[1]);assert.ok(ancestorIds(tree,occurrences[1]).includes('root'));
 assets[1].refs=[];assert.deepEqual(rigOwners(assets).get('shared.curve'),['a.rig']);
});
test('missing assets and cycles are visible terminal nodes, not recursive expansion or duplicate owners',()=>{
 const assets=[asset('a.rig','Rig',[ref('x.input','Processors.Input.Assets.0'),ref('missing.value','ValueAssets.0.Path')]),asset('x.input','Input',[ref('x.input','Curve')])];
 const tree=buildRigTree(assets,'a.rig');assert.equal([...tree.nodes.values()].find(n=>n.issue==='cycle').children.length,0);assert.equal(findOccurrence(tree,'missing.value').issue,'missing');assert.deepEqual(rigOwners(assets).get('x.input'),['a.rig']);
});
test('tree keeps group order and repeated occurrences, with a bounded expansion budget',()=>{
 const assets=[asset('a.rig','Rig',[ref('x.input','Processors.Input.Assets.0'),ref('p.pipeline','Pipelines.0')]),asset('x.input','Input',[ref('v.value','ValueAssets.0.Path')]),asset('p.pipeline','Pipeline'),asset('v.value','Value')];
 const tree=buildRigTree(assets,'a.rig');assert.deepEqual(tree.root.children.map(n=>n.label),['管线','输入']);
 assert.ok([...buildRigTree(assets,'a.rig',2).nodes.values()].some(n=>n.issue==='limit'));
 assert.equal(findOccurrence(tree,'unrelated.md'),undefined);
});
