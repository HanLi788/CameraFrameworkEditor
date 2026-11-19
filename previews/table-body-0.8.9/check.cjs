const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');process.chdir(root);
const {_electron:electron}=require(path.join(root,'node_modules/playwright'));
const {fixture}=require(path.join(root,'tests/framework-fixture.cjs'));
(async()=>{
 const project=await fixture(),snapshot=await project.snapshot();await fs.mkdir(project.storage,{recursive:true});await fs.writeFile(path.join(project.storage,'settings.json'),JSON.stringify({recent:[project.workspaceRoot]}));
 const env={...process.env,CAMERA_EDITOR_TEST_DATA:project.storage};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch({executablePath:path.join(root,'release/win-unpacked/相机框架编辑器.exe'),env}),main=await app.firstWindow(),errors=[];main.setDefaultTimeout(30000);main.on('pageerror',error=>errors.push(error.message));
 const check=async(file,type,processor)=>{
  await main.evaluate(request=>window.cameraEditor.openFile(request),{path:file,...(processor!==undefined?{processor}:{})});const panel=main.getByRole('tabpanel',{name:file,exact:true});await panel.waitFor();
  const colors=await panel.locator('table tbody th,table tbody td,.pipeline-table .sortable-row,.pipeline-disabled-row').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).backgroundColor));
  assert.ok(colors.length>0,type+' has visible table cells');assert.ok(colors.every(color=>color==='rgb(43, 46, 49)'),type+': '+[...new Set(colors)].join(', '));
  const headers=await panel.locator('table thead th,.pipeline-header').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).backgroundImage));assert.ok(headers.length>0&&headers.every(image=>image.includes('linear-gradient')),type+' has uniform header gradients');
  if(['InputBlend','Value'].includes(type)){const input=panel.locator('input:not([type=checkbox])').first();assert.match(await input.evaluate(node=>getComputedStyle(node).backgroundImage),/linear-gradient/);await main.mouse.move(0,0);await main.screenshot({path:path.join(__dirname,type+'.png')});}
  console.log(type+': '+colors.length+' cells/rows use #2B2E31');
 };
 try{
  await main.locator('.recent button').click();await main.locator('.asset-workbench-body').waitFor();
  await check('Assets/GameplayCameraSystem/CameraAssets/ActionCamera/Dash/Dash.rig','Rig','Input');
  for(const type of ['InputBlend','Value','Range','Smooth','Sensitivity','Input','Effect','NumEffect','BoolEffect','Filter','Pipeline']){
   const asset=snapshot.assets.find(asset=>asset.type===type);if(asset)await check(asset.path,type);
  }
  assert.deepEqual(errors,[]);console.log('PASS: all table bodies, fixed columns and pipeline rows match; headers and inputs retain their shading.');
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
})().catch(error=>{console.error(error);process.exitCode=1;});
