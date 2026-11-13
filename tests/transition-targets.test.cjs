const {test}=require('node:test'),assert=require('node:assert/strict');
test('browser and backend agree that complete performance identities are literal metadata',async()=>{
 const {collectAssetReferences}=await import('../src/assetPaths.mjs'),{references}=require('../electron/asset-protocol.cjs');
 const data={PerformanceType:{BaseName:'PERFORMANCE_NPC',CodeName:'Shared/Code.curve'},ValueAssets:['GameplayCameraSystem/Target.transitionValue'],DefaultValueAsset:'GameplayCameraSystem/Default.transitionValue'};
 const expected=['Assets/GameplayCameraSystem/Target.transitionValue','Assets/GameplayCameraSystem/Default.transitionValue'];assert.deepEqual(collectAssetReferences(data).map(r=>r.path),expected);assert.deepEqual(references(data).map(r=>r.path),expected);
});
test('target choices reject default values and duplicate pairs while allowing code variants',async()=>{
 const {targetChoiceAllowed,performanceKey,performanceProblem}=await import('../src/transitionTargets.mjs');
 const make=(path,code)=>({path,type:'Value',data:{PerformanceType:{BaseName:'PERFORMANCE_NPC',...(code===undefined?{}:{CodeName:code})}}});
 const a=make('Assets/GameplayCameraSystem/A.transitionValue','10001'),same=make('Assets/GameplayCameraSystem/B.transitionValue','10001'),variant=make('Assets/GameplayCameraSystem/C.transitionValue','010001'),base=make('Assets/GameplayCameraSystem/D.transitionValue');
 const assets=[a,same,variant,base];assert.equal(targetChoiceAllowed(same,[a.path],assets),false);assert.equal(targetChoiceAllowed(same,[a.path],assets,0),true);assert.equal(targetChoiceAllowed(variant,[a.path],assets),true);assert.equal(targetChoiceAllowed(base,[a.path],assets),true);assert.equal(targetChoiceAllowed({type:'Value',data:{}},[],assets),false);
 assert.notEqual(performanceKey(a.data.PerformanceType),performanceKey(variant.data.PerformanceType));assert.ok(performanceProblem({BaseName:'PERFORMANCE_NPC',CodeName:1}));
});
test('usage tracking distinguishes Focus, Unfocus, defaults and specialized targets',async()=>{
 const {transitionInputUsers,transitionValueUsers,transitionRole}=await import('../src/transitionTargets.mjs');
 const assets=[{type:'Rig',path:'A.rig',data:{Processors:{Input:{Focus:'GameplayCameraSystem/A.transitionInput',Unfocus:'GameplayCameraSystem/B.transitionInput'}}}},{type:'TransitionInput',path:'Assets/GameplayCameraSystem/B.transitionInput',data:{DefaultValueAsset:'GameplayCameraSystem/Default.transitionValue',ValueAssets:['GameplayCameraSystem/Special.transitionValue']}}];
 assert.deepEqual(transitionInputUsers(assets,'Assets/GameplayCameraSystem/A.transitionInput'),[{path:'A.rig',role:'Focus'}]);assert.equal(transitionRole(assets[1].data),'Unfocus');assert.deepEqual(transitionValueUsers(assets,'Assets/GameplayCameraSystem/Default.transitionValue'),{defaults:[assets[1].path],targets:[]});assert.deepEqual(transitionValueUsers(assets,'Assets/GameplayCameraSystem/Special.transitionValue'),{defaults:[],targets:[assets[1].path]});
});
