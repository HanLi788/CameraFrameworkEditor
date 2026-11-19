const {_electron:electron}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {fixture}=require('./framework-fixture.cjs');
(async()=>{
 const project=await fixture();await fs.mkdir(project.storage,{recursive:true});await fs.writeFile(path.join(project.storage,'settings.json'),JSON.stringify({recent:[project.workspaceRoot]}));
 const env={...process.env,CAMERA_EDITOR_TEST_DATA:project.storage};delete env.ELECTRON_RUN_AS_NODE;
 const packaged=process.argv.includes('--packaged'),prefix=packaged?'packaged-':'';
 const app=await electron.launch(packaged?{executablePath:path.resolve('release/win-unpacked/相机框架编辑器.exe'),env}:{args:[path.resolve('.')],env}),main=await app.firstWindow(),errors=[];main.setDefaultTimeout(30000);main.on('pageerror',e=>errors.push(e.message));
 const file='Assets/PostProcessingSystem/Base/MapName/Cave/Cave_1002.virtualInput',base='Assets/GameplayCameraSystem/CameraAssets/ActionCamera/Dash/';
 const state=()=>main.evaluate(()=>window.cameraEditor.sessionState());
 const until=async callback=>{const end=Date.now()+20000;while(!await callback()){assert.ok(Date.now()<end,'UI did not settle');await new Promise(resolve=>setTimeout(resolve,40));}};
 const open=async file=>{await main.evaluate(file=>window.cameraEditor.openFile({path:file}),file);const panel=main.getByRole('tabpanel',{name:file,exact:true});await panel.waitFor();return panel;};
 const save=async()=>{await main.getByRole('button',{name:'保存',exact:true}).click();await until(async()=>{const s=await state();return !s.busy&&s.docs.every(d=>!d.dirty);});};
 const shot=async name=>{await fs.mkdir('test-results',{recursive:true});await main.screenshot({path:'test-results/'+prefix+name+'.png'});};
 const measure=panel=>panel.evaluate(node=>{const table=node.querySelector('.post-value-table');return {table:table.getBoundingClientRect().width,labelGaps:[...node.querySelectorAll('.fields.depth-0>.field')].map(field=>{const label=field.querySelector(':scope>label'),control=field.querySelector(':scope>.field-control');return {gap:control.getBoundingClientRect().left-label.getBoundingClientRect().right,label:label.getBoundingClientRect().width,text:label.textContent};}),name:node.querySelector('[aria-label=Name]').getBoundingClientRect().width,priority:node.querySelector('[aria-label=Priority]').getBoundingClientRect().width,slider:node.querySelector('.post-slider').getBoundingClientRect().width,number:node.querySelector('[data-post-channel] .number-box').getBoundingClientRect().width};});
 try{
  await main.locator('.recent button').click();await main.locator('.asset-workbench-body').waitFor();const post=await open(file);
  assert.deepEqual(await post.locator('.post-value-table thead th').allTextContents(),['通道','调节','值','是否写入']);
  const initial=await measure(post);assert.equal(initial.name,200);assert.equal(initial.priority,100);assert.equal(initial.slider,240);assert.equal(initial.number,100);assert.ok(initial.labelGaps.every(x=>Math.abs(x.gap-8)<1));assert.ok(initial.labelGaps.find(x=>x.text==='名称').label<40);assert.ok(initial.table<700);
  await post.getByLabel('后处理分组',{exact:true}).selectOption('Vignette');await shot('detail-post-compact');
  const row=post.locator('[data-post-channel=VignetteSoftness]'),check=row.getByLabel('Outputs.VignetteSoftness.Write',{exact:true});if(!await check.isChecked())await check.click();await until(()=>check.isChecked());
  const number=row.getByLabel('Outputs.VignetteSoftness',{exact:true}),slider=row.getByLabel('Outputs.VignetteSoftness.Adjust',{exact:true});await until(async()=>!(await number.isDisabled()));
  const original=Number(await number.inputValue()),docBefore=(await state()).docs.find(d=>d.path===file),version=docBefore.version;
  const box=await slider.boundingBox();await main.mouse.move(box.x+box.width*.3,box.y+box.height/2);await main.mouse.down();await main.mouse.move(box.x+box.width*.65,box.y+box.height/2,{steps:8});
  assert.equal((await state()).docs.find(d=>d.path===file).version,version);const preview=Number(await number.inputValue());assert.notEqual(preview,original);await main.mouse.up();await until(async()=>(await state()).docs.find(d=>d.path===file).version===version+1);
  await main.getByRole('button',{name:'撤销',exact:true}).click();await until(async()=>Number((await number.inputValue()))===original);await main.getByRole('button',{name:'重做',exact:true}).click();await until(async()=>Number((await number.inputValue()))===preview);
  await number.fill('12.3456789012345');await save();assert.equal(JSON.parse((await project.read(file)).text).Outputs.VignetteSoftness,12.3456789012345);assert.ok(Number(await slider.getAttribute('max'))>=12.3456789012345);
  await number.fill('0');await number.press('Enter');await row.getByRole('alert').waitFor();assert.equal(JSON.parse((await project.read(file)).text).Outputs.VignetteSoftness,12.3456789012345);await number.press('Escape');
  await slider.press('ArrowLeft');await until(async()=>Number(await number.inputValue())!==12.3456789012345);await save();
  await check.click();await until(async()=>await number.isDisabled());assert.equal(await slider.isDisabled(),true);await save();assert.equal(Object.hasOwn(JSON.parse((await project.read(file)).text).Outputs,'VignetteSoftness'),false);
  // Widths remain CSS pixel constants across window resizing and detail scaling.
  for(const width of [1920,1100]){await app.evaluate(({BrowserWindow},width)=>BrowserWindow.getAllWindows()[0].setSize(width,980),width);await until(async()=>await main.evaluate(()=>innerWidth)===width-16||await main.evaluate(()=>innerWidth)===width);const current=await measure(post);for(const key of ['table','name','priority','slider','number'])assert.ok(Math.abs(current[key]-initial[key])<1,key);}
  await post.evaluate(node=>node.style.zoom='1.25');assert.ok(Math.abs((await measure(post)).slider-300)<1);await post.evaluate(node=>node.style.zoom='');
  const value=await open(base+'ValueAssets/Focus/Character/Dash_Player.transitionValue');await value.getByLabel('AnchorLocOffset.Value.X',{exact:true}).waitFor();const tableWidth=await value.locator('.value-table').evaluate(el=>el.getBoundingClientRect().width);assert.ok(tableWidth>1000);assert.equal(await value.locator('.value-table').evaluate(el=>el.closest('.asset-form-scroll').scrollWidth>el.closest('.asset-form-scroll').clientWidth),true);await shot('detail-value-narrow');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1920,980));await open(base+'Dash.rig');const mountWidths=await main.locator('[role=tabpanel][aria-label="'+base+'Dash.rig"] .mount-table').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().width));assert.ok(mountWidths.length>0&&mountWidths.every(w=>Math.abs(w-440)<2));await shot('detail-mounts-fixed');
  const numeric=await open('Assets/PostProcessingSystem/Add/Actor/Characters/LuaPlayer/Movement/ViewpointVelocity/MovementSpeed.numEffect');assert.equal(await numeric.locator('input[type=range]').count(),0);assert.equal(await numeric.locator('.post-numeric-table thead th').count(),4);
  assert.deepEqual((await project.validate()).issues,[]);assert.deepEqual(errors,[]);console.log('PASS intrinsic labels, fixed CSS pixel controls/tables, resizing/zoom/scroll, shared slider-number draft, single-gesture undo, native hard bounds, precise Save and unchanged numeric effect expressions');
 }catch(error){await shot('detail-geometry-failure').catch(()=>{});throw error;}
 finally{project.close();await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
})().catch(error=>{console.error(error);process.exitCode=1;});
