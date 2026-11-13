const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
const directory='InputSystem/MyIMC/Definition/Definitions';
const literal=text=>{let delimiter='====';while(text.includes(']'+delimiter+']'))delimiter+='=';return '['+delimiter+'['+text+']'+delimiter+']';};
async function collect(workspace){
 const modules={},files={};
 async function walk(dir,prefix){for(const entry of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){if(entry.isSymbolicLink())continue;if(entry.isDirectory()){if(entry.name!=='Test')await walk(path.join(dir,entry.name),prefix+'.'+entry.name);}else if(entry.name.endsWith('.lua'))modules[prefix+'.'+entry.name.slice(0,-4)]=await fs.readFile(path.join(dir,entry.name),'utf8');}}
 await walk(path.join(workspace,'Foundation'),'Foundation');await walk(path.join(workspace,'InputSystem'),'InputSystem');
 for(const entry of (await fs.readdir(path.join(workspace,directory),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name)))if(entry.isFile()&&entry.name.endsWith('.json'))files[entry.name]=await fs.readFile(path.join(workspace,directory,entry.name),'utf8');
 return {modules,files};
}
function run(runtime,script){return new Promise(resolve=>{
 const child=spawn(runtime||'lua54',['-'],{windowsHide:true,stdio:['pipe','pipe','pipe']});let output='',errors='',done=false;
 const finish=result=>{if(done)return;done=true;clearTimeout(timer);resolve(result);};
 const failure=message=>({contexts:[],issues:[{path:directory,severity:'error',message}],runtime:false});
 const timer=setTimeout(()=>{child.kill();finish(failure('输入系统定义读取超时（15 秒）'));},15000);
 child.stdout.on('data',s=>output+=s);child.stderr.on('data',s=>errors+=s);child.stdin.on('error',()=>{});
 child.on('error',e=>finish(failure(e.message)));child.on('close',()=>{try{const line=output.split(/\r?\n/).find(s=>s.startsWith('INPUT_CATALOG:'));if(!line)throw Error(errors||output||'输入系统未返回定义列表');finish({...JSON.parse(line.slice(14)),runtime:true});}catch(e){finish(failure(e.message));}});child.stdin.end(script);
});}
// Cache by source and definition contents, never by a hardcoded set of IMC names.
class InputCatalog {
 async read(workspace,runtime){
  let bundle;
  try{bundle=await collect(workspace);}catch(e){return {revision:'unavailable:'+e.message,contexts:[],runtime:false,issues:[{path:directory,severity:'error',message:e.message}]};}
  const payload=JSON.stringify(bundle),revision=crypto.createHash('sha256').update(payload).digest('hex');
  if(this.revision!==revision){
   this.revision=revision;
   this.pending=(async()=>{
    const script='local Json=assert(load('+literal(bundle.modules['Foundation.Serialization.JsonReader'])+'))()\nlocal bundle=Json.Decode('+literal(payload)+')\n'+await fs.readFile(path.join(__dirname,'input-catalog.lua'),'utf8');
    return {...await run(runtime,script),revision};
   })();
  }
  const result=await this.pending;
  if(!result.runtime&&this.revision===revision)this.revision=undefined;
  return result;
 }
}
function inputIssues(asset,catalog){
 const data=asset.data;if(asset.type!=='Input'||!asset.path.endsWith('.userInput')||data.SchemaVersion!==1)return [];
 const issue=(field,message)=>({path:asset.path,field,message,severity:'error'}),context=catalog.contexts.find(c=>c.name===data.IMCName);
 if(!context||context.error)return [issue('IMCName','IMCName 不存在或定义无效：'+String(data.IMCName??''))];
 return Object.entries(data.Channels||{}).filter(([,c])=>c?.bEnabled===true&&!context.mappings.includes(c.MappingName)).map(([name,c])=>issue('Channels.'+name+'.MappingName','MappingName 不存在于 '+data.IMCName+'：'+String(c.MappingName??'')));
}
module.exports={InputCatalog,inputIssues};
