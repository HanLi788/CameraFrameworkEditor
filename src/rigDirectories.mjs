const root='Assets/CameraAssets/';
const sort=values=>[...values].sort((a,b)=>a.localeCompare(b));
export function rigLocation(path){
 if(!path?.startsWith(root))return null;
 const parts=path.slice(root.length).split('/');
 return parts.length===4&&parts[3].endsWith('.rig')?{space:parts[0],host:parts[1],device:parts[2]}:null;
}
// Folders supply labels; only direct .rig files can open a device folder.
export function rigDirectories(directories,files){
 const spaces=new Map();
 for(const dir of directories){
  if(!dir.startsWith(root))continue;
  const parts=dir.slice(root.length).split('/');if(parts.length>3)continue;
  const [space,host,device]=parts;if(!space)continue;
  if(!spaces.has(space))spaces.set(space,new Map());const hosts=spaces.get(space);
  if(host&&!hosts.has(host))hosts.set(host,new Map());
  if(host&&device&&!hosts.get(host).has(device))hosts.get(host).set(device,[]);
 }
 for(const file of files){const p=rigLocation(file.path);if(p)spaces.get(p.space)?.get(p.host)?.get(p.device)?.push(file.path);}
 for(const hosts of spaces.values())for(const devices of hosts.values())for(const paths of devices.values())paths.sort();
 return spaces;
}
export function directoryOptions(index,choice={}){
 const spaces=sort(index.keys()),space=spaces.includes(choice.space)?choice.space:'';
 const hosts=space?sort(index.get(space).keys()):[],host=hosts.includes(choice.host)?choice.host:'';
 const devices=host?sort(index.get(space).get(host).keys()):[],device=devices.includes(choice.device)?choice.device:'';
 const paths=device?index.get(space).get(host).get(device):[];
 return {spaces,hosts,devices,space,host,device,paths};
}
export function changeDirectory(index,choice,field,value){
 const next={...choice,[field]:value};
 if(field==='space'){
  const hosts=sort(index.get(value)?.keys()||[]);if(!hosts.includes(next.host))next.host=hosts[0]||'';
 }
 if(field==='space'||field==='host'){
  const devices=sort(index.get(next.space)?.get(next.host)?.keys()||[]);if(!devices.includes(next.device))next.device=devices[0]||'';
 }
 return directoryOptions(index,next);
}
