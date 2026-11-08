const {app,BrowserWindow,ipcMain,dialog,Menu,shell,screen}=require('electron');
const fs=require('node:fs/promises'),watch=require('node:fs').watch,path=require('node:path');
const {Project,json}=require('./project.cjs');
const {Documents}=require('./documents.cjs');
const {Simulation}=require('./simulation.cjs');
const {getWorld}=require('./world-service.cjs');
const {GameWorlds}=require('./game-worlds.cjs');
const {LiveDebug}=require('./live-debug.cjs');
const {randomUUID}=require('node:crypto');
let liveDebug;
const debugFlushes=new Map();
async function flushDebugEditors(){
  const id=randomUUID(),targets=[...windows.values()].filter(m=>m.kind==='main'||m.kind==='postprocessing');
  await Promise.all(targets.map(meta=>new Promise((resolve,reject)=>{
    const key=id+':'+meta.win.webContents.id;
    const timer=setTimeout(()=>{debugFlushes.delete(key);reject(Error('等待编辑窗口提交参数超时'));},10000);
    debugFlushes.set(key,{finish:error=>{clearTimeout(timer);debugFlushes.delete(key);error?reject(Error(error)):resolve();}});
    send(meta.win,'flush-live-debug',id);
  })));
}
app.setName('CameraFrameworkEditor');
if(process.env.CAMERA_EDITOR_TEST_DATA)app.setPath('userData',process.env.CAMERA_EDITOR_TEST_DATA);
let game,games,closingGame,activeWorldId,lastGrounded,checkpointTimer;
let main,opening=Promise.resolve(),project,documents,watcher,inputWatcher,timer,contextRig='',forceClose=false,refreshing;
const windows=new Map();
let language='zh',rebuildMenu=()=>{};
const ui=(zh,en)=>language==='en'?en:zh;
let simulationRequest=0,contextSequence=0,contextTask=Promise.resolve();
const simulation=new Simulation(state=>{broadcast('simulation',state);if(state.status==='running'&&state.frame?.grounded)lastGrounded=structuredClone(state.frame);});
const runtime=()=>path.join(app.isPackaged?process.resourcesPath:path.join(__dirname,'..'),'runtime','lua54.exe');
const settingsPath=()=>path.join(app.getPath('userData'),'settings.json');
async function settings(){try{return JSON.parse(await fs.readFile(settingsPath(),'utf8'));}catch{return {recent:[]};}}
async function writeSettings(value){await fs.mkdir(app.getPath('userData'),{recursive:true});await fs.writeFile(settingsPath(),JSON.stringify(value,null,2));}
function send(win,type,payload){if(win&&!win.isDestroyed())win.webContents.send('editor:event',{type,payload});}
function broadcast(type,payload){for(const {win}of windows.values())send(win,type,payload);}
function windowMeta(meta){return {kind:meta.kind||'main',volumeDirty:!!meta.volumeDirty,file:meta.file||'',effectPath:meta.effectPath||'',contextRig:meta.workspaceRig||'',workspaceRig:meta.workspaceRig||'',nodeKey:meta.nodeKey||'',canvasRig:meta.canvasRig||'',canvasSelection:meta.rigSelections?.[meta.canvasRig],detailOpen:!!meta.detailOpen,canGoBack:!!meta.detailHistory?.length,tabs:meta.tabs||[]};}
function emitTabs(meta){send(meta.win,'window-meta',windowMeta(meta));publish(documents.state());}
function publish(state){for(const meta of windows.values())if(meta.kind==='main'){let changed=false;for(const tab of meta.tabs||[])if(tab.preview&&state.docs.some(d=>d.path===tab.path&&d.dirty)){tab.preview=false;changed=true;}if(changed)send(meta.win,'window-meta',windowMeta(meta));}for(const meta of windows.values()){const dirty=meta.kind==='game'?false:(meta.kind==='editor'||meta.kind==='postprocessing')?state.docs.some(d=>d.dirty&&meta.tabs.some(t=>t.path===d.path)):state.docs.some(d=>d.dirty);meta.win.setDocumentEdited(!!dirty);meta.win.setTitle((dirty?'● ':'')+(meta.kind==='game'?ui('相机原野','Camera Meadow'):ui('相机框架编辑器','Camera Framework Editor')));}broadcast('session',state);}
async function refresh(){if(!project||documents.busy)return;if(refreshing)return refreshing;const current=project;refreshing=(async()=>{const snap=await current.snapshot();if(current!==project)return;await documents.refresh();broadcast('project',snap);return snap;})().finally(()=>refreshing=null);return refreshing;}
function dirty(){return documents?.state().docs.some(d=>d.dirty);}
async function openProject(root){
  if(dirty()||documents?.busy||liveDebug?.busy)throw Error('请先完成保存或丢弃全部窗口的草稿，再切换框架');
  const next=await Project.open(root,app.getPath('userData'),runtime());const snapshot=await next.snapshot();
  if(await closeGame()===false)throw Error('已取消切换工作区');
  for(const meta of [...windows.values()])if(meta.kind==='postprocessing')meta.win.destroy();
  games=await new GameWorlds(app.getPath('userData'),next.root,snapshot.effectCatalog.postProcessing||[]).load();
  const mainMeta=windows.get(main.webContents.id);mainMeta.tabs=[];mainMeta.file='';mainMeta.contextRig='';mainMeta.workspaceRig='';mainMeta.canvasRig='';mainMeta.detailOpen=false;mainMeta.detailHistory=[];mainMeta.rigSelections={};mainMeta.nodeKey='';send(main,'window-meta',windowMeta(mainMeta));
  await liveDebug?.stop();
  ++simulationRequest;++contextSequence;contextTask=Promise.resolve();simulation.reset();watcher?.close();inputWatcher?.close();project=next;contextRig='';documents=new Documents(project,publish);
  const prefs=await settings();prefs.recent=[next.workspaceRoot,...(prefs.recent||[]).filter(p=>p!==next.workspaceRoot&&p!==next.root)].slice(0,8);await writeSettings(prefs);
  watcher=watch(project.root,{recursive:true},(_event,file)=>{if(String(file).replaceAll('\\','/').startsWith('.editor/'))return;clearTimeout(timer);timer=setTimeout(()=>refresh().catch(e=>broadcast('error',e.message)),500);});watcher.on('error',e=>broadcast('error',e.message));
  inputWatcher=watch(path.join(project.workspaceRoot,'InputSystem'),{recursive:true},()=>{clearTimeout(timer);timer=setTimeout(()=>refresh().catch(e=>broadcast('error',e.message)),500);});inputWatcher.on('error',e=>broadcast('error',e.message));
  liveDebug=new LiveDebug(project,documents,{flush:flushDebugEditors,notify:state=>broadcast('live-debug',state)});
  try{await liveDebug.start();}catch(e){liveDebug.emit('error',e.message);}
  publish(documents.state());broadcast('project',snapshot);return snapshot;
}
async function leaveGame(){
  ++simulationRequest;await simulation.pause();
  if(games&&activeWorldId)await games.checkpoint(activeWorldId,lastGrounded);
  activeWorldId=null;lastGrounded=null;simulation.reset();return games?.state();
}
async function closeGame(){
  if(closingGame)return closingGame;if(!game||game.isDestroyed())return;
  const win=game;closingGame=(async()=>{
    if(windows.get(win.webContents.id)?.volumeDirty){const result=await dialog.showMessageBox(win,{type:'question',title:ui('场景修改尚未保存','Unsaved scene changes'),message:ui('关闭将丢弃尚未保存的场景修改。','Closing will discard unsaved scene changes.'),buttons:[ui('返回编辑','Return to editor'),ui('丢弃并关闭','Discard and close')],defaultId:0,cancelId:0});if(!result.response)return false;}
    await leaveGame();clearInterval(checkpointTimer);
    if(games){games.data.window=win.getNormalBounds();await games.serial(()=>games.write());}
    win.destroy();game=null;broadcast('game-window',false);
  })().finally(()=>closingGame=null);return closingGame;
}
function openGame(){
  if(!project||!games)throw Error('请先打开框架');
  if(game&&!game.isDestroyed()){if(game.isMinimized())game.restore();game.show();game.focus();return;}
  game=createWindow({kind:'game',tabs:[],file:''});broadcast('game-window',true);
  checkpointTimer=setInterval(()=>{if(activeWorldId&&lastGrounded)games.checkpoint(activeWorldId,lastGrounded).catch(e=>send(game,'error',e.message));},5000);
}
async function openPostProcessing(request){
  if(!project)throw Error('请先打开框架');
  const file=request.path;if(typeof file!=='string'||!file.endsWith('.postProcessing'))throw Error('请选择后处理资产');
  await project.resolve(file);await documents.ensure(file);
  const existing=[...windows.values()].find(m=>m.kind==='postprocessing'&&m.file===file);
  if(existing){send(existing.win,'window-meta',windowMeta(existing));if(existing.win.isMinimized())existing.win.restore();existing.win.show();existing.win.focus();return;}
  createWindow({kind:'postprocessing',file,tabs:[{path:file}]});
}
function createWindow(meta={kind:'main',tabs:[],file:''}){
  const isGame=meta.kind==='game';let bounds={width:isGame?1180:1540,height:940};
  if(isGame&&games?.data.window){const b=games.data.window;if([b.x,b.y,b.width,b.height].every(Number.isFinite)){const area=screen.getDisplayMatching(b).workArea;bounds={width:Math.min(area.width,Math.max(900,b.width)),height:Math.min(area.height,Math.max(600,b.height)),x:Math.max(area.x,Math.min(b.x,area.x+area.width-900)),y:Math.max(area.y,Math.min(b.y,area.y+area.height-600))};}}
  const win=new BrowserWindow({...bounds,minWidth:isGame?900:850,minHeight:600,backgroundColor:'#17191e',show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  const entry={win,...meta};windows.set(win.webContents.id,entry);
  if(isGame){win.setMenu(null);win.setMenuBarVisibility(false);win.setTitle(ui('相机原野','Camera Meadow'));}
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());win.webContents.session.setPermissionRequestHandler((_w,_p,cb)=>cb(false));win.once('ready-to-show',()=>win.show());
  let confirming=false;
  win.on('close',event=>{
    if(forceClose)return;event.preventDefault();
    if(meta.kind==='postprocessing'){send(win,'postprocess-close-request');return;}
    if(isGame){closeGame().catch(e=>send(win,'error',e.message));return;}
    if(confirming)return;if(documents?.busy||liveDebug?.busy){send(win,'error','正在保存，请稍后关闭窗口');return;}
    confirming=true;(async()=>{
      if(dirty()){const r=await dialog.showMessageBox(win,{type:'question',title:ui('还有未保存的修改','Unsaved changes'),message:ui('退出将丢弃尚未保存的草稿。','Quitting will discard unsaved drafts.'),buttons:[ui('返回编辑','Return to editor'),ui('退出并丢弃草稿','Quit and discard drafts')],defaultId:0,cancelId:0});if(!r.response)return;}
      if(await closeGame()===false)return;await liveDebug?.stop();forceClose=true;for(const m of [...windows.values()])m.win.destroy();app.quit();
    })().catch(e=>send(win,'error',e.message)).finally(()=>confirming=false);
  });
  win.on('closed',()=>{for(const [id,m]of windows)if(m.win===win){windows.delete(id);for(const [key,request]of debugFlushes)if(key.endsWith(':'+id))request.finish('编辑窗口已关闭');}});
  win.loadFile(path.join(__dirname,'..','dist','index.html'),{query:isGame?{game:'1'}:meta.kind==='postprocessing'?{postprocessing:'1'}:{}});return win;
}
function openFile(request,caller){
 const task=opening.then(async()=>{
  if(!project)throw Error('请先打开框架');
  if(request.path?.endsWith('.postProcessing'))return openPostProcessing(request);
  main.show();main.focus();
  const meta=windows.get(main.webContents.id);meta.rigSelections??={};
  meta.detailHistory??=[];
  if(request.navigation==='back'){const previous=meta.detailHistory.at(-1);if(!previous)return;request={...previous,navigation:'back'};}
  let relative=request.path,workspaceRig=request.mode==='rig'?request.path:request.workspaceRig||'',nodeKey=request.nodeKey||'';
  if(workspaceRig){if(!workspaceRig.endsWith('.rig'))throw Error('请选择装置');await project.resolve(workspaceRig);}
  if(request.mode==='rig'){
    const selection=meta.rigSelections[workspaceRig];relative=selection?.path||workspaceRig;nodeKey=selection?.nodeKey||'root';
    try{await project.resolve(relative);}catch{relative=workspaceRig;nodeKey='root';}
  }
  await project.resolve(relative);await documents.ensure(relative);
  if(request.navigation==='back')meta.detailHistory.pop();
  else if(request.navigation==='push'&&meta.detailOpen&&meta.file&&(meta.file!==relative||meta.workspaceRig!==workspaceRig||meta.nodeKey!==nodeKey)){
    meta.detailHistory.push({path:meta.file,workspaceRig:meta.workspaceRig,nodeKey:meta.nodeKey});if(meta.detailHistory.length>64)meta.detailHistory.shift();
  }else if(request.navigation!=='replace'&&request.navigation!=='push')meta.detailHistory=[];
  let tab=meta.tabs.find(t=>t.path===relative);
  if(!tab){tab={path:relative,contextRig:workspaceRig,preview:false};meta.tabs.push(tab);}
  tab.contextRig=workspaceRig;meta.file=relative;meta.contextRig=workspaceRig;meta.workspaceRig=workspaceRig;meta.nodeKey=nodeKey;
  meta.detailOpen=request.details!==false;
  if(workspaceRig){contextRig=workspaceRig;meta.canvasRig=workspaceRig;meta.rigSelections[workspaceRig]={path:relative,nodeKey};}
  emitTabs(meta);if(main.isMinimized())main.restore();main.show();main.focus();

 });opening=task.catch(()=>{});return task;
}
async function closeTab(meta,relative){
  if(meta.kind!=='main'||documents.busy)return;const index=meta.tabs.findIndex(t=>t.path===relative);if(index<0)return;
  if(documents.state().docs.some(d=>d.path===relative&&d.dirty)){
    const result=await dialog.showMessageBox(meta.win,{type:'question',title:ui('未保存的详情','Unsaved detail'),message:ui('当前资产有未保存的修改。','This asset has unsaved changes.'),buttons:[ui('返回编辑','Return to editor'),ui('保留草稿并关闭','Keep draft and close'),ui('丢弃草稿并关闭','Discard draft and close')],defaultId:0,cancelId:0});
    if(!result.response||documents.busy)return;if(result.response===2)documents.discard(relative);
  }
  meta.tabs=meta.tabs.filter(t=>t.path!==relative);if(meta.file===relative){meta.file='';meta.contextRig='';meta.workspaceRig='';meta.nodeKey='';meta.detailOpen=false;}emitTabs(meta);
}
function handle(name,fn){ipcMain.handle('editor:'+name,(event,...args)=>{const meta=windows.get(event.sender.id);if(!meta||event.senderFrame!==event.sender.mainFrame)throw Error('非法 IPC 来源');return fn(meta,...args);});}
app.whenReady().then(async()=>{
  language=(await settings()).language==='en'?'en':'zh';
  main=createWindow();
  handle('bootstrap',async meta=>({project:project?await project.snapshot():null,session:documents?.state()||{docs:[],busy:false},meta:windowMeta(meta),settings:await settings(),simulation:simulation.state(),gameOpen:!!game&&!game.isDestroyed(),gameState:games?.state(),liveDebug:liveDebug?.state()}));
  handle('live-debug-flushed',(meta,id,error)=>{
    const request=debugFlushes.get(id+':'+meta.win.webContents.id);
    if(request)request.finish(typeof error==='string'?error:'');
  });
  handle('external',(_m,href)=>{const url=new URL(href);if(!['https:','http:'].includes(url.protocol))throw Error('不支持的链接');return shell.openExternal(url.href);});
  handle('markdown-image',async(_m,document,src)=>{
    await project.resolve(document);
    if(typeof src!=='string'||/^[a-z]+:|^[\/\\]/i.test(src))throw Error('仅显示框架内的本地图像');
    const relative=path.posix.normalize(path.posix.join(path.posix.dirname(document),decodeURIComponent(src)));
    const file=await project.resolve(relative),mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp'}[path.extname(file).toLowerCase()];
    const stat=await fs.stat(file);if(!mime||!stat.isFile()||stat.size>8*1024*1024)throw Error('不支持的图像');
    return 'data:'+mime+';base64,'+(await fs.readFile(file)).toString('base64');
  });
  handle('settings',()=>settings());handle('open-project',(_m,root)=>openProject(root));
  handle('choose-project',async meta=>{const r=await dialog.showOpenDialog(meta.win,{title:ui('选择 Lua 工作区目录','Choose Lua workspace folder'),properties:['openDirectory']});return r.canceled?null:openProject(r.filePaths[0]);});
  handle('snapshot',()=>refresh());handle('read',(_m,relative)=>project.read(relative));
  handle('ensure',async(_m,relative)=>{await documents.ensure(relative);return documents.state();});handle('open-file',(meta,request)=>openFile(request,meta));
  handle('close-detail',meta=>{meta.detailOpen=false;meta.detailHistory=[];emitTabs(meta);});
  handle('detail-back',meta=>openFile({navigation:'back'},meta));
  handle('pin-tab',(meta,p)=>{const tab=meta.tabs?.find(t=>t.path===p);if(tab){tab.preview=false;emitTabs(meta);}});
  handle('select-tab',(meta,p)=>{const tab=meta.tabs?.find(t=>t.path===p);if(!tab)throw Error('标签不存在');meta.file=p;meta.contextRig='';meta.workspaceRig='';meta.nodeKey='';emitTabs(meta);});handle('close-tab',closeTab);
  handle('context',(_m,id)=>{
    const sequence=++contextSequence,current=project,docs=documents;
    contextTask=(async()=>{const snap=await current.snapshot();const asset=snap.assets.find(a=>a.path===id&&a.type==='Rig');if(!asset)throw Error('装置不存在');await docs.ensure(asset.path);if(sequence===contextSequence&&current===project){contextRig=id;send(main,'context',id);}return docs.state();})();return contextTask;
  });
  handle('close-postprocessing',(meta)=>{if(meta.kind==='postprocessing')meta.win.destroy();});
  handle('open-postprocessing',(_m,request)=>openPostProcessing(request));
  handle('post-bindings',async(_m,request)=>{
    const {BINDINGS,parseBindings,writeBindings}=require('./postprocessing.cjs');
    const doc=await documents.ensure(BINDINGS);
    if(request){if(doc.text!==request.baseText)throw Error('绑定配置已被其他窗口修改，请重试');documents.editText({path:BINDINGS,baseText:doc.text,text:writeBindings(doc.text,request.config)});}
    try{return {config:parseBindings(doc.text).config,text:doc.text,session:documents.state()};}
    catch(e){if(request)throw e;return {error:e.message,text:doc.text,session:documents.state()};}
  });
  handle('edit-text',(_m,r)=>documents.editText(r));handle('edit-field',(_m,r)=>documents.editField(r));handle('history',(_m,p,redo)=>documents.history(p,redo));handle('reload',(_m,p)=>documents.reload(p));handle('discard',(_m,p)=>documents.discard(p));
  handle('save-session',async(_m,r)=>{const result=await documents.save(r);await refresh();return result;});
  handle('mutate',async(_m,request)=>{
    if(documents.busy||(dirty()&&!['copy','create-curve','create-directory','create-asset'].includes(request.kind)))throw Error('请先保存或丢弃全部草稿，再移动或删除资产');
    await project.snapshot();
    documents.busy=true;publish(documents.state());let result;
    try {
      result=await project.mutate(request);
      if(['move','delete'].includes(request.kind)) {
        const moves=result.moves||{[request.sourcePath]:result.path||null};
        if(activeWorldId){await leaveGame();send(game,'game-return',games.state());}else simulation.reset();
        for(const p of Object.keys(moves))documents.docs.delete(p);
        if(Object.hasOwn(moves,contextRig)){contextRig=moves[contextRig]||'';++contextSequence;send(main,'context',contextRig);}
        for(const item of [...windows.values()])if(item.kind==='postprocessing'){
          if(Object.hasOwn(moves,item.file)){if(!moves[item.file]){item.win.destroy();continue;}item.file=moves[item.file];item.tabs=[{path:item.file}];await documents.ensure(item.file);}
          if(Object.hasOwn(moves,item.effectPath))item.effectPath=moves[item.effectPath]||'';
          send(item.win,'window-meta',windowMeta(item));
        }
        for(const item of windows.values())if(item.kind==='main'){
          const removedCurrent=Object.hasOwn(moves,item.file)&&!moves[item.file];
          item.tabs=item.tabs.filter(t=>!Object.hasOwn(moves,t.path)||moves[t.path]).map(t=>({...t,path:moves[t.path]||t.path,contextRig:moves[t.contextRig]||t.contextRig}));
          if(Object.hasOwn(moves,item.file))item.file=moves[item.file]||'';
          const selections={};for(const [rig,selection]of Object.entries(item.rigSelections||{})){
            const nextRig=Object.hasOwn(moves,rig)?moves[rig]:rig;if(!nextRig)continue;
            selections[nextRig]={path:Object.hasOwn(moves,selection.path)?moves[selection.path]||nextRig:selection.path,nodeKey:''};
          }
          item.rigSelections=selections;
          if(Object.hasOwn(moves,item.workspaceRig))item.workspaceRig=moves[item.workspaceRig]||'';
          if(Object.hasOwn(moves,item.canvasRig))item.canvasRig=moves[item.canvasRig]||'';
          item.detailHistory=(item.detailHistory||[]).filter(entry=>!Object.hasOwn(moves,entry.path)||moves[entry.path]).map(entry=>({...entry,path:moves[entry.path]||entry.path,workspaceRig:Object.hasOwn(moves,entry.workspaceRig)?moves[entry.workspaceRig]||'':entry.workspaceRig,nodeKey:''}));
          if(removedCurrent)item.detailOpen=false;
          item.contextRig=item.workspaceRig;item.nodeKey='';
          if(removedCurrent&&item.workspaceRig){item.file=item.workspaceRig;if(!item.tabs.some(t=>t.path===item.file))item.tabs.push({path:item.file,contextRig:item.workspaceRig});}
          for(const tab of item.tabs)await documents.ensure(tab.path);emitTabs(item);
        }
      }
    }finally{documents.busy=false;publish(documents.state());}
    await refresh();return result;
  });
  handle('scene',async(_meta,options)=>(await getWorld(options)).world);
  handle('game',async(meta,command,value)=>{
    if(command==='open')return openGame();if(command==='close')return closeGame();
    if(!games)throw Error('请先打开框架');if(command==='state')return games.state();
    if(command==='scene-dirty'){if(meta.kind!=='game'||value?.worldId!==games.selected().id||typeof value.dirty!=='boolean')throw Error('无效场景草稿状态');meta.volumeDirty=value.dirty;return true;}
    if(command==='leave')return leaveGame();
    if(command==='scene'){if(meta.kind!=='game'||!['paused','stopped','error'].includes(simulation.status)||value?.worldId!==games.selected().id)throw Error('请在场景编辑或暂停状态保存 NPC');return games.scene(value.worldId,value.npcs);}
    if(command==='settings'&&simulation.status==='paused'){const next=await games.settings(value);await simulation.setMovementMultiplier(next.settings.movementMultiplier);await simulation.setFrameRate(next.settings.fps);return next;}
    if(!['stopped','error'].includes(simulation.status))throw Error('请先返回主菜单');
    if(command==='create')return games.create(value);if(command==='select')return games.select(value);
    if(command==='settings')return games.settings(value);throw Error('未知游戏操作');
  });
  handle('simulation',async(meta,command,options)=>{
    if(meta.kind!=='game')throw Error('请在游戏窗口控制运行');
    if(command==='start'||command==='prepare'){
      const request=++simulationRequest;await contextTask;if(request!==simulationRequest)return simulation.state();if(!project||documents.busy)throw Error('项目尚未准备好');
      const w=games.selected();if(request!==simulationRequest)return simulation.state();activeWorldId=w.id;lastGrounded=null;
      const drafts=Object.fromEntries(documents.state().docs.filter(d=>d.dirty).map(d=>[d.path,d.text]));
      return simulation.start(project,drafts,{...options,mode:'game',environment:w.environment,seed:w.seed,version:w.version,pose:w.pose,npcs:w.npcs,frameRate:games.state().settings.fps,movementMultiplier:games.state().settings.movementMultiplier,rigPath:contextRig||'Assets/CameraAssets/IdleCamera/Player/Default/Default.rig'},command!=='prepare');
    }
    if(command==='input')return simulation.input(options);if(command==='pause')return simulation.pause();if(command==='resume')return simulation.resume();
    if(command==='stop'||command==='reset'){await leaveGame();return simulation.state();}throw Error('未知模拟命令');
  });
  handle('validate',async()=>{const drafts=Object.fromEntries(documents.state().docs.filter(d=>d.text!==d.saved).map(d=>[d.path,d.text]));return project.serial(()=>project.validate(drafts));});
  handle('reveal',async(_m,relative)=>{if(!project)throw Error('请先打开框架');const full=await project.resolve(relative);if(!(await fs.stat(full)).isFile())throw Error('请选择文件');if(main.isMinimized())main.restore();main.show();send(main,'locate',relative);main.focus();});handle('recovery',()=>shell.openPath(path.join(app.getPath('userData'),'recovery')));handle('preferences',async(_m,patch)=>{const s=await settings();if(patch.layout)s.layout={...s.layout,...patch.layout};if(patch.language==='zh'||patch.language==='en')s.language=patch.language;await writeSettings(s);if(s.language&&s.language!==language){language=s.language;rebuildMenu();broadcast('language',language);if(documents)publish(documents.state());}});
  const command=cmd=>()=>{const win=BrowserWindow.getFocusedWindow()||main;if(cmd==='open'){main.focus();send(main,'command',cmd);}else send(win,'command',cmd);};
  rebuildMenu=()=>{Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label:ui('文件','File'),submenu:[{label:ui('打开工作区…','Open workspace…'),accelerator:'CmdOrCtrl+O',click:command('open')},{label:ui('保存','Save'),accelerator:'CmdOrCtrl+S',click:command('save')},{label:ui('保存全部','Save all'),accelerator:'CmdOrCtrl+Shift+S',click:command('save-all')},{type:'separator'},{label:ui('查看恢复副本','Recovery copies'),click:()=>shell.openPath(path.join(app.getPath('userData'),'recovery'))},{label:ui('关闭当前详情','Close current detail'),accelerator:'CmdOrCtrl+W',click:command('close-tab')},{role:'quit',label:ui('退出','Exit')}]},
    {label:ui('编辑','Edit'),submenu:[{label:ui('撤销','Undo'),accelerator:'CmdOrCtrl+Z',click:command('undo')},{label:ui('重做','Redo'),accelerator:'CmdOrCtrl+Shift+Z',click:command('redo')},{type:'separator'},{role:'cut',label:ui('剪切','Cut')},{role:'copy',label:ui('复制','Copy')},{role:'paste',label:ui('粘贴','Paste')},{role:'selectAll',label:ui('全选','Select all')}]},
    {label:ui('视图','View'),submenu:[{label:ui('主工作区','Main workspace'),click:()=>main.focus()},{label:ui('打开游戏窗口','Open game window'),click:()=>{try{openGame();}catch(e){send(main,'error',e.message);}}},{label:ui('显示／隐藏目录','Toggle directory'),accelerator:'CmdOrCtrl+B',click:()=>send(main,'command','toggle-sidebar')},{label:ui('重置布局','Reset layout'),click:command('reset-layout')},{role:'togglefullscreen',label:ui('全屏','Full screen')},{role:'toggleDevTools',label:ui('开发者工具','Developer tools')}]},
    {label:ui('工具','Tools'),submenu:[{label:ui('校验项目与草稿','Validate project and drafts'),accelerator:'F7',click:command('validate')}]},
    {label:ui('语言','Language'),submenu:[{label:'中文',type:'radio',checked:language==='zh',click:()=>changeLanguage('zh')},{label:'English',type:'radio',checked:language==='en',click:()=>changeLanguage('en')}]}
  ]));if(game&&!game.isDestroyed())game.setMenu(null);};
  async function changeLanguage(next){const s=await settings();s.language=next;await writeSettings(s);language=next;rebuildMenu();broadcast('language',language);if(documents)publish(documents.state());}
  rebuildMenu();
});
app.on('window-all-closed',()=>{simulation.stop(false);watcher?.close();inputWatcher?.close();clearTimeout(timer);liveDebug?.stop().catch(()=>{});app.quit();});
app.on('before-quit',event=>{if(!forceClose&&main&&!main.isDestroyed()){event.preventDefault();main.close();}});
