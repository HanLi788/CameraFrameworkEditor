const {test}=require('node:test'),assert=require('node:assert/strict');
const {rigDirectories,rigLocation,directoryOptions,changeDirectory}=require('../src/rigDirectories.mjs');
const {buildRigTree,layoutRigTree}=require('../src/rigGraph.mjs');
test('selectors use literal folder levels, filter direct rig files, and keep empty or ambiguous folders explicit',()=>{
 const root='Assets/CameraAssets/',dirs=['空间甲','空间甲/Player','空间甲/Player/Dash','空间甲/Player/Dash/ValueAssets','空间甲/Player/Empty','空间乙','空间乙/NPC','空间乙/NPC/Dialogue'];
 const index=rigDirectories(dirs.map(d=>root+d),[{path:root+'空间甲/Player/Dash/OtherName.rig'},{path:root+'空间甲/Player/Dash/ValueAssets/Nested.rig'},{path:root+'空间乙/NPC/Dialogue/A.rig'},{path:root+'空间乙/NPC/Dialogue/B.rig'}]);
 const first=changeDirectory(index,{},'space','空间甲');assert.equal(first.host,'Player');assert.equal(first.device,'Dash');assert.deepEqual(first.paths,[root+'空间甲/Player/Dash/OtherName.rig']);
 assert.equal(changeDirectory(index,first,'device','Empty').paths.length,0);
 const second=changeDirectory(index,first,'space','空间乙');assert.equal(second.host,'NPC');assert.equal(second.device,'Dialogue');assert.equal(second.paths.length,2);
 assert.equal(directoryOptions(index,{space:'Missing',host:'Player'}).host,'');assert.equal(rigLocation(root+'空间甲/Player/Dash/ValueAssets/Nested.rig'),null);
 assert.deepEqual(rigLocation(first.paths[0]),{space:'空间甲',host:'Player',device:'Dash'});
});
test('horizontal layout follows actual mount depth, keeps occurrences separate and lays out without overlap',()=>{
 const asset=(path,type,refs=[])=>({path,type,refs}),ref=(path,field)=>({path,field});
 const tree=buildRigTree([asset('a.rig','Rig',[ref('i.input','Processors.Input.Assets.0'),ref('r.range','Ranges.0')]),asset('i.input','Input',[ref('s.sensitivity','SensitivityAssets.0')]),asset('r.range','Range'),asset('s.sensitivity','Sensitivity',[ref('c.curve','Channels.Yaw.EscapeCurve'),ref('c.curve','Channels.Yaw.ReturnCurve')]),asset('c.curve','Curve')],'a.rig');
 const all=new Set(tree.nodes.keys()),layout=layoutRigTree(tree,all);assert.equal(layout.maxDepth,3);assert.ok(layout.nodes.every(n=>n.node.kind!=='group'));
 assert.equal(layout.nodes.find(n=>n.node.path==='i.input').depth,1);assert.equal(layout.nodes.filter(n=>n.node.path==='c.curve').length,2);
 for(const link of layout.links)assert.ok(link.from.x+link.from.width<link.to.x);
 for(const a of layout.nodes)for(const b of layout.nodes)if(a!==b&&a.depth===b.depth)assert.ok(a.y+a.height<=b.y||b.y+b.height<=a.y);
 assert.equal(layoutRigTree(tree,new Set()).nodes.length,1);assert.equal(layoutRigTree(tree,new Set(['root'])).nodes.length,3);
});
