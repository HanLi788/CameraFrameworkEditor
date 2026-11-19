const {_electron:electron}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {fixture}=require('./framework-fixture.cjs');
(async()=>{
 const project=await fixture(),packaged=process.argv.includes('--packaged');
 await fs.mkdir(project.storage,{recursive:true});await fs.writeFile(path.join(project.storage,'settings.json'),JSON.stringify({recent:[project.workspaceRoot]}));
 const env={...process.env,CAMERA_EDITOR_TEST_DATA:project.storage};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch(packaged?{executablePath:path.resolve('release/win-unpacked/相机框架编辑器.exe'),env}:{args:[path.resolve('.')],env}),main=await app.firstWindow(),errors=[],times={};main.setDefaultTimeout(30000);main.on('pageerror',e=>errors.push(e.message));
 const until=async callback=>{const end=Date.now()+20000;while(!await callback()){assert.ok(Date.now()<end,'UI did not settle');await new Promise(resolve=>setTimeout(resolve,30));}};
 const state=()=>main.evaluate(()=>window.cameraEditor.sessionState());
 const blend='Assets/GameplayCameraSystem/CameraAssets/ActionCamera/Dash/InputBlendAssets/Dash_Default.inputBlend';
 const rig='Assets/GameplayCameraSystem/CameraAssets/ActionCamera/Dash/Dash.rig';
 try{
  await app.evaluate(({app})=>{
   const load=process.mainModule.require.bind(process.mainModule),{Project}=load(load('node:path').join(app.getAppPath(),'electron/project.cjs')),snapshot=Project.prototype.snapshot;
   globalThis.saveProfile={scans:0};Project.prototype.snapshot=function(...args){globalThis.saveProfile.project=this;globalThis.saveProfile.scans++;return snapshot.apply(this,args);};
  });
  await main.locator('.recent button').click();await main.locator('.asset-workbench-body').waitFor();
  await main.evaluate(file=>window.cameraEditor.openFile({path:file}),blend);
  const panel=main.getByRole('tabpanel',{name:blend,exact:true});await panel.waitFor();
  await app.evaluate(()=>{globalThis.saveProfile.scans=0;});
  let start=Date.now();await main.evaluate(async file=>{const s=await window.cameraEditor.sessionState(),d=s.docs.find(d=>d.path===file);return window.cameraEditor.editField({path:file,parts:['Rows',0,'Weights','FOV'],baseValue:JSON.parse(d.text).Rows[0].Weights.FOV,value:2});},blend);times.editAck=Date.now()-start;
  await until(async()=>(await state()).docs.find(d=>d.path===blend)?.validation?.status==='valid');times.backgroundValidation=Date.now()-start;
  start=Date.now();await main.getByRole('button',{name:'保存',exact:true}).click();await until(async()=>(await state()).docs.every(d=>!d.dirty));times.cachedSave=Date.now()-start;
  assert.equal(JSON.parse((await project.read(blend)).text).Rows[0].Weights.FOV,2);
  await panel.getByLabel('Rows.0.Weights.FOV',{exact:true}).fill('3');start=Date.now();await app.evaluate(({BrowserWindow})=>{const contents=BrowserWindow.getAllWindows()[0].webContents;contents.sendInputEvent({type:'keyDown',keyCode:'S',modifiers:['control']});contents.sendInputEvent({type:'keyUp',keyCode:'S',modifiers:['control']});});await until(async()=>{const current=await state();return !current.busy&&current.docs.every(d=>!d.dirty)&&JSON.parse((await project.read(blend)).text).Rows[0].Weights.FOV===3;});times.immediateKeyboardSave=Date.now()-start;
  await main.evaluate(async({blend,rig})=>{
   await window.cameraEditor.ensure(rig);const s=await window.cameraEditor.sessionState();
   for(const [file,parts,value]of [[blend,['Rows',0,'Weights','FOV'],4],[rig,['Description'],'save all performance']]){const d=s.docs.find(d=>d.path===file);let base=JSON.parse(d.text);for(const part of parts)base=base[part];await window.cameraEditor.editField({path:file,parts,baseValue:base,value});}
  },{blend,rig});
  start=Date.now();await main.getByRole('button',{name:'全部保存',exact:true}).click();await until(async()=>(await state()).docs.every(d=>!d.dirty));times.saveAll=Date.now()-start;
  await new Promise(resolve=>setTimeout(resolve,450));
  const profile=await app.evaluate(()=>({scans:globalThis.saveProfile.scans,worker:globalThis.saveProfile.project.validator.stats}));
  assert.equal(profile.scans,0);assert.equal(profile.worker.starts,1);
  const d=(await state()).docs.find(d=>d.path===blend),external=d.text+'\n';
  await main.evaluate(async file=>{const s=await window.cameraEditor.sessionState(),d=s.docs.find(d=>d.path===file);return window.cameraEditor.editField({path:file,parts:['Rows',0,'Weights','FOV'],baseValue:4,value:5});},blend);
  await fs.writeFile(path.join(project.root,blend),external);await until(async()=>(await state()).docs.find(d=>d.path===blend).conflict);
  await main.getByRole('button',{name:'保存',exact:true}).click();await main.getByRole('alertdialog').waitFor();assert.equal((await project.read(blend)).text,external);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({times,profile}));console.log('PASS background validation, cached Save, immediate Ctrl+S, Save All, no directory rescans and external conflicts');
 }catch(error){console.log('FAILURE STATE',JSON.stringify((await state()).docs.map(({path,version,dirty,validation})=>({path,version,dirty,validation}))));await main.screenshot({path:'test-results/fast-save-failure.png'});throw error;}finally{project.close();await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1;});
