const {_electron:electron}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {fixture}=require('./framework-fixture.cjs');
(async()=>{
 const first=await fixture(),second=await fixture(),packaged=process.argv.includes('--packaged'),prefix=packaged?'packaged-':'';
 await fs.mkdir(first.storage,{recursive:true});await fs.writeFile(path.join(first.storage,'settings.json'),JSON.stringify({recent:[first.workspaceRoot]}));
 const env={...process.env,CAMERA_EDITOR_TEST_DATA:first.storage};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch(packaged?{executablePath:path.resolve('release/win-unpacked/相机框架编辑器.exe'),env}:{args:[path.resolve('.')],env}),main=await app.firstWindow(),errors=[];
 main.setDefaultTimeout(30000);main.on('pageerror',error=>errors.push(error.message));
 const loading=main.getByRole('status',{name:'正在加载工作区…',exact:true});
 const state=()=>main.evaluate(()=>window.cameraEditor.bootstrap());
 const begin=root=>main.evaluate(root=>{window.switchAttempt=window.cameraEditor.openProject(root).then(()=>({ok:true}),error=>({error:error.message}));},root);
 const finish=()=>main.evaluate(()=>window.switchAttempt);
 const shot=async name=>{await fs.mkdir('test-results',{recursive:true});await main.screenshot({path:'test-results/'+prefix+name+'.png'});};
 const rig='Assets/GameplayCameraSystem/CameraAssets/ActionCamera/Dash/Dash.rig';
 try{
  await main.locator('.recent button').click();await loading.waitFor();
  assert.equal((await state()).workspaceLoading,true);await loading.getByRole('progressbar',{name:'加载进度'}).waitFor();
  assert.equal(await main.locator('.welcome').evaluate(node=>node.inert),true);
  assert.equal(await loading.locator('h1').innerText(),'正在加载工作区…');assert.equal((await loading.innerText()).includes(first.workspaceRoot),false);
  await shot('workspace-loading-first');await loading.waitFor({state:'detached'});await main.locator('.asset-workbench-body').waitFor();
  assert.equal((await state()).project.workspaceRoot,first.workspaceRoot);
  await main.evaluate(file=>window.cameraEditor.openFile({path:file}),rig);await main.getByRole('tabpanel',{name:rig,exact:true}).waitFor();
  console.log('PASS first entry displays a graphite loading screen until initialization completes');

  // A failed switch must preserve the existing workspace, tabs and usable validator.
  await app.evaluate(({app})=>{
   const load=process.mainModule.require.bind(process.mainModule),{Project}=load(load('node:path').join(app.getAppPath(),'electron/project.cjs'));
   const warmup=Project.prototype.warmup;let fail=true;
   Project.prototype.warmup=async function(...args){if(fail){fail=false;await new Promise(resolve=>setTimeout(resolve,350));throw Error('injected initialization failure');}return warmup.apply(this,args);};
  });
  await begin(second.workspaceRoot);await loading.waitFor();await shot('workspace-loading-switch');
  assert.equal(await main.locator('.app-shell').evaluate(node=>node.inert),true);
  await assert.rejects(()=>main.evaluate(file=>window.cameraEditor.openFile({path:file}),rig),/正在加载工作区/);
  await assert.rejects(()=>main.evaluate(root=>window.cameraEditor.openProject(root),first.workspaceRoot),/正在加载工作区/);
  const failed=await finish();assert.match(failed.error,/injected initialization failure/);await loading.waitFor({state:'detached'});
  const retained=await state();assert.equal(retained.workspaceLoading,false);assert.equal(retained.project.workspaceRoot,first.workspaceRoot);assert.equal(retained.meta.file,rig);
  assert.equal(await main.locator('.app-shell').evaluate(node=>node.inert),false);assert.deepEqual((await main.evaluate(()=>window.cameraEditor.validate())).issues,[]);
  console.log('PASS initialization failure returns to the original workspace and blocks overlapping actions');

  await begin(second.workspaceRoot);await loading.waitFor();assert.equal((await finish()).ok,true);await loading.waitFor({state:'detached'});
  const switched=await state();assert.equal(switched.project.workspaceRoot,second.workspaceRoot);assert.deepEqual(switched.meta.tabs,[]);assert.equal(switched.workspaceLoading,false);
  await app.evaluate(({dialog},root)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[root]});},path.join(second.workspaceRoot,'MissingWorkspace'));
  await main.getByRole('button',{name:'打开工作区',exact:true}).click();const failure=main.getByRole('alertdialog',{name:'操作未完成'});await failure.waitFor();
  assert.equal(await loading.count(),0);assert.equal((await state()).project.workspaceRoot,second.workspaceRoot);await failure.getByRole('button',{name:'关闭',exact:true}).click();
  // Directory selection cancellation must leave the editor visible without starting a load.
  await app.evaluate(({dialog})=>{dialog.showOpenDialog=async()=>({canceled:true,filePaths:[]});});
  assert.equal(await main.evaluate(()=>window.cameraEditor.chooseProject()),null);assert.equal(await loading.count(),0);
  await main.getByRole('button',{name:'打开工作区',exact:true}).click();assert.equal(await loading.count(),0);
  assert.deepEqual(errors,[]);await shot('workspace-loading-complete');console.log('PASS successful switch and cancelled folder selection');
 }catch(error){await shot('workspace-loading-failure').catch(()=>{});throw error;}
 finally{first.close();second.close();await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
})().catch(error=>{console.error(error);process.exitCode=1;});
