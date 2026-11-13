const {test,before}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {Project,encode}=require('../electron/project.cjs'),{InputCatalog}=require('../electron/input-catalog.cjs');
let project,dir,definitions,original;
const file='Assets/GameplayCameraSystem/CameraAssets/ActionCamera/Run/InputAssets/Run_User.userInput',runtime=path.resolve('runtime/lua54.exe');
before(async()=>{
 dir=await fs.mkdtemp(path.join(os.tmpdir(),'camera-user-input-'));const source=process.env.CAMERA_FRAMEWORK_TEST_ROOT||'F:/cslua3/ue5cs/cslua/Content/Lua/CameraFramework';
 for(const name of ['CameraFramework','Foundation','InputSystem','EventBus'])await fs.cp(path.join(path.dirname(source),name),path.join(dir,name),{recursive:true});
 for(const name of ['PlayerEvents','MovementValues'])await fs.cp(path.join(path.dirname(source),'Actor/Player',name+'.lua'),path.join(dir,'Actor/Player',name+'.lua'));
 definitions=path.join(dir,'InputSystem/MyIMC/Definition/Definitions');original=JSON.parse(await fs.readFile(path.join(definitions,'ActionCamera.json'),'utf8'));
 project=await Project.open(dir,path.join(dir,'data'),runtime);
});
test('catalog uses real registry/reader, refreshes definitions and modules, and reports invalid definitions',async()=>{
 const catalog=new InputCatalog(),first=await catalog.read(dir,runtime);assert.deepEqual(first.issues,[]);assert.ok(first.contexts.some(c=>c.name==='ActionCamera'&&c.mappings.includes('LookTurn')));
 const custom=structuredClone(original);custom.Mappings={'CustomTurn':custom.Mappings.LookTurn};const customFile=path.join(definitions,'CustomInput.json');await fs.writeFile(customFile,encode(custom));
 await fs.mkdir(path.join(definitions,'Nested'));await fs.writeFile(path.join(definitions,'Nested/Ignored.json'),encode(custom));
 const second=await catalog.read(dir,runtime);assert.notEqual(first.revision,second.revision);assert.deepEqual(second.contexts.find(c=>c.name==='CustomInput').mappings,['CustomTurn']);assert.ok(!second.contexts.some(c=>c.name==='Ignored'));
 const reader=path.join(dir,'InputSystem/MyIMC/Config/Reader.lua'),readerText=await fs.readFile(reader,'utf8');
 try{await fs.writeFile(reader,'error("REAL_READER_EXECUTED")\n'+readerText);assert.match((await catalog.read(dir,runtime)).issues[0].message,/REAL_READER_EXECUTED/);}finally{await fs.writeFile(reader,readerText);}
 custom.SchemaVersion=0;await fs.writeFile(customFile,encode(custom));const invalid=await catalog.read(dir,runtime);assert.ok(invalid.contexts.find(c=>c.name==='CustomInput').error);assert.ok(invalid.issues.some(i=>i.path.endsWith('CustomInput.json')));
 await fs.unlink(customFile);assert.deepEqual((await catalog.read(dir,runtime)).issues,[]);
 const retry=new InputCatalog();assert.equal((await retry.read(dir,path.join(dir,'missing-lua.exe'))).runtime,false);assert.equal((await retry.read(dir,runtime)).runtime,true);
});
test('user-input v5 rejects old names/schema, unknown IMC and active missing mappings without writing',async()=>{
 const doc=await project.read(file),original=JSON.parse(doc.text);assert.equal(original.SchemaVersion,1);assert.ok(original.IMCName);assert.equal(original.IMC,undefined);
 for(const mutate of [d=>d.SchemaVersion=3,d=>d.IMC='ActionCamera',d=>d.Channels.RotationRoll.Mapping='',d=>d.IMCName='Missing',d=>d.Channels.RotationYaw.MappingName='Missing',d=>d.Channels.RotationYaw.MappingName='',d=>d.Channels.RotationYaw.DefaultSensitivity='1']){
  const data=structuredClone(original);mutate(data);await assert.rejects(()=>project.save({...doc,text:encode(data)}));assert.equal((await project.read(file)).text,doc.text);
 }
});
test('zero/negative multipliers and disabled unavailable mappings persist through actual Lua validation',async()=>{
 const doc=await project.read(file),data=JSON.parse(doc.text);data.Channels.RotationYaw.DefaultSensitivity=-2;data.Channels.RotationPitch.DefaultSensitivity=0;data.Channels.RotationRoll.MappingName='UnavailableButDisabled';
 const saved=JSON.parse((await project.save({...doc,text:encode(data)})).text);assert.deepEqual(saved,data);
 data.Channels.RotationRoll.bEnabled=true;const current=await project.read(file);await assert.rejects(()=>project.save({...current,text:encode(data)}));
 await project.save({...await project.read(file),text:doc.text});
});
test('input definition changes during save are detected before writing assets',async()=>{
 const doc=await project.read(file),definition=path.join(definitions,'ActionCamera.json'),originalText=await fs.readFile(definition,'utf8'),validate=project.validate;
 project.validate=async function(overrides){const result=await validate.call(this,overrides);await fs.writeFile(definition,originalText+'\n');return result;};
 try{await assert.rejects(()=>project.save({...doc,text:doc.text+'\n'}),/校验期间/);assert.equal((await project.read(file)).text,doc.text);}finally{project.validate=validate;await fs.writeFile(definition,originalText);}
});
