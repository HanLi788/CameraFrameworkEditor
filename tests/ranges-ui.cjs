const {_electron:electron}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'camera-ranges-ui-')),source=process.env.CAMERA_FRAMEWORK_TEST_ROOT||'D:/MyWorks/Lua/CameraFramework';
 for(const name of ['CameraFramework','Foundation','InputSystem'])await fs.cp(path.join(path.dirname(source),name),path.join(dir,name),{recursive:true});
 for(const name of ['PlayerEvents','MovementValues'])await fs.cp(path.join(path.dirname(source),'Actor/Player',name+'.lua'),path.join(dir,'Actor/Player',name+'.lua'));
 const data=path.join(dir,'data');await fs.mkdir(data);await fs.writeFile(path.join(data,'settings.json'),JSON.stringify({recent:[dir]}));
 const env={...process.env,CAMERA_EDITOR_TEST_DATA:data};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch(process.argv.includes('--packaged')?{executablePath:path.resolve('release/win-unpacked/相机框架编辑器.exe'),env}:{args:[path.resolve('.')],env});
 const page=await app.firstWindow(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 const file='Assets/CameraAssets/ActionCamera/Player/Dash/RangeAssets/Dash_Default.range';
 const panel=page.getByRole('tabpanel',{name:file,exact:true}),detail=page.locator('dialog.asset-detail-dialog');
 const state=()=>page.evaluate(()=>window.cameraEditor.bootstrap()),draft=async()=>JSON.parse((await state()).session.docs.find(d=>d.path===file).text);
 const until=async fn=>{for(let i=0;i<200;i++){if(await fn())return;await page.waitForTimeout(50);}throw Error('State did not settle');};
 const save=()=>app.evaluate(({Menu})=>Menu.getApplicationMenu().items[0].submenu.items.find(i=>i.accelerator==='CmdOrCtrl+S').click());
 try{
  await page.locator('.recent button').click();await page.locator('.workbench-body').waitFor();assert.deepEqual((await state()).project.issues,[]);
  await page.evaluate(p=>window.cameraEditor.openFile({path:p}),file);await panel.waitFor();assert.equal(await panel.locator('tbody tr').count(),12);assert.equal(await panel.locator('thead th').count(),4);
  const before=await draft(),min=panel.getByLabel('Dist.Min',{exact:true}),max=panel.getByLabel('Dist.Max',{exact:true});
  await min.fill('30000');await min.press('Tab');assert.equal(await max.evaluate(el=>el===document.activeElement),true);assert.deepEqual((await draft()).Channels.Dist,before.Channels.Dist);
  await max.fill('40000');await max.press('Enter');await until(async()=>(await draft()).Channels.Dist.Max===40000);assert.equal((await draft()).Channels.Dist.Min,30000);
  await detail.getByRole('button',{name:'撤销',exact:true}).click();await until(async()=>(await draft()).Channels.Dist.Min===before.Channels.Dist.Min);assert.deepEqual((await draft()).Channels.Dist,before.Channels.Dist);
  await min.fill('900');await max.fill('800');await max.press('Enter');await panel.getByText('最小值不能大于最大值',{exact:true}).waitFor();assert.deepEqual((await draft()).Channels.Dist,before.Channels.Dist);
  await save();await page.getByRole('heading',{name:'操作未完成',exact:true}).waitFor();await page.locator('.modal').getByRole('button',{name:'关闭',exact:true}).click();assert.deepEqual(JSON.parse(await fs.readFile(path.join(dir,'CameraFramework',file),'utf8')),before);
  await min.fill('300');await max.fill('30000');await save();await until(async()=>!(await state()).session.docs.find(d=>d.path===file).dirty&&(await draft()).Channels.Dist.Min===300);
  assert.equal(JSON.parse(await fs.readFile(path.join(dir,'CameraFramework',file),'utf8')).Channels.Dist.Max,30000);
  await min.fill('-');await min.press('Tab');await max.press('Enter');await panel.getByText('请输入完整的有限数值',{exact:true}).waitFor();await max.press('Escape');assert.equal(await min.inputValue(),'300');
  const yaw=panel.getByRole('combobox',{name:'Yaw.Reference',exact:true});await yaw.click();
  const list=detail.getByRole('listbox');await list.waitFor();await list.getByRole('button',{name:'所属对象水平速度方向 说明',exact:true}).hover();await detail.getByRole('tooltip').waitFor();assert.match(await detail.getByRole('tooltip').innerText(),/10 cm\/s/);
  await list.getByRole('option',{name:'所属对象水平速度方向',exact:true}).click();await until(async()=>(await draft()).Channels.Yaw.Reference==='OwnerHorizontalVelocity');await panel.getByRole('button',{name:'Yaw 速度参考说明',exact:true}).hover();await detail.getByRole('tooltip').waitFor();
  await page.mouse.move(3,3);await panel.getByRole('combobox',{name:'Pitch.Reference',exact:true}).click();assert.equal(await list.getByRole('option',{name:'所属对象水平速度方向',exact:true}).count(),0);await page.keyboard.press('Escape');
  const enabled=panel.getByLabel('Yaw.bEnabled',{exact:true});await enabled.click();await until(async()=>(await draft()).Channels.Yaw.bEnabled===false);assert.equal(await panel.getByLabel('Yaw.Min',{exact:true}).isEditable(),true);await enabled.click();await until(async()=>(await draft()).Channels.Yaw.bEnabled===true);
  await save();await until(async()=>!(await state()).session.docs.find(d=>d.path===file).dirty);const saved=JSON.parse(await fs.readFile(path.join(dir,'CameraFramework',file),'utf8'));assert.equal(saved.SchemaVersion,6);assert.equal(saved.Channels.Yaw.Reference,'OwnerHorizontalVelocity');assert.equal(saved.Description,before.Description);assert.equal(saved.Channels.Yaw.VelocityDirection,undefined);
  await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/range-table.png'});
  await page.evaluate(()=>window.cameraEditor.preferences({language:'en'}));await panel.getByRole('columnheader',{name:'Reference frame',exact:true}).waitFor();assert.doesNotMatch(await panel.locator('table').innerText(),/[\u3400-\u9fff]/);assert.equal(await yaw.innerText(),'Owner horizontal velocity');await yaw.focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('End');await page.keyboard.press('Enter');await until(async()=>(await draft()).Channels.Yaw.Reference==='OwnerSpatialVelocity');
  await detail.getByRole('button',{name:'Source',exact:true}).click();await panel.locator('.monaco-editor').waitFor();assert.equal((await draft()).Channels.Yaw.Reference,'OwnerSpatialVelocity');assert.deepEqual(errors,[]);
  console.log('Range UI passed: 12 channels, atomic interval/undo, invalid save prevention, fixed punctuation, filtered references/help, checkbox, bilingual labels and real Lua save. Fixture:',dir);
 }catch(e){await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/range-failure.png'}).catch(()=>{});throw e;}
 finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1;});
