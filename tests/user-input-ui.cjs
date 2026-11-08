const {_electron:electron}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'camera-user-input-ui-')),source=process.env.CAMERA_FRAMEWORK_TEST_ROOT||'D:/MyWorks/Lua/CameraFramework';
 for(const name of ['CameraFramework','Foundation','InputSystem'])await fs.cp(path.join(path.dirname(source),name),path.join(dir,name),{recursive:true});
 for(const name of ['PlayerEvents','MovementValues'])await fs.cp(path.join(path.dirname(source),'Actor/Player',name+'.lua'),path.join(dir,'Actor/Player',name+'.lua'));
 const definitions=path.join(dir,'InputSystem/MyIMC/Definition/Definitions'),custom=JSON.parse(await fs.readFile(path.join(definitions,'ActionCamera.json'),'utf8'));custom.Mappings={CustomTurn:custom.Mappings.LookTurn};await fs.writeFile(path.join(definitions,'CustomInput.json'),JSON.stringify(custom));
 const data=path.join(dir,'data');await fs.mkdir(data);await fs.writeFile(path.join(data,'settings.json'),JSON.stringify({recent:[dir]}));
 const env={...process.env,CAMERA_EDITOR_TEST_DATA:data};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch(process.argv.includes('--packaged')?{executablePath:path.resolve('release/win-unpacked/相机框架编辑器.exe'),env}:{args:[path.resolve('.')],env});
 const page=await app.firstWindow(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 const file='Assets/CameraAssets/ActionCamera/Player/Run/InputAssets/Run_User.input',detail=page.locator('dialog.asset-detail-dialog'),panel=page.getByRole('tabpanel',{name:file,exact:true}),state=()=>page.evaluate(()=>window.cameraEditor.bootstrap());
 const draft=async()=>JSON.parse((await state()).session.docs.find(d=>d.path===file).text),disk=async()=>JSON.parse(await fs.readFile(path.join(dir,'CameraFramework',file),'utf8'));
 const until=async fn=>{for(let i=0;i<200;i++){if(await fn())return;await page.waitForTimeout(50);}throw Error('State did not settle');};
 const save=()=>app.evaluate(({Menu})=>Menu.getApplicationMenu().items[0].submenu.items.find(i=>i.accelerator==='CmdOrCtrl+S').click());
 const saveError=async()=>{await save();await page.getByRole('heading',{name:'操作未完成',exact:true}).waitFor();await page.locator('.modal').getByRole('button',{name:'关闭',exact:true}).click();};
 try{
  await page.locator('.recent button').click();await page.locator('.workbench-body').waitFor();assert.deepEqual((await state()).project.issues,[]);
  await page.evaluate(p=>window.cameraEditor.openFile({path:p}),file);await panel.waitFor();const original=await disk();
  assert.equal(await panel.locator('tbody tr').count(),12);assert.equal(await panel.locator('thead th').count(),4);assert.equal(await panel.getByLabel('Name',{exact:true}).count(),0);
  const imc=panel.getByLabel('IMCName',{exact:true}),yaw=panel.getByLabel('Yaw.MappingName',{exact:true});
  assert.deepEqual(await imc.locator('option').allTextContents(),(await state()).project.inputCatalog.contexts.map(c=>c.name));
  assert.deepEqual((await yaw.locator('option').allTextContents()).slice(1),(await state()).project.inputCatalog.contexts.find(c=>c.name==='ActionCamera').mappings);
  await panel.getByLabel('Yaw.DefaultSensitivity',{exact:true}).fill('-2');await save();await until(async()=>!(await state()).session.docs.find(d=>d.path===file).dirty&&(await disk()).Channels.Yaw.DefaultSensitivity===-2);
  await detail.getByRole('button',{name:'撤销',exact:true}).click();await until(async()=>(await draft()).Channels.Yaw.DefaultSensitivity===original.Channels.Yaw.DefaultSensitivity);
  await panel.getByLabel('Pitch.DefaultSensitivity',{exact:true}).fill('0');await save();await until(async()=>!(await state()).session.docs.find(d=>d.path===file).dirty&&(await disk()).Channels.Pitch.DefaultSensitivity===0);
  const valid=await disk();await panel.getByLabel('Yaw.DefaultSensitivity',{exact:true}).fill('NaN');await saveError();assert.deepEqual(await disk(),valid);await panel.getByLabel('Yaw.DefaultSensitivity',{exact:true}).press('Escape');
  await panel.getByLabel('Roll.bEnabled',{exact:true}).click();await until(async()=>(await draft()).Channels.Roll.bEnabled===true);await saveError();assert.deepEqual(await disk(),valid);await panel.getByLabel('Roll.bEnabled',{exact:true}).click();await until(async()=>(await draft()).Channels.Roll.bEnabled===false);
  const beforeSwitch=(await draft()).Channels;await imc.selectOption('CustomInput');await until(async()=>(await draft()).IMCName==='CustomInput');assert.deepEqual((await draft()).Channels,beforeSwitch);assert.equal(await yaw.getAttribute('aria-invalid'),'true');assert.equal(await yaw.inputValue(),'LookTurn');assert.deepEqual(await yaw.locator('option').allTextContents(),['—','LookTurn','CustomTurn']);await saveError();assert.deepEqual(await disk(),valid);
  await imc.selectOption('ActionCamera');await until(async()=>(await draft()).IMCName==='ActionCamera');await save();await until(async()=>!(await state()).session.docs.find(d=>d.path===file).dirty);
  await panel.getByLabel('Yaw.DefaultSensitivity',{exact:true}).fill('-3');await panel.getByLabel('Yaw.DefaultSensitivity',{exact:true}).press('Enter');await until(async()=>(await draft()).Channels.Yaw.DefaultSensitivity===-3);
  const actionFile=path.join(definitions,'ActionCamera.json'),actionText=await fs.readFile(actionFile,'utf8'),action=JSON.parse(actionText);delete action.Mappings.LookTurn;action.Mappings.FreshTurn=custom.Mappings.CustomTurn;await fs.writeFile(actionFile,JSON.stringify(action));
  await until(async()=>await yaw.getAttribute('aria-invalid')==='true');assert.equal((await draft()).Channels.Yaw.DefaultSensitivity,-3);assert.equal(await yaw.inputValue(),'LookTurn');assert.equal(await yaw.getAttribute('aria-invalid'),'true');assert.equal(await yaw.locator('option[value="FreshTurn"]').count(),1);
  await fs.writeFile(actionFile,actionText);await until(async()=>await yaw.getAttribute('aria-invalid')==='false');await save();await until(async()=>!(await state()).session.docs.find(d=>d.path===file).dirty);assert.equal((await disk()).Channels.Yaw.DefaultSensitivity,-3);
  const saved=await disk();assert.equal(saved.SchemaVersion,5);assert.equal(saved.Name,original.Name);assert.equal(saved.IMC,undefined);assert.ok(Object.values(saved.Channels).every(c=>typeof c.MappingName==='string'&&!Object.hasOwn(c,'Mapping')));
  await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/user-input-table.png'});
  await page.evaluate(()=>window.cameraEditor.preferences({language:'en'}));await panel.getByRole('columnheader',{name:'Channels',exact:true}).waitFor();assert.equal(await imc.inputValue(),'ActionCamera');assert.equal(await yaw.locator('option:checked').textContent(),'LookTurn');assert.equal(await panel.getByRole('columnheader',{name:'MappingName',exact:true}).count(),1);assert.doesNotMatch(await panel.locator('table').innerText(),/[\u3400-\u9fff]/);
  await detail.getByRole('button',{name:'Source',exact:true}).click();await panel.locator('.monaco-editor').waitFor();assert.deepEqual(errors,[]);
  console.log('User input UI passed: real dropdowns, 12 channels, translation, retained mappings, multipliers/undo, save guards, source schema and live definition refresh. Fixture:',dir);
 }catch(e){await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/user-input-failure.png'}).catch(()=>{});throw e;}
 finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1;});
