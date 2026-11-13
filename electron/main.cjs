const {app,BrowserWindow,ipcMain,dialog,Menu,shell}=require('electron');
const fs=require('node:fs/promises'),watch=require('node:fs').watch,path=require('node:path');
const {Project}=require('./project.cjs');
const {Documents}=require('./documents.cjs');
const {openTab,removeTab,moveTabs}=require('./workbench.cjs');
app.setName('CameraFrameworkEditor');
if(process.env.CAMERA_EDITOR_TEST_DATA)app.setPath('userData',process.env.CAMERA_EDITOR_TEST_DATA);
let main,opening=Promise.resolve(),project,documents,watcher,inputWatcher,timer,forceClose=false,refreshing;
const windows=new Map();
let language='zh',rebuildMenu=()=>{};
const ui=(zh,en)=>language==='en'?en:zh;
const runtime=()=>path.join(app.isPackaged?process.resourcesPath:path.join(__dirname,'..'),'runtime','lua54.exe');
const settingsPath=()=>path.join(app.getPath('userData'),'settings.json');
async function settings(){try{return JSON.parse(await fs.readFile(settingsPath(),'utf8'));}catch{return {recent:[]};}}
async function writeSettings(value){await fs.mkdir(app.getPath('userData'),{recursive:true});await fs.writeFile(settingsPath(),JSON.stringify(value,null,2));}
function send(win,type,payload){if(win&&!win.isDestroyed())win.webContents.send('editor:event',{type,payload});}
function broadcast(type,payload){for(const {win}of windows.values())send(win,type,payload);}
function windowMeta(meta){return {file:meta.file||'',rig:meta.rig||'',processor:meta.processor||'',tabs:meta.tabs||[]};}
function emitTabs(meta){send(meta.win,'window-meta',windowMeta(meta));publish(documents.state());}
function publish(state){const dirty=state.docs.some(d=>d.dirty);for(const {win}of windows.values()){win.setDocumentEdited(dirty);win.setTitle((dirty?'● ':'')+ui('相机框架编辑器','Camera Framework Editor'));}broadcast('session',state);}
async function refresh(){if(!project||documents.busy)return;if(refreshing)return refreshing;const current=project;refreshing=(async()=>{const snap=await current.snapshot();if(current!==project)return;await documents.refresh();broadcast('project',snap);return snap;})().finally(()=>refreshing=null);return refreshing;}
function dirty(){return documents?.state().docs.some(d=>d.dirty);}
async function openProject(root){
  if(dirty()||documents?.busy)throw Error('请先完成保存或丢弃全部草稿，再切换框架');
  const next=await Project.open(root,app.getPath('userData'),runtime());const snapshot=await next.snapshot();
  const mainMeta=windows.get(main.webContents.id);Object.assign(mainMeta,{tabs:[],file:'',rig:'',processor:'',processors:{}});send(main,'window-meta',windowMeta(mainMeta));
  watcher?.close();inputWatcher?.close();project=next;documents=new Documents(project,publish);
  const prefs=await settings();prefs.recent=[next.workspaceRoot,...(prefs.recent||[]).filter(p=>p!==next.workspaceRoot&&p!==next.root)].slice(0,8);await writeSettings(prefs);
  watcher=watch(project.root,{recursive:true},(_event,file)=>{if(String(file).replaceAll('\\','/').startsWith('.editor/'))return;clearTimeout(timer);timer=setTimeout(()=>refresh().catch(e=>broadcast('error',e.message)),500);});watcher.on('error',e=>broadcast('error',e.message));
  inputWatcher=watch(path.join(project.workspaceRoot,'InputSystem'),{recursive:true},()=>{clearTimeout(timer);timer=setTimeout(()=>refresh().catch(e=>broadcast('error',e.message)),500);});inputWatcher.on('error',e=>broadcast('error',e.message));
  publish(documents.state());broadcast('project',snapshot);return snapshot;
}
function createWindow(meta={kind:'main',tabs:[],file:''}){
  const win=new BrowserWindow({width:1540,height:980,minWidth:900,minHeight:680,backgroundColor:'#17191e',show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  const entry={win,...meta};windows.set(win.webContents.id,entry);
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());win.webContents.session.setPermissionRequestHandler((_w,_p,cb)=>cb(false));win.once('ready-to-show',()=>win.show());
  let confirming=false;
  entry.finishClose=async()=>{
    if(confirming)return;if(documents?.busy)throw Error('正在保存，请稍后关闭窗口');
    confirming=true;try{
      if(dirty()){const r=await dialog.showMessageBox(win,{type:'question',title:ui('还有未保存的修改','Unsaved changes'),message:ui('退出将丢弃尚未保存的草稿。','Quitting will discard unsaved drafts.'),buttons:[ui('返回编辑','Return to editor'),ui('退出并丢弃草稿','Quit and discard drafts')],defaultId:0,cancelId:0});if(!r.response)return;}
      forceClose=true;win.destroy();app.quit();
    }finally{confirming=false;}
  };
  win.on('close',event=>{if(forceClose)return;event.preventDefault();send(win,'command','quit');});
  win.on('closed',()=>{for(const [id,m]of windows)if(m.win===win){windows.delete(id);}});
  win.loadFile(path.join(__dirname,'..','dist','index.html'));return win;
}
function openFile(request){
 const task=opening.then(async()=>{
  if(!project)throw Error('请先打开框架');
  const relative=request.path;await project.resolve(relative);await documents.ensure(relative);
  const meta=windows.get(main.webContents.id);
  openTab(meta,{path:relative,rig:relative.endsWith('.rig'),...(request.processor!==undefined?{processor:request.processor}:{})});
  emitTabs(meta);if(main.isMinimized())main.restore();main.show();main.focus();
 });opening=task.catch(()=>{});return task;
}
async function closeTab(meta,relative){
  if(meta.kind!=='main'||documents.busy)return;const index=meta.tabs.findIndex(t=>t.path===relative);if(index<0)return;
  if(documents.state().docs.some(d=>d.path===relative&&d.dirty)){
    const result=await dialog.showMessageBox(meta.win,{type:'question',title:ui('未保存的资产','Unsaved asset'),message:ui('当前资产有未保存的修改。','This asset has unsaved changes.'),buttons:[ui('返回编辑','Return to editor'),ui('保留草稿并关闭','Keep draft and close'),ui('丢弃草稿并关闭','Discard draft and close')],defaultId:0,cancelId:0});
    if(!result.response||documents.busy)return;if(result.response===2)documents.discard(relative);
  }
  removeTab(meta,relative);emitTabs(meta);
}
function handle(name,fn){ipcMain.handle('editor:'+name,(event,...args)=>{const meta=windows.get(event.sender.id);if(!meta||event.senderFrame!==event.sender.mainFrame)throw Error('非法 IPC 来源');return fn(meta,...args);});}
app.whenReady().then(async()=>{
  language=(await settings()).language==='en'?'en':'zh';
  main=createWindow();
  handle('bootstrap',async meta=>({project:project?await project.snapshot():null,session:documents?.state()||{docs:[],busy:false},meta:windowMeta(meta),settings:await settings()}));
  handle('external',(_m,href)=>{const url=new URL(href);if(!['https:','http:'].includes(url.protocol))throw Error('不支持的链接');return shell.openExternal(url.href);});
  handle('markdown-image',async(_m,document,src)=>{
    await project.resolve(document);
    if(typeof src!=='string'||/^[a-z]+:|^[\/\\]/i.test(src))throw Error('仅显示框架内的本地图像');
    const relative=path.posix.normalize(path.posix.join(path.posix.dirname(document),decodeURIComponent(src)));
    const file=await project.resolve(relative),mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp'}[path.extname(file).toLowerCase()];
    const stat=await fs.stat(file);if(!mime||!stat.isFile()||stat.size>8*1024*1024)throw Error('不支持的图像');
    return 'data:'+mime+';base64,'+(await fs.readFile(file)).toString('base64');
  });
  handle('finish-close',meta=>meta.finishClose());
  handle('settings',()=>settings());handle('open-project',(_m,root)=>openProject(root));
  handle('choose-project',async meta=>{const r=await dialog.showOpenDialog(meta.win,{title:ui('选择 Lua 工作区目录','Choose Lua workspace folder'),properties:['openDirectory']});return r.canceled?null:openProject(r.filePaths[0]);});
  handle('snapshot',()=>refresh());handle('read',(_m,relative)=>project.read(relative));
  handle('ensure',async(_m,relative)=>{await documents.ensure(relative);return documents.state();});handle('open-file',(meta,request)=>openFile(request,meta));
  handle('select-processor',async(meta,stage)=>{if(!meta.rig)throw Error('请先选择装置');return openFile({path:meta.rig,processor:stage});});
  handle('select-tab',(meta,p)=>{if(!meta.tabs.some(t=>t.path===p))throw Error('标签不存在');meta.file=p;if(p.endsWith('.rig')){meta.rig=p;meta.processor=meta.processors?.[p]??'Input';}emitTabs(meta);});handle('close-tab',closeTab);
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
        for(const p of Object.keys(moves))documents.docs.delete(p);
        for(const item of windows.values()){moveTabs(item,moves);for(const tab of item.tabs)await documents.ensure(tab.path);emitTabs(item);}

      }
    }finally{documents.busy=false;publish(documents.state());}
    await refresh();return result;
  });
  handle('validate',async()=>{const drafts=Object.fromEntries(documents.state().docs.filter(d=>d.text!==d.saved).map(d=>[d.path,d.text]));return project.serial(()=>project.validate(drafts));});
  handle('reveal',async(_m,relative)=>{if(!project)throw Error('请先打开框架');const full=await project.resolve(relative);if(!(await fs.stat(full)).isFile())throw Error('请选择文件');if(main.isMinimized())main.restore();main.show();send(main,'locate',relative);main.focus();});handle('recovery',()=>shell.openPath(path.join(app.getPath('userData'),'recovery')));handle('preferences',async(_m,patch)=>{const s=await settings();if(patch.layout)s.layout={...s.layout,...patch.layout};if(patch.language==='zh'||patch.language==='en')s.language=patch.language;await writeSettings(s);if(s.language&&s.language!==language){language=s.language;rebuildMenu();broadcast('language',language);if(documents)publish(documents.state());}});
  const command=cmd=>()=>{const win=BrowserWindow.getFocusedWindow()||main;if(cmd==='open'){main.focus();send(main,'command',cmd);}else send(win,'command',cmd);};
  rebuildMenu=()=>{Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label:ui('文件','File'),submenu:[{label:ui('打开工作区…','Open workspace…'),accelerator:'CmdOrCtrl+O',click:command('open')},{label:ui('保存','Save'),accelerator:'CmdOrCtrl+S',click:command('save')},{label:ui('保存全部','Save all'),accelerator:'CmdOrCtrl+Shift+S',click:command('save-all')},{type:'separator'},{label:ui('查看恢复副本','Recovery copies'),click:()=>shell.openPath(path.join(app.getPath('userData'),'recovery'))},{label:ui('关闭当前标签','Close current tab'),accelerator:'CmdOrCtrl+W',click:command('close-tab')},{role:'quit',label:ui('退出','Exit')}]},
    {label:ui('编辑','Edit'),submenu:[{label:ui('撤销','Undo'),accelerator:'CmdOrCtrl+Z',click:command('undo')},{label:ui('重做','Redo'),accelerator:'CmdOrCtrl+Shift+Z',click:command('redo')},{type:'separator'},{role:'cut',label:ui('剪切','Cut')},{role:'copy',label:ui('复制','Copy')},{role:'paste',label:ui('粘贴','Paste')},{role:'selectAll',label:ui('全选','Select all')}]},
    {label:ui('视图','View'),submenu:[{label:ui('主工作区','Main workspace'),click:()=>main.focus()},{label:ui('显示／隐藏目录','Toggle directory'),accelerator:'CmdOrCtrl+B',click:()=>send(main,'command','toggle-sidebar')},{label:ui('显示／隐藏内容浏览器','Toggle content browser'),accelerator:'CmdOrCtrl+J',click:command('toggle-browser')},{label:ui('重置布局','Reset layout'),click:command('reset-layout')},{role:'togglefullscreen',label:ui('全屏','Full screen')},{role:'toggleDevTools',label:ui('开发者工具','Developer tools')}]},
    {label:ui('工具','Tools'),submenu:[{label:ui('校验项目与草稿','Validate project and drafts'),accelerator:'F7',click:command('validate')}]},
    {label:ui('语言','Language'),submenu:[{label:'中文',type:'radio',checked:language==='zh',click:()=>changeLanguage('zh')},{label:'English',type:'radio',checked:language==='en',click:()=>changeLanguage('en')}]}
  ]));};
  async function changeLanguage(next){const s=await settings();s.language=next;await writeSettings(s);language=next;rebuildMenu();broadcast('language',language);if(documents)publish(documents.state());}
  rebuildMenu();
});
app.on('window-all-closed',()=>{watcher?.close();inputWatcher?.close();clearTimeout(timer);app.quit();});
app.on('before-quit',event=>{if(!forceClose&&main&&!main.isDestroyed()){event.preventDefault();main.close();}});
