const fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'../..');process.chdir(root);
const {_electron:electron}=require(path.join(root,'node_modules/playwright'));
const {fixture}=require(path.join(root,'tests/framework-fixture.cjs'));
(async()=>{
 const project=await fixture();await fs.mkdir(project.storage,{recursive:true});await fs.writeFile(path.join(project.storage,'settings.json'),JSON.stringify({recent:[project.workspaceRoot]}));
 const env={...process.env,CAMERA_EDITOR_TEST_DATA:project.storage};delete env.ELECTRON_RUN_AS_NODE;
 const packaged=process.argv.includes('--packaged'),prefix=packaged?'packaged-':'';
 const app=await electron.launch(packaged?{executablePath:path.join(root,'release/win-unpacked/相机框架编辑器.exe'),env}:{args:[root],env});
 const page=await app.firstWindow();page.setDefaultTimeout(30000);
 const shot=async name=>{await page.mouse.move(0,0);await page.screenshot({path:path.join(__dirname,prefix+name+'.png')});};
 const open=async file=>{await page.evaluate(file=>window.cameraEditor.openFile({path:file}),file);await page.getByRole('tabpanel',{name:file,exact:true}).waitFor();};
 try{
  await page.locator('.recent button').waitFor();await shot('01-welcome');await page.locator('.recent button').click();await page.locator('.asset-workbench-body').waitFor();
  const base='Assets/GameplayCameraSystem/CameraAssets/ActionCamera/Dash/';
  await page.evaluate(file=>window.cameraEditor.openFile({path:file,processor:'Input'}),base+'Dash.rig');await page.locator('[data-rig-group=Input]').waitFor();await shot('02-rig');
  await page.getByRole('button',{name:'替换 Processors.Input.Assets.0',exact:true}).click();await page.locator('.asset-picker').waitFor();await shot('03-picker');await page.locator('.asset-picker').getByRole('button',{name:'取消',exact:true}).click();
  await open(base+'ValueAssets/Focus/Character/Dash_Player.transitionValue');await page.getByLabel('AnchorLocOffset.Reference',{exact:true}).selectOption('CurrentViewpoint');await page.getByLabel('AnchorLocOffset.Reference.Slot',{exact:true}).waitFor();await shot('04-channels');
  await open(base+'RangeAssets/Dash_Default.range');await shot('05-range');
  await open('Assets/Shared/CurveAssets/Bezier/Linear.curve');await shot('06-curve');
  await page.getByRole('tab',{name:base+'Dash.rig',exact:true}).click({button:'right'});await page.getByRole('menuitem',{name:'查看引用',exact:true}).click();await page.getByRole('dialog',{name:'资产引用',exact:true}).waitFor();await shot('07-dialog');
  console.log('PASS graphite startup, workbench, picker, inline channels, range, curve and dialog screenshots.');
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
})().catch(error=>{console.error(error);process.exitCode=1;});
