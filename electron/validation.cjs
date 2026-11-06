const fs=require('node:fs/promises');
const path=require('node:path');
const {spawn}=require('node:child_process');
async function validateRuntime(root,snapshot,overrides,runtime) {
  const modules={};
  async function walk(dir,prefix){for(const f of await fs.readdir(dir,{withFileTypes:true})){if(f.isSymbolicLink())continue;const name=prefix?prefix+'.'+f.name:f.name;if(f.isDirectory()){if(f.name==='Test')continue;await walk(path.join(dir,f.name),name);}else if(f.name.endsWith('.lua'))modules[name.slice(0,-4)]=await fs.readFile(path.join(dir,f.name),'utf8');}}
  try {await walk(root,'CameraFramework');await walk(path.join(path.dirname(root),'Foundation'),'Foundation');}
  catch(e){return {runtime:false,checked:0,issues:[{path:'',severity:'error',message:'运行时校验需要框架旁的 Foundation 目录：'+e.message}]};}
  const files={'__editor__/Assets/Index.json':overrides['Assets/Index.json']??await fs.readFile(path.join(root,'Assets','Index.json'),'utf8')};
  for(const a of snapshot.assets)files['__editor__/'+a.path]=overrides[a.path]??await fs.readFile(path.join(root,a.path),'utf8');
  const payload=JSON.stringify({modules,files});let delimiter='====';while(payload.includes(']'+delimiter+']'))delimiter+='=';
  const script=`local bundleText = [${delimiter}[${payload}]${delimiter}]\n`+await fs.readFile(path.join(__dirname,'validator.lua'),'utf8');
  return await new Promise(resolve=>{
    const child=spawn(runtime||'lua54',['-'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    let output='',errors='',settled=false;
    const finish=result=>{if(settled)return;settled=true;clearTimeout(timer);resolve(result);};
    const timer=setTimeout(()=>{child.kill();finish({runtime:false,checked:0,issues:[{path:'',severity:'error',message:'Lua 校验超时（15 秒）'}]});},15000);
    child.stdout.on('data',s=>output+=s);child.stderr.on('data',s=>errors+=s);
    child.on('error',e=>finish({runtime:false,checked:0,issues:[{path:'',severity:'error',message:'无法启动 Lua 校验器：'+e.message}]}));
    child.stdin.on('error',()=>{});
    child.on('close',code=>{try{const line=output.split(/\r?\n/).find(s=>s.startsWith('EDITOR_RESULT:'));if(!line)throw Error(errors||output||'Lua 校验器未返回结果');finish({...JSON.parse(line.slice(14)),runtime:true});}catch(e){finish({runtime:false,checked:0,issues:[{path:'',severity:'error',message:e.message}]});}});
    child.stdin.end(script);
  });
}
module.exports={validateRuntime};
