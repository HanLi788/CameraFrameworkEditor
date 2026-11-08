const {_electron:electron}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'camera-live-debug-ui-')),source=process.env.CAMERA_FRAMEWORK_TEST_ROOT||'D:/MyWorks/Lua/CameraFramework';
 for(const name of ['CameraFramework','Foundation','InputSystem'])await fs.cp(path.join(path.dirname(source),name),path.join(temp,name),{recursive:true});
 for(const name of ['PlayerEvents','MovementValues'])await fs.cp(path.join(path.dirname(source),'Actor/Player',name+'.lua'),path.join(temp,'Actor/Player',name+'.lua'));
 const data=path.join(temp,'data');await fs.mkdir(data);await fs.writeFile(path.join(data,'settings.json'),JSON.stringify({recent:[temp]}));
 const env={...process.env,CAMERA_EDITOR_TEST_DATA:data};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch(process.argv.includes('--packaged')?{executablePath:path.resolve('release/win-unpacked/相机框架编辑器.exe'),env}:{args:[path.resolve('.')],env});
 const main=await app.firstWindow(),errors=[];main.on('pageerror',e=>errors.push(e.message));main.setDefaultTimeout(30000);
 const until=async fn=>{const end=Date.now()+30000;while(!await fn()){if(Date.now()>end)throw Error('UI live-debug timeout');await new Promise(r=>setTimeout(r,30));}};
 const state=()=>main.evaluate(()=>window.cameraEditor.bootstrap());
 try{
  await main.locator('.recent button').click();await main.locator('[data-live-debug="ready"]').waitFor();
  const first='Assets/CameraAssets/ActionCamera/Player/Run/InputAssets/Run_User.input',second='Assets/CameraAssets/ActionCamera/Player/Walk/InputAssets/Walk_User.input';
  await main.evaluate(async files=>{for(const file of files){const s=await window.cameraEditor.ensure(file),doc=s.docs.find(d=>d.path===file),value=JSON.parse(doc.text);value.Channels.Dist.DefaultSensitivity+=.5;await window.cameraEditor.editText({path:file,baseText:doc.text,text:JSON.stringify(value,null,2)+'\n'});}},[first,second]);
  const foreground=await app.evaluate(async({BrowserWindow})=>{const win=new BrowserWindow({width:480,height:280,title:'UE focus fixture',webPreferences:{sandbox:true}});await win.loadURL('data:text/html,<title>UE focus fixture</title><p>Foreground input fixture</p>');win.show();win.focus();return win.id;});
  await until(()=>app.evaluate(({BrowserWindow},id)=>BrowserWindow.getFocusedWindow()?.id===id,foreground));
  const directory=path.join(temp,'CameraFramework/.editor/live-debug'),session=JSON.parse(await fs.readFile(path.join(directory,'session.json'),'utf8')).Session;
  const request=async index=>{const id=session+'-123456-'+index;await fs.writeFile(path.join(directory,id+'.request.json'),JSON.stringify({SchemaVersion:1,Session:session,RequestId:id,Status:'Requested'}));await until(async()=>!!await fs.stat(path.join(directory,id+'.result.json')).catch(()=>null));return {id,...JSON.parse(await fs.readFile(path.join(directory,id+'.result.json'),'utf8'))};};
  const success=await request(1);assert.equal(success.Status,'Saved');assert.equal((await state()).session.docs.filter(d=>d.dirty).length,0);
  assert.equal(await app.evaluate(({BrowserWindow},id)=>BrowserWindow.getFocusedWindow()?.id===id,foreground),true);
  await fs.writeFile(path.join(directory,success.id+'.ack.json'),JSON.stringify({SchemaVersion:1,Session:session,RequestId:success.id,Status:'Reloaded'}));
  await main.locator('[data-live-debug="reloaded"]').waitFor();
  const before=await fs.readFile(path.join(temp,'CameraFramework',first),'utf8');
  await main.evaluate(async file=>{const s=await window.cameraEditor.ensure(file),doc=s.docs.find(d=>d.path===file);await window.cameraEditor.editText({path:file,baseText:doc.text,text:'invalid JSON'});},first);
  const failure=await request(2);assert.equal(failure.Status,'Failed');assert.equal(await fs.readFile(path.join(temp,'CameraFramework',first),'utf8'),before);
  await main.locator('[data-live-debug="error"]').waitFor();assert.equal((await state()).session.docs.find(d=>d.path===first).dirty,true);
  assert.equal(await app.evaluate(({BrowserWindow},id)=>BrowserWindow.getFocusedWindow()?.id===id,foreground),true);
  await main.evaluate(file=>window.cameraEditor.discard(file),first);
  await fs.mkdir('test-results',{recursive:true});await main.screenshot({path:'test-results/live-debug-background.png'});
  assert.deepEqual(errors,[]);console.log('PASS: background save-all, Lua validation failure, reload acknowledgement and foreground retention');
 }finally{await app.close();console.log('UI fixture:',temp);}
})().catch(error=>{console.error(error);process.exitCode=1;});
