const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{spawnSync}=require('node:child_process');
test('range table numeric rules and allowed references agree with real Lua even for disabled channels',async()=>{
 const {rangeChannels,rangeError,referencesFor,parseRangeNumber}=await import('../src/rangeChannels.mjs');
 const cases=[];
 for(const [name] of rangeChannels)for(const [min,max] of [[-180,180],[0,0],[0,180],[.01,179.99],[-1,1],[1,0],[1e100,1e101]])for(const ref of ['Absolute','World','ViewpointRotation','ViewpointHorizontalVelocity','ViewpointSpatialVelocity','ViewpointVelocityDirection'])cases.push({name,min,max,ref});
 const lua=`require('CameraFramework.Editor.Environment');local C=require('CameraFramework.Editor.Validation.Ranges');local I=require('CameraFramework.GameplayCameraSystem.States.FrameStateDefinition');local J=require('Foundation.Serialization.JsonReader');for _,c in ipairs(J.Decode(io.read('*a'))) do c.min=tonumber(c.min);c.max=tonumber(c.max);local safe=pcall(J.Decode,string.format('[%.17g,%.17g]',c.min,c.max));local r=C.NewRanges();local v=r[c.name];v.Range={Min=c.min,Max=c.max};local angle=c.name:match('^Rotation')~=nil;if angle then v.Range.Reference=c.ref end;local ok=pcall(C.ValidateRanges,r,'Test');print(tostring(safe and ok and (angle or c.ref=='Absolute'))) end`;
 const workspace=path.dirname(process.env.CAMERA_FRAMEWORK_TEST_ROOT||'F:/cslua3/ue5cs/cslua/Content/Lua/CameraFramework');
 const result=spawnSync(path.resolve('runtime/lua54.exe'),['-e',lua],{cwd:workspace,input:JSON.stringify(cases.map(c=>({...c,min:String(c.min),max:String(c.max)}))),encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.error?.message||result.stderr);
 const answers=result.stdout.trim().split(/\r?\n/);cases.forEach((c,i)=>assert.equal(!rangeError(c.name,c.min,c.max)&&referencesFor(c.name).includes(c.ref),answers[i]==='true',JSON.stringify(c)));
 for(const text of ['', '-', '+', 'Infinity','NaN','0xff','1,2','[1]'])assert.ok(Number.isNaN(parseRangeNumber(text)),text);
 for(const [text,value] of [['-1.5',-1.5],['.5',.5],['1e3',1000]])assert.equal(parseRangeNumber(text),value);
});
