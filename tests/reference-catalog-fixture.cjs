const path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
module.exports=()=>{
 const source=process.env.CAMERA_FRAMEWORK_TEST_ROOT||'F:/cslua3/ue5cs/cslua/Content/Lua/CameraFramework';
 const run=spawnSync(path.resolve('runtime/lua54.exe'),['-e',"require('CameraFramework.Editor.Environment');io.write(require('CameraFramework.Shared.JsonCodec').Encode(require('CameraFramework.GameplayCameraSystem.Core.ReferenceCatalog').Export()))"],{cwd:path.dirname(source),encoding:'utf8',windowsHide:true});
 assert.equal(run.status,0,run.stderr);return JSON.parse(run.stdout);
};
