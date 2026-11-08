const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {GameWorlds}=require('../electron/game-worlds.cjs');
const {globalVolume,validateVolumes}=require('../electron/post-volumes.cjs');
const catalog=[{name:'ExposureCompensation',default:0,min:-20,max:20},{name:'VignetteIntensity',default:0,minimum:0,maximum:1}];
test('world volumes keep one global baseline, validate settings and persist independently for default and seeded worlds',async()=>{
 const store=await new GameWorlds(await fs.mkdtemp(path.join(os.tmpdir(),'camera-volumes-')),'D:/test').load();
 assert.equal(store.selected().postVolumes[0].id,'global');
 const g=globalVolume(),local={...globalVolume(),id:'local',name:'Marsh',global:false,center:[0,0,0],size:[100,100,100],blend:100,priority:1,values:{ExposureCompensation:2}};
 for(const invalid of [[],[local],[g,g],[{...g,enabled:false}],[{...g,global:false}],[g,{...local,weight:2}],[g,{...local,size:[0,1,1]}],[g,{...local,values:{Unknown:1}}],[{...g,values:{VignetteIntensity:-1}}]])assert.throws(()=>validateVolumes(invalid,catalog));
 await store.volumes('lab',[g,local],catalog);await store.create({name:'Other',seed:'world2'});
 assert.equal(store.selected().postVolumes.length,1);await store.select('lab');assert.equal(store.selected().postVolumes.length,2);
 const reopened=await new GameWorlds(path.dirname(path.dirname(store.file)),'D:/test').load();assert.equal(reopened.selected().postVolumes[1].name,'Marsh');
 const snapshot=reopened.selected();snapshot.postVolumes[1].values.ExposureCompensation=9;assert.equal(reopened.selected().postVolumes[1].values.ExposureCompensation,2);
 await assert.rejects(()=>reopened.volumes('missing',[g],catalog));
});
test('volume sampling follows camera position, soft bounds and stable priority; Lua offsets are added once',async()=>{
 const {sampleVolumes,volumeInfluence}=await import('../src/gameVolumes.mjs');
 const g={...globalVolume(),values:{ExposureCompensation:1}},a={...g,id:'a',global:false,center:[0,0,0],size:[100,100,100],blend:100,weight:1,priority:1,values:{ExposureCompensation:3}},b={...a,id:'b',priority:2,weight:.5,values:{ExposureCompensation:7}};
 assert.equal(volumeInfluence(a,[0,0,0]),1);assert.equal(volumeInfluence(a,[100,0,0]),.5);assert.equal(volumeInfluence(a,[150,0,0]),0);
 assert.equal(sampleVolumes([b,g,a],catalog,[0,0,0]).values.ExposureCompensation,5);
 assert.equal(sampleVolumes([b,g,a],catalog,[0,0,0],{ExposureCompensation:2}).values.ExposureCompensation,7);
 assert.equal(sampleVolumes([g,a],catalog,[150,0,0]).values.ExposureCompensation,1);
 assert.equal(sampleVolumes([g,{...a,enabled:false}],catalog,[0,0,0]).values.ExposureCompensation,1);
 assert.deepEqual(sampleVolumes([g],catalog,[0,0,0],{VignetteIntensity:2}).errors,['VignetteIntensity']);
});

test('scene defaults enable every catalog channel, retain saved sparse overrides and atomically persist NPC layouts',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'camera-scenes-')),store=await new GameWorlds(dir,'D:/scene',catalog).load();
 assert.deepEqual(store.selected().postVolumes[0].values,{ExposureCompensation:0,VignetteIntensity:0});assert.equal(store.selected().npcs[0].dialogueId,9999);
 const legacy=globalVolume();legacy.values={ExposureCompensation:1};await store.volumes('lab',[legacy],catalog,[]);
 const reopened=await new GameWorlds(dir,'D:/scene',catalog).load();assert.deepEqual(reopened.selected().postVolumes[0].values,{ExposureCompensation:1});assert.deepEqual(reopened.selected().npcs,[]);
 await reopened.create({name:'Test',seed:'1'});assert.deepEqual(reopened.selected().npcs,[]);assert.equal(Object.keys(reopened.selected().postVolumes[0].values).length,2);
 const id=reopened.selected().id,npc={id:'npc-1',name:'Guide',position:[100,0,88],heading:90,dialogueId:9999};await reopened.volumes(id,[legacy],catalog,[npc]);
 const before=await fs.readFile(reopened.file,'utf8');await assert.rejects(()=>reopened.volumes(id,[globalVolume()],catalog,[{...npc,dialogueId:0}]));assert.equal(await fs.readFile(reopened.file,'utf8'),before);assert.equal(reopened.selected().npcs[0].heading,90);
 const {setVolumeOverride,overridePeers}=await import('../src/gameVolumes.mjs');const colors=['R','G','B'].map(c=>({name:'Tint'+c,native:'Tint',default:1}));
 assert.equal(overridePeers(colors,'TintR').length,3);assert.deepEqual(setVolumeOverride({TintR:.5},colors,'TintG',true),{TintR:.5,TintG:1,TintB:1});assert.deepEqual(setVolumeOverride({TintR:.5,TintG:1,TintB:1},colors,'TintB',false),{});
});
