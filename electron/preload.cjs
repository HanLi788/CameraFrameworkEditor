const {contextBridge,ipcRenderer}=require('electron');
const invoke=name=>(...args)=>ipcRenderer.invoke('editor:'+name,...args);
contextBridge.exposeInMainWorld('cameraEditor',{
  finishClose:invoke('finish-close'),markdownImage:invoke('markdown-image'),external:invoke('external'),bootstrap:invoke('bootstrap'),settings:invoke('settings'),chooseProject:invoke('choose-project'),openProject:invoke('open-project'),snapshot:invoke('snapshot'),read:invoke('read'),ensure:invoke('ensure'),
  selectProcessor:invoke('select-processor'),selectTab:invoke('select-tab'),closeTab:invoke('close-tab'),openFile:invoke('open-file'),editText:invoke('edit-text'),editField:invoke('edit-field'),history:invoke('history'),reload:invoke('reload'),discard:invoke('discard'),saveSession:invoke('save-session'),
  mutate:invoke('mutate'),validate:invoke('validate'),reveal:invoke('reveal'),recovery:invoke('recovery'),preferences:invoke('preferences'),
  onEvent:callback=>{const listener=(_event,value)=>callback(value);ipcRenderer.on('editor:event',listener);return()=>ipcRenderer.removeListener('editor:event',listener);}
});
