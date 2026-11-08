const fs=require('node:fs/promises'),path=require('node:path'),{spawn}=require('node:child_process');
const presets=require('./preview-presets.json');
const {getWorld}=require('./world-service.cjs');
// Only generated numeric geometry is serialized here. Keep large static meshes out
// of the project's strict JSON decoder, whose remaining-string scans are costly.
function luaData(value){
  if(typeof value==='number'){if(!Number.isFinite(value))throw Error('Invalid preview geometry');return String(value);}
  if(typeof value==='string')return '"'+value.replace(/[\\"\x00-\x1f]/g,c=>'\\'+c.charCodeAt(0).toString().padStart(3,'0'))+'"';
  if(Array.isArray(value))return '{'+value.map(luaData).join(',')+'}';
  return '{'+Object.entries(value).map(([k,v])=>'['+luaData(k)+']='+luaData(v)).join(',')+'}';
}
async function bundleProject(project,overrides,options){
  const snapshot=await project.snapshot(overrides),modules={},files={};
  for(const a of snapshot.assets)files['__editor__/'+a.path]=overrides[a.path]??(await project.read(a.path)).text;
  const frozen=Object.fromEntries(Object.entries(files).map(([key,value])=>[key.slice('__editor__/'.length),value]));
  const check=await project.validate({...overrides,...frozen});const errors=check.issues.filter(i=>i.severity==='error');
  if(!check.runtime||errors.length)throw Error('模拟配置校验失败：\n'+errors.map(e=>e.message).join('\n'));
  files['__editor__/'+require('./postprocessing.cjs').PLAN]=check.planText;
  const asset=snapshot.assets.find(a=>a.path===options.rigPath&&a.type==='Rig');if(!asset)throw Error('请选择有效装置');
  async function walk(dir,prefix,relative=''){for(const f of await fs.readdir(dir,{withFileTypes:true})){
    if(f.isSymbolicLink()||f.name==='Test')continue;const name=prefix+'.'+f.name,rel=relative?relative+'/'+f.name:f.name;
    if(f.isDirectory())await walk(path.join(dir,f.name),name,rel);else if(f.name.endsWith('.lua'))modules[name.slice(0,-4)]=prefix.startsWith('CameraFramework')&&overrides[rel]!==undefined?overrides[rel]:await fs.readFile(path.join(dir,f.name),'utf8');
  }}
  await walk(project.root,'CameraFramework');await walk(path.join(path.dirname(project.root),'Foundation'),'Foundation');
  if(options.mode==='game'){
    await walk(path.join(project.workspaceRoot,'InputSystem'),'InputSystem');
    const definitions=path.join(project.workspaceRoot,'InputSystem/MyIMC/Definition/Definitions');
    for(const entry of await fs.readdir(definitions,{withFileTypes:true}))if(entry.isFile()&&entry.name.endsWith('.json'))files['__content__/Lua/InputSystem/MyIMC/Definition/Definitions/'+entry.name]=await fs.readFile(path.join(definitions,entry.name),'utf8');
  }
  for(const name of ['MovementValues','PlayerEvents']){const file=path.join(path.dirname(project.root),'Actor','Player',name+'.lua');if(await fs.stat(file).catch(()=>null))modules['Actor.Player.'+name]=await fs.readFile(file,'utf8');}
  const environment=options.environment||'basic';let preset=presets[environment],collision;
  if(['lab','explore'].includes(environment)){const result=await getWorld(options);const w=result.world;preset={spawn:w.spawn,target:w.target,route:w.route,bounds:w.bounds,procedural:true};collision=result.collision;options={...options,seed:w.seed,version:w.version,worldKey:w.key};}
  else {if(!preset)throw Error('未知预览地图');collision=preset.model?JSON.parse(await fs.readFile(path.join(__dirname,'preview-data/city.json'),'utf8')):undefined;}
  const payload=JSON.stringify({modules,files,options:{...options,environment,preset,pipelinePath:asset.data.Pipelines[0]}});let delimiter='====';while(payload.includes(']'+delimiter+']'))delimiter+='=';
  const scripts=await Promise.all(['preview-bootstrap.lua','preview-collision.lua','preview-adapters.lua',options.mode==='game'?'preview-game.lua':'preview-runtime.lua'].map(f=>fs.readFile(path.join(__dirname,f),'utf8')));
  return `local bundleText=[${delimiter}[${payload}]${delimiter}]\n`+scripts[0]+`\nlocal previewCollision=${collision?luaData(collision):'nil'}\nlocal Collision=(function()\n${scripts[1]}\nend)()\nlocal Adapters=(function()\n${scripts[2]}\nend)()\n`+scripts[3];
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
  state(){return {status:this.status,frame:this.frame,error:this.error||'',timing:this.timing||null};}
  emit(){this.notify(this.state());return this.state();}
  async start(project,overrides,options,autoplay=true){
    this.stop(false);const generation=++this.generation;this.status='loading';this.error='';this.frame=null;this.signals=[];this.actions=[];this.timing=null;this.emit();
    try{
      if(options.mode!==undefined&&!['game','demo'].includes(options.mode))throw Error('未知运行模式');
      if(options.id!==undefined&&!(typeof options.id==='string'&&options.id.trim()||Number.isSafeInteger(options.id)))throw Error('业务 ID 必须是安全整数或非空字符串');
      if(!Number.isFinite(options.speed??0)||Math.abs(options.speed??0)>100000)throw Error('速度超出预览范围');
      if(!Number.isFinite(options.movementMultiplier??1)||(options.movementMultiplier??1)<.25||(options.movementMultiplier??1)>4)throw Error('移动速度倍率须为 0.25–4');
      if(options.motion!==undefined&&!['idle','patrol'].includes(options.motion))throw Error('未知角色运动方式');
      const script=await bundleProject(project,overrides,options);if(generation!==this.generation)return this.state();
      const child=new LuaPreview(project.runtime,script);this.process=child;const result=await child.ready;if(generation!==this.generation){child.destroy();return this.state();}
      this.frame=result.frame;this.initial=result.frame;this.status=autoplay?'running':'paused';this.emit();if(autoplay)this.schedule();return this.state();
    }catch(e){if(generation===this.generation){this.status='error';this.error=e.message;this.process?.destroy();this.process=null;this.emit();}throw e;}
  }
  schedule(){
    clearTimeout(this.timer);const id=this.scheduleId=(this.scheduleId||0)+1,period=1000/60;let deadline=performance.now()+period;
    const tick=async()=>{
      if(id!==this.scheduleId||this.status!=='running')return;
      const started=performance.now();
      try{if(!this.inFlight)await this.step(1);}catch{return;}
      if(id!==this.scheduleId||this.status!=='running')return;
      const now=performance.now();this.timing={stepMs:now-started,lateMs:Math.max(0,started-deadline)};
      deadline+=period;if(now-deadline>period*4)deadline=now+period;
      this.timer=setTimeout(tick,Math.max(0,deadline-now));
    };this.timer=setTimeout(tick,period);
  }
  async setMovementMultiplier(value){
    if(!Number.isFinite(value)||value<.25||value>4)throw Error('移动速度倍率须为 0.25–4');
    if(this.status!=='paused'||this.frame?.mode!=='game')throw Error('请先暂停游戏');
    const generation=this.generation;while(this.inFlight)await this.inFlight.catch(()=>{});
    if(generation!==this.generation||this.status!=='paused')throw Error('游戏状态已改变');
    return this.advance({kind:'movement-settings',movementMultiplier:value});
  }
  async step(count=1){
    if(!Number.isInteger(count)||count<1||count>120)throw Error('无效模拟步数');
    const command={kind:'step',count,signals:(this.signals||[]).splice(0),actions:(this.actions||[]).splice(0)};return this.advance(command);
  }
  async advance(command){
    if(!this.process||this.inFlight)throw Error('模拟尚未准备好');const generation=this.generation;
    const promise=this.process.request(command);this.inFlight=promise;
    try{const result=await promise;if(generation===this.generation){this.frame=result.frame;this.emit();}return this.state();}
    catch(e){if(generation===this.generation){clearTimeout(this.timer);this.status='error';this.error=e.message;this.process?.destroy();this.process=null;this.emit();}throw e;}
    finally{if(this.inFlight===promise)this.inFlight=null;}
  }
  input(value={}){
    if(!['running','paused'].includes(this.status)||this.frame?.mode!=='game')return false;
    if(value.clear){this.signals=[{kind:'clear'}];this.actions=[];}
    if(value.signals){
      if(!Array.isArray(value.signals)||value.signals.length>128)throw Error('无效输入信号');
      for(const event of value.signals){
        if(!event||!['pressed','released','changed'].includes(event.kind)||typeof event.name!=='string'||!/^[A-Za-z][A-Za-z0-9]{0,47}$/.test(event.name))throw Error('无效输入信号');
        if(event.kind==='changed'&&(!['MouseX','MouseY','MouseScrollWheel'].includes(event.name)||!Number.isFinite(event.value)||Math.abs(event.value)>10000))throw Error('无效鼠标增量');
        if(this.signals.length>=4096)throw Error('输入队列已满');
        this.signals.push({kind:event.kind,name:event.name,value:event.value});
      }
    }
    if(value.action){if(!['dialogue','close-dialogue'].includes(value.action))throw Error('未知体验动作');if(this.status==='paused'&&value.action==='close-dialogue')return this.closeDialoguePaused();if(this.status==='running'&&this.actions.length<32)this.actions.push(value.action);}
    return true;
  }
  async closeDialoguePaused(){const generation=this.generation;while(this.inFlight)await this.inFlight.catch(()=>{});if(generation!==this.generation||this.status!=='paused')return false;return this.advance({kind:'interaction',action:'close-dialogue'});}
  async pause(){this.scheduleId=(this.scheduleId||0)+1;const generation=this.generation;this.input({clear:true});clearTimeout(this.timer);if(this.status==='running')this.status='paused';while(this.inFlight)await this.inFlight.catch(()=>{});if(generation!==this.generation)return this.state();if(this.process&&this.frame?.mode==='game'){await this.advance({kind:'clear-input'});this.signals=[];}return this.emit();}
  resume(){if(this.status!=='paused'||!this.process)throw Error('没有可恢复的模拟');this.status='running';this.schedule();return this.emit();}
  stop(emit=true){this.scheduleId=(this.scheduleId||0)+1;++this.generation;clearTimeout(this.timer);this.process?.destroy();this.process=null;this.inFlight=null;this.status='stopped';this.error='';this.frame=this.initial||null;if(emit)return this.emit();}
  reset(){this.stop(false);this.initial=null;this.frame=null;return this.emit();}
}
module.exports={Simulation,bundleProject,LuaPreview};
