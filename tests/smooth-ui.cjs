const {_electron:electron}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'camera-smooth-ui-')),source=process.env.CAMERA_FRAMEWORK_TEST_ROOT||'D:/MyWorks/Lua/CameraFramework';
 for(const name of ['CameraFramework','Foundation','InputSystem'])await fs.cp(path.join(path.dirname(source),name),path.join(dir,name),{recursive:true});
 for(const name of ['PlayerEvents','MovementValues'])await fs.cp(path.join(path.dirname(source),'Actor/Player',name+'.lua'),path.join(dir,'Actor/Player',name+'.lua'));
 const data=path.join(dir,'data');await fs.mkdir(data);await fs.writeFile(path.join(data,'settings.json'),JSON.stringify({recent:[dir]}));
 const env={...process.env,CAMERA_EDITOR_TEST_DATA:data};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch(process.argv.includes('--packaged')?{executablePath:path.resolve('release/win-unpacked/相机框架编辑器.exe'),env}:{args:[path.resolve('.')],env});
 const page=await app.firstWindow(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 const file='Assets/CameraAssets/ActionCamera/Player/Dash/SmoothAssets/Dash_Default.smooth';
 const panel=page.getByRole('tabpanel',{name:file,exact:true}),detail=page.locator('dialog.asset-detail-dialog');
 const state=()=>page.evaluate(()=>window.cameraEditor.bootstrap()),draft=async()=>JSON.parse((await state()).session.docs.find(d=>d.path===file).text);
 const until=async fn=>{for(let i=0;i<200;i++){if(await fn())return;await page.waitForTimeout(50);}throw Error('State did not settle');};
 const save=()=>app.evaluate(({Menu})=>Menu.getApplicationMenu().items[0].submenu.items.find(i=>i.accelerator==='CmdOrCtrl+S').click());
 try{
  await page.locator('.recent button').click();await page.locator('.workbench-body').waitFor();assert.deepEqual((await state()).project.issues,[]);
  await page.evaluate(p=>window.cameraEditor.openFile({path:p}),file);await panel.waitFor();assert.equal(await panel.locator('tbody tr').count(),8);assert.equal(await panel.locator('thead th').count(),5);assert.equal(await panel.getByLabel('Name',{exact:true}).count(),0);assert.equal(await panel.locator('.inline-curve').count(),0);
  const before=await draft(),min=panel.getByLabel('Dist.SpeedRange.Min',{exact:true}),max=panel.getByLabel('Dist.SpeedRange.Max',{exact:true});
  await min.fill('20');await min.press('Tab');assert.equal(await max.evaluate(el=>el===document.activeElement),true);assert.deepEqual((await draft()).Channels.Dist.SpeedRange,before.Channels.Dist.SpeedRange);
  await max.fill('40');await max.press('Enter');await until(async()=>(await draft()).Channels.Dist.SpeedRange.Max===40);assert.equal((await draft()).Channels.Dist.SpeedRange.Min,20);
  await detail.getByRole('button',{name:'撤销',exact:true}).click();await until(async()=>(await draft()).Channels.Dist.SpeedRange.Max===8);assert.deepEqual((await draft()).Channels.Dist.SpeedRange,before.Channels.Dist.SpeedRange);
  await min.fill('-1');await min.press('Enter');await panel.getByText('平滑速率不能为负数',{exact:true}).waitFor();assert.equal((await draft()).Channels.Dist.SpeedRange.Min,8);await min.press('Escape');
  const lag=panel.getByLabel('CameraRot.MaxLag',{exact:true});await lag.fill('181');await lag.press('Enter');await panel.getByText('旋转最大滞后不能超过 180°',{exact:true}).waitFor();await save();await page.getByRole('heading',{name:'操作未完成',exact:true}).waitFor();await page.locator('.modal').getByRole('button',{name:'关闭',exact:true}).click();assert.deepEqual(JSON.parse(await fs.readFile(path.join(dir,'CameraFramework',file),'utf8')),before);await lag.focus();await lag.press('Escape');assert.equal(await lag.inputValue(),'180');
  await min.fill('0');await max.fill('12');await max.press('Enter');await until(async()=>(await draft()).Channels.Dist.SpeedRange.Max===12);
  await panel.getByLabel('Dist.MaxLag',{exact:true}).fill('0');await save();await until(async()=>!(await state()).session.docs.find(d=>d.path===file).dirty&&(await draft()).Channels.Dist.MaxLag===0);
  const row=panel.locator('[data-smooth-channel="Dist"]'),height=(await row.boundingBox()).height;
  await row.locator('.slot-name').hover();const tip=detail.locator('.curve-hover-preview');await tip.waitFor();assert.equal(await tip.getByRole('img',{name:'曲线只读预览',exact:true}).count(),1);assert.equal((await row.boundingBox()).height,height);const bounds=await tip.boundingBox(),view=await page.evaluate(()=>({w:innerWidth,h:innerHeight}));assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=view.w&&bounds.y+bounds.height<=view.h);
  await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/smooth-curve-preview.png'});
  const select=row.getByLabel('选择曲线 Channels.Dist.ResponseCurve',{exact:true});await select.focus();await page.keyboard.press('Escape');await tip.waitFor({state:'hidden'});assert.equal(await detail.isVisible(),true);
  const curve='Assets/CurveAssets/Bezier/EaseInOut.curve',curveOriginal=await fs.readFile(path.join(dir,'CameraFramework',curve),'utf8');
  await select.selectOption(curve);await until(async()=>(await draft()).Channels.Dist.ResponseCurve===curve);
  await row.getByRole('button',{name:'打开 Channels.Dist.ResponseCurve',exact:true}).click();await page.getByRole('tabpanel',{name:curve,exact:true}).waitFor();await detail.getByRole('button',{name:'返回上一个资产',exact:true}).click();await panel.waitFor();
  await row.getByRole('button',{name:'查看引用 Channels.Dist.ResponseCurve',exact:true}).click();assert.ok(await row.locator('.slot-users button').count()>0);await row.getByRole('button',{name:'查看引用 Channels.Dist.ResponseCurve',exact:true}).click();
  await row.getByRole('button',{name:'替换 Channels.Dist.ResponseCurve',exact:true}).click();const picker=page.getByRole('dialog',{name:'选择Curve',exact:true});await picker.waitFor();await picker.getByLabel('筛选引用资产',{exact:true}).fill('Linear.curve');await picker.locator('.picker-list button').first().click();await until(async()=>(await draft()).Channels.Dist.ResponseCurve.endsWith('/Linear.curve'));
  const enabled=row.getByLabel('Dist.bEnabled',{exact:true});await enabled.click();await until(async()=>(await draft()).Channels.Dist.bEnabled===false);assert.equal(await min.isEditable(),true);await enabled.click();await until(async()=>(await draft()).Channels.Dist.bEnabled===true);
  await save();await until(async()=>!(await state()).session.docs.find(d=>d.path===file).dirty);const saved=JSON.parse(await fs.readFile(path.join(dir,'CameraFramework',file),'utf8'));assert.equal(saved.SchemaVersion,2);assert.equal(saved.Name,before.Name);assert.equal(saved.Description,before.Description);assert.equal(saved.Channels.Dist.SpeedRange.Min,0);assert.equal(saved.Channels.Dist.MaxLag,0);assert.equal(await fs.readFile(path.join(dir,'CameraFramework',curve),'utf8'),curveOriginal);
  await page.mouse.move(3,3);await page.screenshot({path:'test-results/smooth-table.png'});
  await page.evaluate(()=>window.cameraEditor.preferences({language:'en'}));await panel.getByRole('columnheader',{name:'Smoothing rate help',exact:false}).waitFor();assert.doesNotMatch(await panel.locator('table').innerText(),/[\u3400-\u9fff]/);await panel.getByRole('button',{name:'Maximum lag help',exact:true}).hover();await detail.getByRole('tooltip').waitFor();assert.match(await detail.getByRole('tooltip').innerText(),/180/);
  await detail.getByRole('button',{name:'Source',exact:true}).click();await panel.locator('.monaco-editor').waitFor();assert.deepEqual(errors,[]);
  console.log('Smooth UI passed: 8 channels, atomic rates/undo, lag/zero validation, hover preview, shared curves, picker, checkboxes, save/source and languages. Fixture:',dir);
 }catch(e){await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/smooth-failure.png'}).catch(()=>{});throw e;}
 finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1;});
