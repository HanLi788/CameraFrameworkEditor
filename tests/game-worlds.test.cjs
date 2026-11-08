const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {GameWorlds}=require('../electron/game-worlds.cjs');
test('world saves persist selection, seed, grounded pose and settings, isolated per project',async()=>{
 const storage=await fs.mkdtemp(path.join(os.tmpdir(),'world-saves-')),a=await new GameWorlds(storage,'D:/ProjectA').load();assert.equal(a.selected().id,'lab');
 await a.create({name:'沼泽探索',seed:'swamp-42'});const w=a.selected();assert.equal(w.environment,'explore');assert.equal(w.version,1);
 const frame={worldKey:'1:explore:swamp-42',grounded:true,owner:{X:0,Y:450,Z:88},heading:90};await a.checkpoint(w.id,frame);frame.owner.Y=1000;
 await a.settings({quality:'low',fps:30,sensitivity:1.5,movementMultiplier:2});const reopened=await new GameWorlds(storage,'D:/ProjectA').load();assert.equal(reopened.selected().id,w.id);assert.equal(reopened.selected().pose.position.Y,450);assert.equal(reopened.data.settings.fps,30);assert.equal(reopened.data.settings.movementMultiplier,2);await assert.rejects(()=>a.settings({movementMultiplier:0}));assert.equal(a.data.settings.movementMultiplier,2);
 assert.equal((await new GameWorlds(storage,'D:/ProjectB').load()).selected().id,'lab');
 await reopened.checkpoint(w.id,{...frame,grounded:false});assert.equal(reopened.selected().pose.position.Y,450);
 await reopened.checkpoint(w.id,{...frame,worldKey:'1:explore:other'});assert.equal(reopened.selected().pose.position.Y,450);
 await reopened.select('lab');assert.equal(reopened.selected().builtin,true);assert.equal(reopened.selected().pose,undefined);
});
test('invalid worlds/settings are rejected and concurrent creates remain durable',async()=>{
 const storage=await fs.mkdtemp(path.join(os.tmpdir(),'world-saves-')),store=await new GameWorlds(storage,'D:/A').load();
 await assert.rejects(()=>store.create({name:'',seed:'a'}));await assert.rejects(()=>store.create({name:'a',seed:' '}));await assert.rejects(()=>store.select('../x'));await assert.rejects(()=>store.settings({quality:'ultra',fps:1000,sensitivity:0}));
 await Promise.all([store.create({name:'one',seed:'1'}),store.create({name:'two',seed:'2'})]);assert.equal((await new GameWorlds(storage,'D:/A').load()).state().worlds.length,3);
});

test('NPC-only scene saves preserve legacy data and roll back on storage failure',async()=>{
 const storage=await fs.mkdtemp(path.join(os.tmpdir(),'npc-saves-')),store=await new GameWorlds(storage,'D:/A').load();
 const legacy=structuredClone(store.state().worlds[0].postVolumes),npc={id:'guide',name:'Guide',position:[150,0,88],heading:0,dialogueId:9999};
 await store.scene('lab',[npc]);assert.deepEqual(store.state().worlds[0].postVolumes,legacy);assert.deepEqual((await new GameWorlds(storage,'D:/A').load()).state().worlds[0].npcs,[npc]);
 const write=store.write;store.write=async()=>{throw Error('disk unavailable');};try{await assert.rejects(()=>store.scene('lab',[]),/disk unavailable/);assert.deepEqual(store.state().worlds[0].npcs,[npc]);}finally{store.write=write;}
});
