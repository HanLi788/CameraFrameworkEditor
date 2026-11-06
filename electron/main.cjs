const {app,BrowserWindow,ipcMain,dialog,Menu,shell}=require('electron');
const fs=require('node:fs/promises'),watch=require('node:fs').watch,path=require('node:path');
const {Project,json}=require('./project.cjs');
const {Documents}=require('./documents.cjs');
const {Simulation}=require('./simulation.cjs');
app.setName('CameraFrameworkEditor');
if(process.env.CAMERA_EDITOR_TEST_DATA)app.setPath('userData',process.env.CAMERA_EDITOR_TEST_DATA);
let main,editor,opening=Promise.resolve(),project,documents,watcher,timer,contextRig='',forceClose=false,refreshing;
const windows=new Map();
let language='zh',rebuildMenu=()=>{};
const ui=(zh,en)=>language==='en'?en:zh;
let contextSequence=0,contextTask=Promise.resolve();
const simulation=new Simulation(state=>send(main,'simulation',state));
const runtime=()=>path.join(app.isPackaged?process.resourcesPath:path.join(__dirname,'..'),'runtime','lua54.exe');
const settingsPath=()=>path.join(app.getPath('userData'),'settings.json');
async function settings(){try{return JSON.parse(await fs.readFile(settingsPath(),'utf8'));}catch{return {recent:[]};}}
async function writeSettings(value){await fs.mkdir(app.getPath('userData'),{recursive:true});await fs.writeFile(settingsPath(),JSON.stringify(value,null,2));}
function send(win,type,payload){if(win&&!win.isDestroyed())win.webContents.send('editor:event',{type,payload});}
function broadcast(type,payload){for(const {win}of windows.values())send(win,type,payload);}
function windowMeta(meta){return {kind:meta.kind||'main',file:meta.file||'',contextRig:meta.contextRig||contextRig,tabs:meta.tabs||[]};}
function emitTabs(meta){send(meta.win,'window-meta',windowMeta(meta));publish(documents.state());}
function publish(state){for(const meta of windows.values()){const dirty=meta.kind==='editor'?state.docs.some(d=>d.dirty&&meta.tabs.some(t=>t.path===d.path)):state.docs.some(d=>d.dirty);meta.win.setDocumentEdited(!!dirty);meta.win.setTitle((dirty?'● ':'')+(meta.kind==='editor'?ui('相机资产编辑器','Camera Asset Editor'):ui('相机框架编辑器','Camera Framework Editor')));}broadcast('session',state);}
async function refresh(){if(!project||documents.busy)return;if(refreshing)return refreshing;const current=project;refreshing=(async()=>{const snap=await current.snapshot();if(current!==project)return;await documents.refresh();broadcast('project',snap);return snap;})().finally(()=>refreshing=null);return refreshing;}
function dirty(){return documents?.state().docs.some(d=>d.dirty);}
async function openProject(root){
  if(dirty()||documents?.busy)throw Error('请先保存或丢弃全部窗口的草稿，再切换框架');
  const next=await Project.open(root,app.getPath('userData'),runtime());const snapshot=await next.snapshot();
  for(const entry of [...windows.values()])if(entry.kind==='editor')entry.win.destroy();
  ++contextSequence;contextTask=Promise.resolve();simulation.reset();watcher?.close();project=next;contextRig='';documents=new Documents(project,publish);
  const prefs=await settings();prefs.recent=[root,...(prefs.recent||[]).filter(p=>p!==root)].slice(0,8);await writeSettings(prefs);
  watcher=watch(project.root,{recursive:true},()=>{clearTimeout(timer);timer=setTimeout(()=>refresh().catch(e=>broadcast('error',e.message)),500);});watcher.on('error',e=>broadcast('error',e.message));
  publish(documents.state());broadcast('project',snapshot);return snapshot;
}
function createWindow(meta={}){
  const file=meta.kind==='editor';const win=new BrowserWindow({width:file?1160:1540,height:940,minWidth:file?800:1100,minHeight:650,backgroundColor:'#17191e',show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  const entry={win,...meta};windows.set(win.webContents.id,entry);if(file){win.setMenu(null);win.setMenuBarVisibility(false);win.webContents.on('before-input-event',(event,input)=>{if(input.type!=='keyDown')return;const key=input.key.toLowerCase();const ctrl=input.control||input.meta;const cmd=ctrl&&key==='s'?(input.shift?'save-all':'save'):ctrl&&key==='z'?(input.shift?'redo':'undo'):ctrl&&key==='w'?'close-tab':key==='f7'?'validate':null;if(cmd){event.preventDefault();send(win,'command',cmd);}});}
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());win.webContents.session.setPermissionRequestHandler((_w,_p,cb)=>cb(false));win.once('ready-to-show',()=>win.show());
  win.on('close',event=>{
    if(forceClose)return;
    if(documents?.busy){event.preventDefault();send(win,'error','正在保存，请稍后关闭窗口');return;}
    const affected=file?documents?.state().docs.some(d=>entry.tabs.some(t=>t.path===d.path)&&d.dirty):dirty();
    if(affected){event.preventDefault();dialog.showMessageBox(win,{type:'question',title:ui('还有未保存的修改','Unsaved changes'),message:file?ui('编辑标签中存在草稿。可以保留草稿并关闭窗口，稍后继续编辑。','Some tabs have drafts. You can keep them and close this window, then continue later.'):ui('退出将丢弃全部窗口中尚未保存的草稿。','Quitting will discard unsaved drafts in all windows.'),buttons:file?[ui('返回编辑','Return to editor'),ui('保留草稿并关闭','Keep draft and close'),ui('丢弃草稿并关闭','Discard draft and close')]:[ui('返回编辑','Return to editor'),ui('退出并丢弃草稿','Quit and discard drafts')],defaultId:0,cancelId:0}).then(r=>{if(!r.response)return;if(file){if(r.response===2)for(const tab of entry.tabs)documents.discard(tab.path);win.destroy();}else{forceClose=true;for(const entry of [...windows.values()])entry.win.destroy();app.quit();}});}
    else if(!file){forceClose=true;for(const entry of [...windows.values()])if(entry.kind==='editor')entry.win.destroy();}
  });
  win.on('closed',()=>{if(editor===win)editor=null;for(const [id,entry]of windows)if(entry.win===win)windows.delete(id);});
  win.loadFile(path.join(__dirname,'..','dist','index.html'),{query:file?{editor:'1'}:{}});return win;
}
function openFile(request,caller){
  const task=opening.then(async()=>{
    if(!project)throw Error('请先打开框架');const relative=request.path;await project.resolve(relative);await documents.ensure(relative);
    if(!editor||editor.isDestroyed())editor=createWindow({kind:'editor',tabs:[],file:''});
    const meta=windows.get(editor.webContents.id);let tab=meta.tabs.find(t=>t.path.toLowerCase()===relative.toLowerCase());
    if(!tab){tab={path:relative,contextRig:request.contextRig||caller.contextRig||contextRig};meta.tabs.push(tab);}
    meta.file=tab.path;meta.contextRig=tab.contextRig;emitTabs(meta);if(editor.isMinimized())editor.restore();editor.show();editor.focus();
  });opening=task.catch(()=>{});return task;
}
async function closeTab(meta,relative){
  if(meta.kind!=='editor'||documents.busy)return;const index=meta.tabs.findIndex(t=>t.path===relative);if(index<0)return;
  if(documents.state().docs.some(d=>d.path===relative&&d.dirty)){
    const result=await dialog.showMessageBox(meta.win,{type:'question',title:ui('未保存的标签','Unsaved tab'),message:ui('当前资产有未保存的修改。','This asset has unsaved changes.'),buttons:[ui('返回编辑','Return to editor'),ui('保留草稿并关闭','Keep draft and close'),ui('丢弃草稿并关闭','Discard draft and close')],defaultId:0,cancelId:0});
    if(!result.response||documents.busy)return;if(result.response===2)documents.discard(relative);
  }
  meta.tabs=meta.tabs.filter(t=>t.path!==relative);if(meta.file===relative){const next=meta.tabs[Math.min(index,meta.tabs.length-1)];meta.file=next?.path||'';meta.contextRig=next?.contextRig||'';}emitTabs(meta);
}
function handle(name,fn){ipcMain.handle('editor:'+name,(event,...args)=>{const meta=windows.get(event.sender.id);if(!meta||event.senderFrame!==event.sender.mainFrame)throw Error('非法 IPC 来源');return fn(meta,...args);});}
app.whenReady().then(async()=>{
  language=(await settings()).language==='en'?'en':'zh';
  main=createWindow();
  handle('bootstrap',async meta=>({project:project?await project.snapshot():null,session:documents?.state()||{docs:[],busy:false},meta:windowMeta(meta),settings:await settings(),simulation:simulation.state()}));
  handle('settings',()=>settings());handle('open-project',(_m,root)=>openProject(root));
  handle('choose-project',async meta=>{const r=await dialog.showOpenDialog(meta.win,{title:ui('选择相机框架目录','Choose framework folder'),properties:['openDirectory']});return r.canceled?null:openProject(r.filePaths[0]);});
  handle('snapshot',()=>refresh());handle('read',(_m,relative)=>project.read(relative));
  handle('ensure',async(_m,relative)=>{await documents.ensure(relative);return documents.state();});handle('open-file',(meta,request)=>openFile(request,meta));
  handle('select-tab',(meta,p)=>{const tab=meta.tabs?.find(t=>t.path===p);if(!tab)throw Error('标签不存在');meta.file=p;meta.contextRig=tab.contextRig;emitTabs(meta);});handle('close-tab',closeTab);
  handle('context',(_m,id)=>{
    const sequence=++contextSequence,current=project,docs=documents;
    contextTask=(async()=>{const snap=await current.snapshot();const asset=snap.assets.find(a=>a.path===id&&a.type==='Rig');if(!asset)throw Error('装置不存在');await docs.ensure(asset.path);if(sequence===contextSequence&&current===project){if(contextRig!==id)simulation.reset();contextRig=id;send(main,'context',id);}return docs.state();})();return contextTask;
  });
  handle('edit-text',(_m,r)=>documents.editText(r));handle('edit-field',(_m,r)=>documents.editField(r));handle('history',(_m,p,redo)=>documents.history(p,redo));handle('reload',(_m,p)=>documents.reload(p));handle('discard',(_m,p)=>documents.discard(p));
  handle('save-session',async(_m,r)=>{const result=await documents.save(r);await refresh();return result;});
  handle('mutate',async(_m,request)=>{
    if(documents.busy||(dirty()&&!['copy','create-curve','create-directory'].includes(request.kind)))throw Error('请先保存或丢弃全部草稿，再移动或删除资产');
    const snap=await project.snapshot(),source=snap.assets.find(a=>a.path===request.sourcePath);
    documents.busy=true;publish(documents.state());let result;
    try {
      result=await project.mutate(request);
      if(source&&['move','delete'].includes(request.kind)) {
        documents.docs.delete(source.path);simulation.reset();
        if(contextRig===source.path){++contextSequence;contextRig=result.path||'';if(contextRig)await documents.ensure(contextRig);send(main,'context',contextRig);}
        for(const item of windows.values())if(item.kind==='editor') {
          if(result.path)item.tabs=item.tabs.map(t=>({...t,path:t.path===source.path?result.path:t.path,contextRig:t.contextRig===source.path?result.path:t.contextRig}));
          else item.tabs=item.tabs.filter(t=>t.path!==source.path);
          if(item.file===source.path)item.file=result.path||item.tabs[0]?.path||'';
          if(item.contextRig===source.path)item.contextRig=result.path||'';
          if(result.path&&item.tabs.some(t=>t.path===result.path))await documents.ensure(result.path);
          emitTabs(item);
        }
      }
    }finally{documents.busy=false;publish(documents.state());}
    await refresh();return result;
  });
  handle('simulation',async(meta,command,options)=>{if(meta.kind==='editor')throw Error('请在主工作区控制模拟');if(command==='start'){await contextTask;if(!project||documents.busy)throw Error('项目尚未准备好');const drafts=Object.fromEntries(documents.state().docs.filter(d=>d.dirty).map(d=>[d.path,d.text]));return simulation.start(project,drafts,{...options,rigPath:contextRig});}if(command==='pause')return simulation.pause();if(command==='resume')return simulation.resume();if(command==='stop')return simulation.stop();throw Error('未知模拟命令');});
  handle('validate',async()=>{const drafts=Object.fromEntries(documents.state().docs.filter(d=>d.text!==d.saved).map(d=>[d.path,d.text]));return project.serial(()=>project.validate(drafts));});
  handle('reveal',async(_m,relative)=>{if(!project)throw Error('请先打开框架');const full=await project.resolve(relative);if(!(await fs.stat(full)).isFile())throw Error('请选择文件');if(main.isMinimized())main.restore();main.show();send(main,'locate',relative);main.focus();});handle('recovery',()=>shell.openPath(path.join(app.getPath('userData'),'recovery')));handle('preferences',async(_m,patch)=>{const s=await settings();if(patch.layout)s.layout=patch.layout;if(patch.language==='zh'||patch.language==='en')s.language=patch.language;await writeSettings(s);if(s.language&&s.language!==language){language=s.language;rebuildMenu();broadcast('language',language);if(documents)publish(documents.state());}});
  const command=cmd=>()=>{const win=BrowserWindow.getFocusedWindow()||main;if(cmd==='open'){main.focus();send(main,'command',cmd);}else send(win,'command',cmd);};
  rebuildMenu=()=>Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label:ui('文件','File'),submenu:[{label:ui('打开框架…','Open framework…'),accelerator:'CmdOrCtrl+O',click:command('open')},{label:ui('保存','Save'),accelerator:'CmdOrCtrl+S',click:command('save')},{label:ui('保存全部','Save all'),accelerator:'CmdOrCtrl+Shift+S',click:command('save-all')},{type:'separator'},{label:ui('查看恢复副本','Recovery copies'),click:()=>shell.openPath(path.join(app.getPath('userData'),'recovery'))},{role:'close',label:ui('关闭窗口','Close window')},{role:'quit',label:ui('退出','Exit')}]},
    {label:ui('编辑','Edit'),submenu:[{label:ui('撤销','Undo'),accelerator:'CmdOrCtrl+Z',click:command('undo')},{label:ui('重做','Redo'),accelerator:'CmdOrCtrl+Shift+Z',click:command('redo')},{type:'separator'},{role:'cut',label:ui('剪切','Cut')},{role:'copy',label:ui('复制','Copy')},{role:'paste',label:ui('粘贴','Paste')},{role:'selectAll',label:ui('全选','Select all')}]},
    {label:ui('视图','View'),submenu:[{label:ui('主工作区','Main workspace'),click:()=>main.focus()},{label:ui('重置布局','Reset layout'),click:command('reset-layout')},{role:'togglefullscreen',label:ui('全屏','Full screen')},{role:'toggleDevTools',label:ui('开发者工具','Developer tools')}]},
    {label:ui('工具','Tools'),submenu:[{label:ui('校验项目与草稿','Validate project and drafts'),accelerator:'F7',click:command('validate')}]},
    {label:ui('语言','Language'),submenu:[{label:'中文',type:'radio',checked:language==='zh',click:()=>changeLanguage('zh')},{label:'English',type:'radio',checked:language==='en',click:()=>changeLanguage('en')}]}
  ]));
  async function changeLanguage(next){const s=await settings();s.language=next;await writeSettings(s);language=next;rebuildMenu();broadcast('language',language);if(documents)publish(documents.state());}
  rebuildMenu();
});
app.on('window-all-closed',()=>{simulation.stop(false);watcher?.close();clearTimeout(timer);app.quit();});
app.on('before-quit',event=>{if(!forceClose&&main&&!main.isDestroyed()){event.preventDefault();main.close();}});
