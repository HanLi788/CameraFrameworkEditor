const {_electron:electron}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {fixture}=require('./framework-fixture.cjs');
(async()=>{
 const project=await fixture();await fs.mkdir(project.storage,{recursive:true});await fs.writeFile(path.join(project.storage,'settings.json'),JSON.stringify({recent:[project.workspaceRoot]}));
 const env={...process.env,CAMERA_EDITOR_TEST_DATA:project.storage};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch(process.argv.includes('--packaged')?{executablePath:path.resolve('release/win-unpacked/相机框架编辑器.exe'),env}:{args:[path.resolve('.')],env}),main=await app.firstWindow(),errors=[];
 main.setDefaultTimeout(30000);main.on('pageerror',error=>errors.push(error.message));
 const until=async check=>{const deadline=Date.now()+45000;while(!await check()){if(Date.now()>deadline)throw Error('Stepper save did not settle');await new Promise(resolve=>setTimeout(resolve,75));}};
 try{
  await main.locator('.recent button').click();await main.locator('.asset-workbench-body').waitFor();
  const file='Assets/GameplayCameraSystem/CameraAssets/ActionCamera/Dash/ValueAssets/Focus/Character/Dash_Player.transitionValue';
  const original=JSON.parse((await project.read(file)).text).Duration;
  await main.evaluate(file=>window.cameraEditor.openFile({path:file}),file);const duration=main.getByLabel('Duration',{exact:true});await duration.waitFor();
  await duration.fill('0.2');await duration.press('ArrowUp');assert.equal(await duration.inputValue(),'0.21');
  await main.getByRole('button',{name:'Duration 增加',exact:true}).click();assert.equal(await duration.inputValue(),'0.22');
  await duration.press('ArrowDown');await duration.press('Shift+ArrowDown');assert.equal(await duration.inputValue(),'0.11');
  await duration.press('Alt+ArrowUp');assert.equal(await duration.inputValue(),'0.111');await duration.press('Escape');assert.equal(await duration.inputValue(),String(original));
  await duration.fill('0.2');await duration.press('ArrowUp');await main.getByRole('button',{name:'保存',exact:true}).click();
  await until(async()=>JSON.parse((await project.read(file)).text).Duration===.21);
  await main.getByRole('button',{name:'撤销',exact:true}).click();await until(async()=>await duration.inputValue()===String(original));
  await main.getByRole('button',{name:'保存',exact:true}).click();await until(async()=>JSON.parse((await project.read(file)).text).Duration===original);
  assert.deepEqual((await project.validate()).issues,[]);assert.deepEqual(errors,[]);
  console.log('PASS packaged decimal keyboard/button steps, Shift/Alt modifiers, Escape, actual Lua save and undo.');
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});await app.close().catch(()=>{});}
})().catch(error=>{console.error(error);process.exitCode=1;});
