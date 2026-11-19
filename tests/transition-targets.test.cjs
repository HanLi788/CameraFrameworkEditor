const {test}=require('node:test'),assert=require('node:assert/strict');
const {documentReference:ref,references}=require('../electron/asset-protocol.cjs');
const asset=(documentId,type,data={})=>({documentId,path:'Assets/storage/'+documentId.split('/').at(-1),type,data});
test('browser and backend resolve document identities through the index and keep metadata literal',async()=>{
 const {collectAssetReferences}=await import('../src/assetPaths.mjs');
 const assets=[asset('Camera/Target.transitionValue','Value'),asset('Camera/Default.transitionValue','Value')];
 const data={PerformanceType:{BaseName:'PERFORMANCE_NPC',CodeName:'Shared/Code.curve'},ValueAssets:[ref(assets[0].documentId)],DefaultValueAsset:ref(assets[1].documentId)};
 const expected=assets.map(a=>a.path);assert.deepEqual(collectAssetReferences(data,[],[],assets).map(r=>r.path),expected);assert.deepEqual(references(data,[],[],assets).map(r=>r.path),expected);
});
test('target choices reject default values and duplicate pairs while allowing code variants',async()=>{
 const {targetChoiceAllowed,performanceKey,performanceProblem}=await import('../src/transitionTargets.mjs');
 const make=(name,code)=>asset('Camera/'+name+'.transitionValue','Value',{PerformanceType:{BaseName:'PERFORMANCE_NPC',...(code===undefined?{}:{CodeName:code})}});
 const a=make('A','10001'),same=make('B','10001'),variant=make('C','010001'),base=make('D'),assets=[a,same,variant,base],mounts=[ref(a.documentId)];
 assert.equal(targetChoiceAllowed(same,mounts,assets),false);assert.equal(targetChoiceAllowed(same,mounts,assets,0),true);assert.equal(targetChoiceAllowed(variant,mounts,assets),true);assert.equal(targetChoiceAllowed(base,mounts,assets),true);assert.equal(targetChoiceAllowed({type:'Value',data:{}},[],assets),false);
 assert.notEqual(performanceKey(a.data.PerformanceType),performanceKey(variant.data.PerformanceType));assert.ok(performanceProblem({BaseName:'PERFORMANCE_NPC',CodeName:1}));
});
test('usage tracking distinguishes Enter, Change and Exit without a default target',async()=>{
 const {transitionInputUsers,transitionRole}=await import('../src/transitionTargets.mjs');
 const enter=asset('Camera/A.transitionInput','TransitionInput'),change=asset('Camera/C.transitionInput','TransitionInput'),exit=asset('Camera/B.transitionInput','TransitionInput',{Name:'B_Exit',ValueAssets:[ref('Camera/Special.transitionValue')]});
 const defaults=asset('Camera/Default.transitionValue','Value'),target=asset('Camera/Special.transitionValue','Value');
 const rig=asset('Camera/A.rig','Rig',{Processors:{Input:{Enter:ref(enter.documentId),Change:ref(change.documentId),Exit:ref(exit.documentId)}}}),assets=[rig,enter,change,exit,defaults,target];
 assert.deepEqual(transitionInputUsers(assets,enter.path),[{path:rig.path,role:'Enter',sequence:false}]);
 assert.equal(transitionInputUsers(assets,change.path)[0].role,'Change');assert.equal(transitionRole(exit.data),'Exit');
 assert.equal(transitionInputUsers(assets,exit.path)[0].role,'Exit');
});
test('sequence choices match unique positive SequenceId values and exclude Actor targets',async()=>{
 const {targetChoiceAllowed}=await import('../src/transitionTargets.mjs');
 const a=asset('Camera/SeqA.transitionValue','Value',{SequenceId:10001}),duplicate=asset('Camera/SeqB.transitionValue','Value',{SequenceId:10001}),b=asset('Camera/SeqC.transitionValue','Value',{SequenceId:10002}),actor=asset('Camera/Actor.transitionValue','Value',{PerformanceType:{BaseName:'PERFORMANCE_PLAYER'}}),assets=[a,duplicate,b,actor];
 assert.equal(targetChoiceAllowed(duplicate,[ref(a.documentId)],assets,-1,true),false);assert.equal(targetChoiceAllowed(b,[ref(a.documentId)],assets,-1,true),true);assert.equal(targetChoiceAllowed(actor,[],assets,-1,true),false);assert.equal(targetChoiceAllowed(a,[],assets),false);
});
