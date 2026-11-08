const {test,before}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {Project,encode,references}=require('../electron/project.cjs');
let project,labels;
const effect='Assets/EffectAssets/OwnerVelocity/MovementSpeed.effect',post='Assets/PostProcessingAssets/OwnerVelocity/MovementSpeed.postProcessing';
before(async()=>{
 labels=await import('../src/postProcessingLabels.mjs');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'camera-post-tests-')),source=process.env.CAMERA_FRAMEWORK_TEST_ROOT||'D:/MyWorks/Lua/CameraFramework';
 for(const name of ['CameraFramework','Foundation','InputSystem'])await fs.cp(path.join(path.dirname(source),name),path.join(root,name),{recursive:true});
 for(const name of ['PlayerEvents','MovementValues'])await fs.cp(path.join(path.dirname(source),'Actor/Player',name+'.lua'),path.join(root,'Actor/Player',name+'.lua'));
 project=await Project.open(root,path.join(root,'data'),path.resolve('runtime/lua54.exe'));
});
const {PLAN,BINDINGS,parseBindings,writeBindings}=require('../electron/postprocessing.cjs');
const {Documents}=require('../electron/documents.cjs');
const mutate=async request=>project.mutate({...request,snapshotRevision:(await project.snapshot()).snapshotRevision});
test('independent post catalogue and bindings follow asset renames and protect deletion',async()=>{
 const snap=await project.snapshot();assert.deepEqual(snap.issues,[]);assert.equal(snap.effectCatalog.postProcessing.length,269);assert.equal(snap.effectCatalog.postObjects.length,4);
 assert.deepEqual(references({PostProcessingAssets:[post]}),[]);
 await assert.rejects(()=>mutate({kind:'delete',sourcePath:post,sourceRevision:snap.assets.find(a=>a.path===post).revision}),/绑定引用/);
 await mutate({kind:'move',sourcePath:post,path:'Assets/Moved.postProcessing',sourceRevision:(await project.read(post)).revision});
 assert.equal(parseBindings((await project.read(BINDINGS)).text).config.Bindings[0].Asset,'Assets/Moved.postProcessing');
 assert.equal(JSON.parse((await project.read(PLAN)).text).Bindings[0].Asset,'Assets/Moved.postProcessing');
 await mutate({kind:'move',sourcePath:'Assets/Moved.postProcessing',path:post,sourceRevision:(await project.read('Assets/Moved.postProcessing')).revision});
});
test('postprocessing saves independent source/domain and regenerates plan; invalid definitions stay on disk unchanged',async()=>{
 const original=await project.read(post),p=JSON.parse(original.text);
 p.Domain='[0,1000]';p.Outputs={ExposureCompensation:{Range:'{1}'}};
 const saved=await project.save({...original,text:encode(p)}),plan=JSON.parse((await project.read(PLAN)).text);
 assert.deepEqual(plan.Bindings[0].Definition.Outputs,p.Outputs);assert.ok(plan.Channels.ExposureCompensation);
 for(const change of [v=>v.Source={},v=>v.Mode='Volume',v=>v.Outputs.FOV={Range:'{2}'},v=>v.Domain='garbage']){
  const v=structuredClone(p);change(v);await assert.rejects(()=>project.save({...saved,text:encode(v)}));assert.equal((await project.read(post)).text,saved.text);
 }
 await project.save({...saved,text:original.text});
});
test('generated plan is read-only including folder mutation and document edits; reload is allowed',async()=>{
 const d=await project.read(PLAN);assert.equal(d.readOnly,true);await assert.rejects(()=>project.save({...d,text:d.text+' '}),/只读/);
 const docs=new Documents(project);await docs.ensure(PLAN);assert.throws(()=>docs.editText({path:PLAN,baseText:d.text,text:'{}'}),/只读/);await docs.reload(PLAN);
 for(const kind of ['delete','move','copy'])await assert.rejects(()=>mutate({kind,sourcePath:PLAN,path:'Assets/Other.postProcessingPlan',sourceRevision:d.revision}),/只读/);
 await assert.rejects(()=>mutate({kind:'delete',sourcePath:'Assets/PostProcessingAssets'}),/只读/);
});
test('asset, binding source and generated plan roll back together if the final write fails',async()=>{
 const d=await project.read(post),b=await project.read(BINDINGS),plan=await project.read(PLAN),config=parseBindings(b.text).config;
 config.Bindings[0].Activation={Kind:'Always'};const p=JSON.parse(d.text);p.Outputs={ExposureCompensation:{Range:'{1}'}};
 const atomic=project.atomic;let failed=false;project.atomic=async function(file,text){if(file===PLAN&&!failed){failed=true;throw Error('injected plan write failure');}return atomic.call(this,file,text);};
 try{await assert.rejects(()=>project.saveMany([{...d,text:encode(p)},{...b,text:writeBindings(b.text,config)}]),/injected/);}finally{project.atomic=atomic;}
 for(const x of [d,b,plan])assert.equal((await project.read(x.path)).text,x.text);
});
test('literal binding editor preserves values and rejects executable Lua',()=>{
 const text='-- header\nreturn {Channels={}, Bindings={{Id="a",Asset="p",Activation={Kind="Manual"}}}}';
 const c=parseBindings(text).config;c.Bindings[0].Id='汉字"\\\n';const written=writeBindings(text,c);assert.ok(written.startsWith('-- header\n'));assert.deepEqual(parseBindings(written).config,c);
 for(const text of ['return build()','local x={}; return x','return {Bindings=require("x")}'])assert.throws(()=>parseBindings(text),/动态 Lua/);
});

test('all Lua postprocessing channels have bilingual labels and dedicated group icons; search accepts either language and native names',async()=>{
 const channels=(await project.snapshot()).effectCatalog.postProcessing;
 for(const c of channels){
  const base=c.component?c.name.slice(0,-c.component.length):c.name;
  assert.ok(labels.postFields[base],base);assert.ok(labels.postGroups[c.group],c.group);
  assert.match(labels.postChannelLabel(c,'zh'),/[\u3400-\u9fff]/,c.name);
  assert.doesNotMatch(labels.postChannelLabel(c,'en'),/[\u3400-\u9fff]/,c.name);
  assert.equal(labels.matchesPostChannel(c,c.native),true);
 }
 const groups=[...new Set(channels.map(c=>c.group))],icons=groups.map(labels.postGroupIcon);
 assert.equal(new Set(icons).size,groups.length);assert.ok(!icons.includes('folder'));
 const exposure=channels.find(c=>c.name==='ExposureCompensation');
 assert.equal(labels.postChannelLabel(exposure,'zh'),'曝光补偿');assert.equal(labels.postChannelLabel(exposure,'en'),'Exposure Compensation');
 assert.equal(labels.matchesPostChannel(exposure,'曝光补偿'),true);assert.equal(labels.matchesPostChannel(exposure,'exposure compensation'),true);
 const red=channels.find(c=>c.name==='SceneColorTintR');assert.equal(labels.postChannelLabel(red,'zh'),'场景颜色色调 · R');
 assert.equal(labels.postChannelLabel({name:'CustomField'},'en'),'Custom Field');
});
