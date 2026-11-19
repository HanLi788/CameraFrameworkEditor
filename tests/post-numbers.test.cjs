const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {fixture}=require('./framework-fixture.cjs');let project,helpers;
before(async()=>{project=await fixture();helpers=await import('../src/postNumbers.mjs');});after(()=>project?.close());
test('post numeric controls use actual Lua hard boundaries rather than suggested slider ranges',async()=>{
 const channels=(await project.getSnapshot()).effectCatalog.postProcessing,cases=[];
 for(const channel of channels){for(const value of [...new Set([channel.default,channel.min,channel.max,channel.min-1,channel.max+1,channel.minimum,channel.maximum,0,-1,1,.001].filter(Number.isFinite))])cases.push({name:channel.name,value,expected:!helpers.postValueIssue(channel,value)});}
 const script="package.path='./?.lua;./?/init.lua;'..package.path;local Fields=require('CameraFramework.PostProcessingSystem.Adaptation.PostProcessFields');local Json=require('Foundation.Serialization.JsonReader');for _,c in ipairs(Json.Decode(io.read('*a')))do print(tostring(pcall(Fields.ValidateValue,Fields.GetChannel(c.name),c.value)))end";
 const result=spawnSync(project.runtime,['-e',script],{cwd:project.workspaceRoot,input:JSON.stringify(cases),encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);const lines=result.stdout.trim().split(/\r?\n/);assert.equal(lines.length,cases.length);cases.forEach((c,i)=>assert.equal(lines[i]==='true',c.expected,JSON.stringify(c)));
});
test('legal typed values expand slider bounds while native hard constraints remain enforced',()=>{
 const c={min:0,max:2,minimum:0,maximum:10,default:0};assert.equal(helpers.postValueIssue(c,7),null);assert.deepEqual(helpers.sliderBounds(c,7),{min:0,max:7});assert.ok(helpers.postValueIssue(c,11));assert.deepEqual(helpers.sliderBounds(c,11),{min:0,max:2});
 const signed={min:-1,max:1,default:0};assert.deepEqual(helpers.sliderBounds(signed,-8),{min:-8,max:1});assert.ok(helpers.postValueIssue({positive:true},0));assert.ok(helpers.postValueIssue(c,Infinity));
});
