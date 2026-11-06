const fs=require('node:fs/promises'),path=require('node:path'),{spawn}=require('node:child_process');
async function bundleProject(project,overrides,options){
  const snapshot=await project.snapshot(overrides),modules={},files={'__editor__/Assets/Index.json':overrides['Assets/Index.json']??(await project.read('Assets/Index.json')).text};
  for(const a of snapshot.assets)files['__editor__/'+a.path]=overrides[a.path]??(await project.read(a.path)).text;
  const frozen=Object.fromEntries(Object.entries(files).map(([key,value])=>[key.slice('__editor__/'.length),value]));
  const check=await project.validate(frozen);const errors=check.issues.filter(i=>i.severity==='error');
  if(!check.runtime||errors.length)throw Error('模拟配置校验失败：\n'+errors.map(e=>e.message).join('\n'));
  const asset=snapshot.assets.find(a=>a.id===options.rigId&&a.type==='Rig');if(!asset)throw Error('请选择有效装置');
  async function walk(dir,prefix,relative=''){for(const f of await fs.readdir(dir,{withFileTypes:true})){
    if(f.isSymbolicLink()||f.name==='Test')continue;const name=prefix+'.'+f.name,rel=relative?relative+'/'+f.name:f.name;
    if(f.isDirectory())await walk(path.join(dir,f.name),name,rel);else if(f.name.endsWith('.lua'))modules[name.slice(0,-4)]=prefix.startsWith('CameraFramework')&&overrides[rel]!==undefined?overrides[rel]:await fs.readFile(path.join(dir,f.name),'utf8');
  }}
  await walk(project.root,'CameraFramework');await walk(path.join(path.dirname(project.root),'Foundation'),'Foundation');
  const payload=JSON.stringify({modules,files,options:{...options,pipelineId:asset.data.PipelineAssetId}});let delimiter='====';while(payload.includes(']'+delimiter+']'))delimiter+='=';
  const scripts=await Promise.all(['preview-bootstrap.lua','preview-adapters.lua','preview-runtime.lua'].map(f=>fs.readFile(path.join(__dirname,f),'utf8')));
  return `local bundleText=[${delimiter}[${payload}]${delimiter}]\n`+scripts[0]+`\nlocal Adapters=(function()\n${scripts[1]}\nend)()\n`+scripts[2];
}
class LuaPreview {
  constructor(runtime,script){
    script=script.replace(/\r\n/g,"\n"); // Windows Lua stdin uses text mode.
    this.child=spawn(runtime,['-e','local n=assert(tonumber(io.read("*l")));local s=assert(io.read(n));assert(load(s,"editor-preview"))()'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    this.output='';this.errors='';this.pending=null;this.dead=false;
    this.child.stdout.setEncoding('utf8');this.child.stderr.setEncoding('utf8');
    this.child.stdout.on('data',text=>{this.output+=text;let i;while((i=this.output.indexOf('\n'))>=0){const line=this.output.slice(0,i);this.output=this.output.slice(i+1);if(!line.startsWith('PREVIEW:'))continue;try{const value=JSON.parse(line.slice(8));if(value.error)this.fail(Error(value.error));else if(this.pending){const pending=this.pending;this.pending=null;clearTimeout(pending.timer);pending.resolve(value);}}catch(e){this.fail(e);}}});
    this.child.stderr.on('data',text=>{this.errors=(this.errors+text).slice(-12000);});
    this.child.on('error',e=>this.fail(e));this.child.on('exit',()=>{this.dead=true;this.fail(Error(this.errors||'Lua 模拟进程已结束'));});this.child.stdin.on('error',e=>this.fail(e));
    this.ready=this.wait(15000);this.child.stdin.write(Buffer.concat([Buffer.from(Buffer.byteLength(script)+'\n'),Buffer.from(script)]));
  }
  fail(error){if(this.pending){const p=this.pending;this.pending=null;clearTimeout(p.timer);p.reject(error);}}
  wait(timeout=5000){if(this.pending)return Promise.reject(Error('模拟命令尚未完成'));if(this.dead)return Promise.reject(Error('模拟进程已结束'));return new Promise((resolve,reject)=>{this.pending={resolve,reject,timer:setTimeout(()=>{this.fail(Error('Lua 模拟响应超时'));this.destroy();},timeout)};});}
  request(command){const promise=this.wait();if(!this.dead)this.child.stdin.write(JSON.stringify(command)+'\n');return promise;}
  destroy(){this.dead=true;this.fail(Error('模拟已停止'));this.child.kill();}
}
class Simulation {
  constructor(notify=()=>{}){this.notify=notify;this.status='stopped';this.frame=null;this.generation=0;this.timer=null;this.process=null;this.inFlight=null;}
  state(){return {status:this.status,frame:this.frame,error:this.error||''};}
  emit(){this.notify(this.state());return this.state();}
  async start(project,overrides,options,autoplay=true){
    this.stop(false);const generation=++this.generation;this.status='loading';this.error='';this.frame=null;this.emit();
    try{
      if(options.id!==undefined&&!(typeof options.id==='string'&&options.id.trim()||Number.isSafeInteger(options.id)))throw Error('业务 ID 必须是安全整数或非空字符串');
      if(!Number.isFinite(options.speed??0)||Math.abs(options.speed??0)>100000)throw Error('速度超出预览范围');
      const script=await bundleProject(project,overrides,options);if(generation!==this.generation)return this.state();
      const child=new LuaPreview(project.runtime,script);this.process=child;const result=await child.ready;if(generation!==this.generation){child.destroy();return this.state();}
      this.frame=result.frame;this.initial=result.frame;this.status=autoplay?'running':'paused';this.emit();if(autoplay)this.schedule();return this.state();
    }catch(e){if(generation===this.generation){this.status='error';this.error=e.message;this.process?.destroy();this.process=null;this.emit();}throw e;}
  }
  schedule(){clearInterval(this.timer);this.timer=setInterval(()=>{if(this.status==='running'&&!this.inFlight)this.step(2).catch(()=>{});},1000/30);}
  async step(count=1){
    if(!Number.isInteger(count)||count<1||count>120)throw Error('无效模拟步数');
    if(!this.process||this.inFlight)throw Error('模拟尚未准备好');const generation=this.generation;
    const promise=this.process.request({kind:'step',count});this.inFlight=promise;
    try{const result=await promise;if(generation===this.generation){this.frame=result.frame;this.emit();}return this.state();}
    catch(e){if(generation===this.generation){clearInterval(this.timer);this.status='error';this.error=e.message;this.process?.destroy();this.process=null;this.emit();}throw e;}
    finally{if(this.inFlight===promise)this.inFlight=null;}
  }
  async pause(){clearInterval(this.timer);if(this.status==='running')this.status='paused';if(this.inFlight)await this.inFlight.catch(()=>{});return this.emit();}
  resume(){if(this.status!=='paused'||!this.process)throw Error('没有可恢复的模拟');this.status='running';this.schedule();return this.emit();}
  stop(emit=true){++this.generation;clearInterval(this.timer);this.process?.destroy();this.process=null;this.inFlight=null;this.status='stopped';this.error='';this.frame=this.initial||null;if(emit)return this.emit();}
  reset(){this.stop(false);this.initial=null;this.frame=null;return this.emit();}
}
module.exports={Simulation,bundleProject,LuaPreview};
