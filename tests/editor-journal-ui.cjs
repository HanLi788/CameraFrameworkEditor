const {_electron:electron}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {fixture}=require('./framework-fixture.cjs'),{startGame}=require('./game-host.cjs');
(async()=>{
 const project=await fixture(),host=startGame(project);await host.ready;
 await fs.mkdir(project.storage,{recursive:true});await fs.writeFile(path.join(project.storage,'settings.json'),JSON.stringify({recent:[project.workspaceRoot]}));
 const env={...process.env,CAMERA_EDITOR_TEST_DATA:project.storage};delete env.ELECTRON_RUN_AS_NODE;
 const packaged=process.argv.includes('--packaged'),prefix=packaged?'packaged-':'';
 const app=await electron.launch(packaged?{executablePath:path.resolve('release/win-unpacked/相机框架编辑器.exe'),env}:{args:[path.resolve('.')],env}),main=await app.firstWindow(),errors=[];main.setDefaultTimeout(30000);main.on('pageerror',error=>errors.push(error.message));
 const file='Assets/GameplayCameraSystem/CameraAssets/ActionCamera/Dash/InputBlendAssets/Dash_Default.inputBlend';
 const state=()=>main.evaluate(()=>window.cameraEditor.sessionState());
 const until=async callback=>{const end=Date.now()+20000;while(!await callback()){assert.ok(Date.now()<end,'UI did not settle');await new Promise(resolve=>setTimeout(resolve,40));}};
 const shot=async name=>{await fs.mkdir('test-results',{recursive:true});await main.screenshot({path:'test-results/'+prefix+name+'.png'});};
 try{
  await app.evaluate(({app})=>{const load=process.mainModule.require.bind(process.mainModule),{Project}=load(load('node:path').join(app.getAppPath(),'electron/project.cjs')),snapshot=Project.prototype.snapshot;globalThis.journalScans=0;Project.prototype.snapshot=function(...args){globalThis.journalProject=this;globalThis.journalScans++;return snapshot.apply(this,args);};});
  await main.locator('.recent button').click();await main.locator('.asset-workbench-body').waitFor();await main.evaluate(file=>window.cameraEditor.openFile({path:file}),file);
  const panel=main.getByRole('tabpanel',{name:file,exact:true});await panel.waitFor();
  await app.evaluate(()=>{globalThis.journalScans=0;});
  await app.evaluate(()=>{const queue=globalThis.journalProject.editorJournal;globalThis.journalAppend=queue.append;queue.append=async()=>{throw Error('injected journal append failure');};});
  await panel.getByLabel('Rows.0.Weights.FOV',{exact:true}).fill('2');await main.getByRole('button',{name:'保存',exact:true}).click();
  await main.getByText('JSON 已保存，日志待重试',{exact:true}).waitFor();const failed=(await state()).docs.find(d=>d.path===file);assert.equal(failed.dirty,false);assert.equal(failed.sync.canRetry,true);assert.equal(JSON.parse((await project.read(file)).text).Rows[0].Weights.FOV,2);assert.equal(await main.getByRole('alertdialog').count(),0);await shot('journal-retry');
  await app.evaluate(()=>{globalThis.journalProject.editorJournal.append=globalThis.journalAppend;});
  await main.getByRole('button',{name:'保存',exact:true}).click();await until(async()=>(await state()).docs.find(d=>d.path===file).sync.status==='queued');
  assert.deepEqual((await host.request('queue')).Ids,[failed.sync.requestId]);assert.equal((await host.request('reload')).Status,'Imported');
  await main.getByText('保存完成，游戏已导入',{exact:true}).waitFor();assert.equal((await state()).docs.find(d=>d.path===file).sync.status,'applied');await shot('journal-imported');
  await panel.getByLabel('Rows.0.Weights.FOV',{exact:true}).fill('3');await app.evaluate(({BrowserWindow})=>{const c=BrowserWindow.getAllWindows()[0].webContents;c.sendInputEvent({type:'keyDown',keyCode:'S',modifiers:['control']});c.sendInputEvent({type:'keyUp',keyCode:'S',modifiers:['control']});});
  await until(async()=>{const d=(await state()).docs.find(d=>d.path===file);return !d.dirty&&d.sync.status==='queued'&&JSON.parse(d.text).Rows[0].Weights.FOV===3;});assert.equal((await host.request('queue')).Count,1);assert.equal((await host.request('reload')).Status,'Imported');await main.getByText('保存完成，游戏已导入',{exact:true}).waitFor();
  const asset=(await main.evaluate(()=>window.cameraEditor.bootstrap())).project.assets.find(a=>a.path===file);
  await host.request('submit',{documentId:asset.documentId,patch:[{op:'replace',path:'/Description',value:'game checkpoint'}]});assert.equal((await host.request('checkpoint')).Status,'Checkpointed');await until(async()=>JSON.parse((await state()).docs.find(d=>d.path===file).text).Description==='game checkpoint');
  assert.equal(await app.evaluate(()=>globalThis.journalScans),0);assert.deepEqual(errors,[]);console.log('PASS saved JSON, failed journal status, clean Save retry, original request ID, real Lua import receipt, Ctrl+S and checkpoint refresh without tree scans');
 }catch(error){await shot('journal-failure').catch(()=>{});throw error;}
 finally{host.close();project.close();await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
})().catch(error=>{console.error(error);process.exitCode=1;});
