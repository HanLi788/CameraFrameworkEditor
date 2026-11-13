const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {Project}=require('../electron/project.cjs');
const source=process.env.CAMERA_FRAMEWORK_TEST_ROOT||'F:/cslua3/ue5cs/cslua/Content/Lua/CameraFramework';
async function fixture(){
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'camera-editor-current-'));
 for(const directory of ['CameraFramework','Foundation','InputSystem','EventBus'])await fs.cp(path.join(path.dirname(source),directory),path.join(temp,directory),{recursive:true});
 await fs.mkdir(path.join(temp,'Actor/Player'),{recursive:true});
 for(const name of ['MovementValues','PlayerEvents'])await fs.copyFile(path.join(path.dirname(source),'Actor/Player',name+'.lua'),path.join(temp,'Actor/Player',name+'.lua'));
 return Project.open(temp,path.join(temp,'data'),path.resolve('runtime/lua54.exe'));
}
module.exports={fixture,source};
