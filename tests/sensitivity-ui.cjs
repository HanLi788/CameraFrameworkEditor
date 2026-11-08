const {_electron:electron}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'camera-sensitivity-ui-')),source=process.env.CAMERA_FRAMEWORK_TEST_ROOT||'D:/MyWorks/Lua/CameraFramework';
 for(const name of ['CameraFramework','Foundation','InputSystem'])await fs.cp(path.join(path.dirname(source),name),path.join(dir,name),{recursive:true});
 for(const name of ['PlayerEvents','MovementValues'])await fs.cp(path.join(path.dirname(source),'Actor/Player',name+'.lua'),path.join(dir,'Actor/Player',name+'.lua'));
 const data=path.join(dir,'data');await fs.mkdir(data);await fs.writeFile(path.join(data,'settings.json'),JSON.stringify({recent:[dir]}));
 const env={...process.env,CAMERA_EDITOR_TEST_DATA:data};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch(process.argv.includes('--packaged')?{executablePath:path.resolve('release/win-unpacked/相机框架编辑器.exe'),env}:{args:[path.resolve('.')],env});
 const page=await app.firstWindow(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 const file='Assets/CameraAssets/ActionCamera/Player/Run/SensitivityAssets/Run_Default.sensitivity',input='Assets/CameraAssets/ActionCamera/Player/Run/InputAssets/Run_User.input',unit='Assets/CurveAssets/CubicHermiteSpline/RangeUnit.curve',linear='Assets/CurveAssets/CubicHermiteSpline/RangeLinearEdge.curve';
 const detail=page.locator('dialog.asset-detail-dialog'),panel=p=>page.getByRole('tabpanel',{name:p,exact:true}),state=()=>page.evaluate(()=>window.cameraEditor.bootstrap());
 const draft=async p=>JSON.parse((await state()).session.docs.find(d=>d.path===p).text),disk=async p=>JSON.parse(await fs.readFile(path.join(dir,'CameraFramework',p),'utf8'));
 const until=async fn=>{for(let i=0;i<200;i++){if(await fn())return;await page.waitForTimeout(50);}throw Error('State did not settle');};
 const save=()=>app.evaluate(({Menu})=>Menu.getApplicationMenu().items[0].submenu.items.find(i=>i.accelerator==='CmdOrCtrl+S').click());
 const open=async p=>{await page.evaluate(p=>window.cameraEditor.openFile({path:p}),p);await panel(p).waitFor();};
 try{
  await page.locator('.recent button').click();await page.locator('.workbench-body').waitFor();assert.deepEqual((await state()).project.issues,[]);
  await open(file);const p=panel(file),original=await disk(file);assert.equal(await p.locator('tbody tr').count(),12);assert.equal(await p.locator('thead th').count(),4);assert.equal(await p.getByLabel('Name',{exact:true}).count(),0);assert.equal(await p.getByLabel('RangeAsset',{exact:true}).count(),0);
  const escape=p.locator('[data-field="Channels.Yaw.EscapeCurve"] select'),back=p.locator('[data-field="Channels.Yaw.ReturnCurve"] select');assert.equal(await escape.inputValue(),unit);assert.equal(await back.inputValue(),unit);assert.doesNotMatch((await escape.locator('option').allTextContents()).join('|'),/\.curve/);
  await escape.selectOption(linear);await until(async()=>(await draft(file)).Channels.Yaw.EscapeCurve===linear);await escape.hover();await detail.locator('.curve-hover-preview').waitFor();await page.mouse.move(2,2);
  await p.getByLabel('FOV.bEnabled',{exact:true}).click();await until(async()=>(await draft(file)).Channels.FOV.bEnabled===true);await p.getByLabel('AnchorLocOffset.X.bEnabled',{exact:true}).click();await until(async()=>(await draft(file)).Channels['AnchorLocOffset.X'].bEnabled===true);
  await save();await until(async()=>!(await state()).session.docs.find(d=>d.path===file).dirty);const valid=await disk(file);assert.equal(valid.Channels.Yaw.EscapeCurve,linear);assert.equal(valid.Name,original.Name);assert.equal(valid.SchemaVersion,3);
  await back.selectOption(linear);await until(async()=>(await draft(file)).Channels.Yaw.ReturnCurve===linear);await save();await page.getByRole('heading',{name:'操作未完成',exact:true}).waitFor();assert.match(await page.locator('.modal').innerText(),/ReturnCurve/);await page.locator('.modal').getByRole('button',{name:'关闭',exact:true}).click();assert.deepEqual(await disk(file),valid);
  await detail.getByRole('button',{name:'撤销',exact:true}).click();await until(async()=>(await draft(file)).Channels.Yaw.ReturnCurve===unit);
  await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/sensitivity-table.png'});
  await page.evaluate(()=>window.cameraEditor.preferences({language:'en'}));await p.getByRole('columnheader',{name:'Escape curve',exact:false}).waitFor();assert.doesNotMatch(await p.locator('table').innerText(),/[\u3400-\u9fff]/);await page.evaluate(()=>window.cameraEditor.preferences({language:'zh'}));
  await open(input);const u=panel(input);await u.getByRole('columnheader',{name:'默认灵敏度',exact:false}).waitFor();assert.equal(await u.locator('[data-mount="SensitivityAssets"] .asset-slot').count(),1);assert.equal(await u.getByLabel('Yaw.Weight',{exact:true}).count(),0);
  await u.getByLabel('Yaw.DefaultSensitivity',{exact:true}).fill('-2');await save();await until(async()=>!(await state()).session.docs.find(d=>d.path===input).dirty&&(await disk(input)).Channels.Yaw.DefaultSensitivity===-2);
  await u.locator('[data-mount="SensitivityAssets"]').scrollIntoViewIfNeeded();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await u.getByRole('button',{name:'更多操作 SensitivityAssets.0',exact:true}).click();await page.getByRole('menuitem',{name:'移除 SensitivityAssets.0',exact:true}).click();await until(async()=>(await draft(input)).SensitivityAssets.length===0);await detail.getByRole('button',{name:'撤销',exact:true}).click();await until(async()=>(await draft(input)).SensitivityAssets[0]===file);
  await u.getByRole('button',{name:'打开 SensitivityAssets.0',exact:true}).click();await panel(file).waitFor();assert.deepEqual(errors,[]);
  console.log('Sensitivity UI passed: 12 channels, dual unit defaults, curve editing/preview, signed default sensitivity, source mounts, undo, translations and rejected zero return. Fixture:',dir);
 }catch(e){await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/sensitivity-failure.png'}).catch(()=>{});throw e;}
 finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1;});
