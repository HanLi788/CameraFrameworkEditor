const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{spawnSync}=require('node:child_process');
test('range table numeric rules and allowed references agree with real Lua even for disabled channels',async()=>{
 const {rangeChannels,rangeError,referencesFor,parseRangeNumber}=await import('../src/rangeChannels.mjs');
 const cases=[];
 for(const [name] of rangeChannels)for(const [min,max] of [[-180,180],[0,0],[0,180],[.01,179.99],[-1,1],[1,0],[1e100,1e101]])for(const ref of ['Absolute','World','OwnerRotation','OwnerHorizontalVelocity','OwnerSpatialVelocity','OwnerVelocityDirection'])cases.push({name,min,max,ref});
 const lua=`require('CameraFramework.Test.Fakes.CameraAdapters').Install();local C=require('CameraFramework.CameraSystem.Nodes.ClampMethods');local I=require('CameraFramework.CameraSystem.Core.InputChannels');local J=require('Foundation.Serialization.JsonReader');for _,c in ipairs(J.Decode(io.read('*a'))) do c.min=tonumber(c.min);c.max=tonumber(c.max);local safe=pcall(J.Decode,string.format('[%.17g,%.17g]',c.min,c.max));local r=C.NewRanges();local v=I.GetConfig(r,I.GetDefinition(c.name));v.Range={Min=c.min,Max=c.max};local angle=c.name=='Yaw' or c.name=='Pitch' or c.name=='Roll';if angle then v.Range.Reference=c.ref end;local ok=pcall(C.ValidateRanges,r);print(tostring(safe and ok and (angle or c.ref=='Absolute'))) end`;
 const result=spawnSync(path.resolve('runtime/lua54.exe'),['-e',lua],{cwd:'D:/MyWorks/Lua',input:JSON.stringify(cases.map(c=>({...c,min:String(c.min),max:String(c.max)}))),encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);
 const answers=result.stdout.trim().split(/\r?\n/);cases.forEach((c,i)=>assert.equal(!rangeError(c.name,c.min,c.max)&&referencesFor(c.name).includes(c.ref),answers[i]==='true',JSON.stringify(c)));
 for(const text of ['', '-', '+', 'Infinity','NaN','0xff','1,2','[1]'])assert.ok(Number.isNaN(parseRangeNumber(text)),text);
 for(const [text,value] of [['-1.5',-1.5],['.5',.5],['1e3',1000]])assert.equal(parseRangeNumber(text),value);
});
