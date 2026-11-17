const {test,before}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {fixture,referenceFor}=require('./framework-fixture.cjs'),{encode}=require('../electron/project.cjs');
const {indexPath,documentReference:ref}=require('../electron/asset-protocol.cjs');
let project;
before(async()=>{project=await fixture();});
const mutate=async request=>project.mutate({...request,snapshotRevision:(await project.snapshot()).snapshotRevision});
test('indexed identities resolve to physical paths in both backend and browser graphs',async()=>{
 const snapshot=await project.snapshot(),dash=snapshot.assets.find(a=>a.path.endsWith('/Dash/Dash.rig'));
 assert.deepEqual(snapshot.issues,[]);assert.equal(snapshot.documentIndex.Documents.length,snapshot.assets.length);assert.equal(dash.documentId,'Camera/ActionCamera/Dash/Dash.rig');assert.equal(dash.refs.length,8);
 const {collectAssetReferences,assetReference}=await import('../src/assetPaths.mjs');
 assert.deepEqual(collectAssetReferences(dash.data,[],[],snapshot.assets).map(r=>[r.path,r.field]),dash.refs.map(r=>[r.path,r.field]));
 assert.deepEqual(assetReference(dash.refs[0].path,snapshot.assets),dash.data.Ranges[0]);
});
test('invalid references, unindexed sources and duplicate index identities fail before writes',async()=>{
 const file='Assets/GameplayCameraSystem/CameraAssets/ActionCamera/Dash/Dash.rig',doc=await project.read(file),data=JSON.parse(doc.text);
 for(const value of ['Camera/ActionCamera/Dash/RangeAssets/Dash_Default.range',{$ref:{DocumentId:'Camera/Missing.range',Pointer:''}},{$ref:{DocumentId:data.Ranges[0].$ref.DocumentId,Pointer:'/Channels'}}]){
  const candidate=structuredClone(data);candidate.Ranges=[value];assert.ok((await project.validate({[file]:encode(candidate)})).issues.length);
 }
 const index=await project.read(indexPath),duplicate=JSON.parse(index.text);duplicate.Documents.push(duplicate.Documents[0]);assert.ok((await project.validate({[indexPath]:encode(duplicate)})).issues.some(i=>i.path===indexPath));
 const curve=await project.read('Assets/Shared/CurveAssets/Bezier/Linear.curve');assert.ok((await project.validate({'Assets/Shared/Unindexed.curve':curve.text})).issues.some(i=>i.message.includes('索引')));
 assert.equal((await project.read(file)).text,doc.text);assert.equal((await project.read(indexPath)).text,index.text);
});
test('folder copies get fresh identities and remap internal mounts without altering originals',async()=>{
 const source='Assets/GameplayCameraSystem/CameraAssets/ActionCamera/Dash',destination='Assets/GameplayCameraSystem/CameraAssets/ActionCamera/Copy',original=await project.read(source+'/Dash.rig');
 await mutate({kind:'copy',sourcePath:source,path:destination});
 const copy=JSON.parse((await project.read(destination+'/Dash.rig')).text),sourceData=JSON.parse(original.text);
 assert.notEqual(copy.Processors.Input.Enter.$ref.DocumentId,sourceData.Processors.Input.Enter.$ref.DocumentId);assert.equal(copy.Processors.Input.Enter.$ref.DocumentId,'Camera/ActionCamera/Copy/InputAssets/Dash_Enter.transitionInput');
 assert.equal((await project.read(source+'/Dash.rig')).text,original.text);assert.deepEqual((await project.validate()).issues,[]);
 await mutate({kind:'delete',sourcePath:destination});assert.deepEqual((await project.validate()).issues,[]);
});
test('failed source moves restore both index and source content',async()=>{
 const source='Assets/Shared/CurveAssets/Bezier/Linear.curve',destination='Assets/Shared/CurveAssets/Bezier/Failed.curve',old=await project.read(source),index=await project.read(indexPath),atomic=project.atomic.bind(project);let writes=0;
 project.atomic=async(...args)=>{if(++writes===2)throw Error('index write failure');return atomic(...args);};
 try{await assert.rejects(()=>mutate({kind:'move',sourcePath:source,path:destination,sourceRevision:old.revision}),/index write failure/);}finally{project.atomic=atomic;}
 assert.equal((await project.read(indexPath)).text,index.text);assert.equal((await project.read(source)).text,old.text);await assert.rejects(()=>project.read(destination),/ENOENT/);
});
test('external index changes during validation block saves and stale file operations',async()=>{
 const file='Assets/Shared/CurveAssets/Bezier/Linear.curve',doc=await project.read(file),index=await project.read(indexPath),snapshot=await project.snapshot(),validate=project.validate.bind(project);
 project.validate=async(...args)=>{const result=await validate(...args);await fs.writeFile(path.join(project.root,indexPath),index.text+'\n');return result;};
 try{await assert.rejects(()=>project.save({...doc,text:doc.text+'\n'}),/校验期间/);assert.equal((await project.read(file)).text,doc.text);await assert.rejects(()=>project.mutate({kind:'copy',sourcePath:file,path:'Assets/Shared/Stale.curve',snapshotRevision:snapshot.snapshotRevision}),/变化/);}finally{project.validate=validate;await fs.writeFile(path.join(project.root,indexPath),index.text);}
});
