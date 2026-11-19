const {_electron:electron}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {fixture}=require('./framework-fixture.cjs');
(async()=>{
 const project=await fixture();await fs.mkdir(project.storage,{recursive:true});await fs.writeFile(path.join(project.storage,'settings.json'),JSON.stringify({recent:[project.workspaceRoot]}));
 const env={...process.env,CAMERA_EDITOR_TEST_DATA:project.storage};delete env.ELECTRON_RUN_AS_NODE;
 const packaged=process.argv.includes('--packaged'),prefix=packaged?'packaged-':'';
 const app=await electron.launch(packaged?{executablePath:path.resolve('release/win-unpacked/相机框架编辑器.exe'),env}:{args:[path.resolve('.')],env}),main=await app.firstWindow(),errors=[];
 main.setDefaultTimeout(30000);main.on('pageerror',error=>errors.push(error.message));
 const until=async check=>{const deadline=Date.now()+45000;while(!await check()){if(Date.now()>deadline)throw Error('Layout save did not settle');await new Promise(resolve=>setTimeout(resolve,75));}};
 const read=async file=>JSON.parse((await project.read(file)).text);
 const open=async file=>{await main.evaluate(file=>window.cameraEditor.openFile({path:file}),file);const panel=main.getByRole('tabpanel',{name:file,exact:true});await panel.waitFor();return panel;};
 const shot=async name=>{await fs.mkdir('test-results',{recursive:true});await main.mouse.move(0,0);await main.screenshot({path:'test-results/'+prefix+'layout-'+name+'.png'});};
 const picker=async control=>{await control.click();await until(async()=>await control.evaluate(node=>node.matches(':open')));const colors=await control.evaluate(node=>({appearance:getComputedStyle(node).appearance,background:getComputedStyle(node,'::picker(select)').backgroundColor,color:getComputedStyle(node,'::picker(select)').color}));assert.equal(colors.appearance,'base-select');assert.equal(colors.background,'rgb(43, 46, 49)');assert.equal(colors.color,'rgb(215, 218, 221)');};
 try{
  await main.locator('.recent button').click();await main.locator('.asset-workbench-body').waitFor();
  const base='Assets/GameplayCameraSystem/CameraAssets/ActionCamera/Dash/',rigPath=base+'Dash.rig';
  await main.evaluate(file=>window.cameraEditor.openFile({path:file,processor:'Input'}),rigPath);const rig=main.getByRole('tabpanel',{name:rigPath,exact:true});await rig.locator('[data-rig-group=Input]').waitFor();
  const tables=await rig.locator('.mount-table-section').evaluateAll(nodes=>nodes.map(node=>{const box=node.getBoundingClientRect();return {top:box.top,bottom:box.bottom};}));assert.equal(tables.length,3);assert.ok(Math.abs(tables[1].top-tables[0].bottom-20)<1);assert.ok(Math.abs(tables[2].top-tables[1].bottom-20)<1);await shot('spacing');
  const space=main.getByLabel('相机空间',{exact:true});const previousSpace=await space.inputValue();await picker(space);await shot('dropdown');await space.press('Escape');assert.equal(await space.inputValue(),previousSpace);
  const file=base+'InputBlendAssets/Dash_Default.inputBlend',before=await read(file),blend=await open(file);
  assert.equal(await blend.locator('.fields,.blend-tools').count(),0);assert.equal(await blend.getByLabel('Name',{exact:true}).count(),0);
  const {blendChannels}=await import('../src/inputBlend.mjs');
  assert.deepEqual(await blend.locator('tbody>tr').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('data-blend-channel'))),blendChannels.map(([name])=>name));
  assert.equal(await blend.locator('thead th').count(),before.Rows.length+1);assert.equal(await blend.locator('tbody>tr>td').count(),blendChannels.length*before.Rows.length);
  const cards=await blend.locator('thead [data-asset-card]').evaluateAll(nodes=>nodes.map(node=>{const box=node.getBoundingClientRect(),actions=node.querySelector('.asset-card-actions').getBoundingClientRect();return {width:box.width,inside:actions.right<=box.right&&actions.left>=box.left};}));assert.ok(cards.every(card=>card.width===200&&card.inside));
  const first=blend.getByLabel('Rows.0.Weights.FOV',{exact:true}),second=blend.getByLabel('Rows.1.Weights.Distance',{exact:true});
  await first.fill('-2');await second.fill('0.5');await main.getByRole('button',{name:'保存',exact:true}).click();
  await until(async()=>{const value=await read(file);return value.Rows[0].Weights.FOV===-2&&value.Rows[1].Weights.Distance===.5;});
  const expected=structuredClone(before);expected.Rows[0].Weights.FOV=-2;expected.Rows[1].Weights.Distance=.5;assert.deepEqual(await read(file),expected);
  await main.getByRole('button',{name:'撤销',exact:true}).click();await until(async()=>await second.inputValue()===String(before.Rows[1].Weights.Distance));assert.equal(await first.inputValue(),'-2');
  await main.getByRole('button',{name:'重做',exact:true}).click();await until(async()=>await second.inputValue()==='0.5');await shot('blend');
  const snapshot=await project.snapshot(),source=snapshot.assets.find(asset=>asset.documentId===before.Rows[0].InputAsset.$ref.DocumentId);
  await blend.getByRole('button',{name:'打开挂载资产 Rows.0.InputAsset',exact:true}).click();await main.getByRole('tabpanel',{name:source.path,exact:true}).waitFor();
  await main.getByRole('tab',{name:file,exact:true}).click();await blend.waitFor();assert.equal(await first.inputValue(),'-2');
  const value=await open(base+'ValueAssets/Focus/Character/Dash_Player.transitionValue'),performance=value.getByLabel('PerformanceType.BaseName',{exact:true});await picker(performance);await shot('value-dropdown');await performance.press('Escape');
  const referenceBounds=await value.locator('.reference-fields select').evaluateAll(nodes=>nodes.map(node=>{const box=node.getBoundingClientRect(),cell=node.closest('td').getBoundingClientRect();return box.left>=cell.left&&box.right<=cell.right;}));assert.ok(referenceBounds.length>0&&referenceBounds.every(Boolean));
  const curveFile='Assets/Shared/CurveAssets/Bezier/Linear.curve',curve=await open(curveFile),panels=curve.locator('.curve-point-panel');assert.equal(await panels.count(),4);
  for(const point of ['P1','P2','P3','P4']){const panel=curve.locator('[data-curve-point="'+point+'"]');assert.equal(await panel.count(),1);const boxes=await panel.locator('input').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().y));assert.ok(Math.abs(boxes[0]-boxes[1])<1);}
  assert.equal(await curve.getByLabel('曲线.P1.Y',{exact:true}).isEditable(),false);assert.equal(await curve.getByLabel('曲线.P4.Y',{exact:true}).isEditable(),false);
  await curve.getByLabel('曲线.P2.Y',{exact:true}).fill('0.4');await curve.getByLabel('曲线.P2.Y',{exact:true}).press('Enter');await until(async()=>await curve.getByLabel('曲线.P2.Y',{exact:true}).inputValue()==='0.4');await main.getByRole('button',{name:'保存',exact:true}).click();await until(async()=>(await read(curveFile)).P2.Y===.4);
  await curve.locator('[data-curve-point=P3] header button').click();assert.equal(await curve.getByLabel('选中节点',{exact:true}).inputValue(),'2');await shot('curve');
  const nodeSelect=curve.getByLabel('选中节点',{exact:true});await picker(nodeSelect);await shot('curve-dropdown');await nodeSelect.press('Escape');
  const spline=snapshot.assets.find(asset=>asset.type==='Curve'&&asset.data.ParentType==='CubicHermiteSpline');assert.ok(spline);const splinePanel=await open(spline.path);assert.equal(await splinePanel.locator('.curve-point-panel').count(),spline.data.Points.length);assert.equal(await splinePanel.locator('.curve-point-tangent').count(),spline.data.Points.length);
  assert.deepEqual((await project.validate()).issues,[]);assert.deepEqual(errors,[]);
  console.log('PASS removed blend toolbar, transposed cell coordinates/save/undo/navigation, 20px gaps, dark open pickers and independent inline curve point panels.');
 }catch(error){await shot('failure').catch(()=>{});throw error;}
 finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
})().catch(error=>{console.error(error);process.exitCode=1;});
