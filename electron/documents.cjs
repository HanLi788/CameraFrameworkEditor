const {writable}=require('./postprocessing.cjs');
const {json,encode}=require('./project.cjs');
function nodeAt(root,parts){let node=root;for(const part of parts){if(!node||!Object.hasOwn(node,part))throw Error('字段路径已变化，请刷新后重试');node=node[part];}return node;}
function setAt(root,parts,value){if(!Array.isArray(parts)||!parts.length||parts.some(p=>['__proto__','constructor','prototype'].includes(String(p))))throw Error('字段路径无效');const parent=nodeAt(root,parts.slice(0,-1));if(!Object.hasOwn(parent,parts.at(-1)))throw Error('字段不存在');parent[parts.at(-1)]=value;}
class Documents {
  constructor(project,notify=()=>{}){this.project=project;this.notify=notify;this.docs=new Map();this.pending=new Map();this.busy=false;}
  state(){return {busy:this.busy,docs:[...this.docs.values()].map(({past,future,...d})=>({...d,dirty:this.isDirty(d),canUndo:!!past.length,canRedo:!!future.length}))};}
  emit(){this.notify(this.state());}
  isDirty(d){return d.text!==d.saved;}
  guard(){if(this.busy)throw Error('正在保存，请稍后再修改');}
  async ensure(relative){if(this.docs.has(relative))return this.docs.get(relative);if(this.pending.has(relative))return this.pending.get(relative);const p=this.project.read(relative).then(file=>{const d={...file,saved:file.text,past:[],future:[],version:0,conflict:false};this.docs.set(relative,d);this.emit();return d;}).finally(()=>this.pending.delete(relative));this.pending.set(relative,p);return p;}
  change(d,fn){this.guard();writable(d.path);const before=d.text;fn();if(d.text===before)return;d.past.push(before);if(d.past.length>100)d.past.shift();d.future=[];d.version++;this.emit();}
  editText({path,text,baseText}){const d=this.docs.get(path);if(!d)throw Error('文档未打开');if(d.text!==baseText)throw Error('其他窗口已修改该文档，已同步最新内容，请重试');this.change(d,()=>{d.text=text;});return this.state();}
  editField({path,parts,value,baseValue}){const d=this.docs.get(path);if(!d)throw Error('文档未打开');const data=json(d.text);if(JSON.stringify(nodeAt(data,parts))!==JSON.stringify(baseValue))throw Error('该字段已被其他窗口修改，请重试');this.change(d,()=>{setAt(data,parts,value);d.text=encode(data);});return this.state();}
  history(path,redo=false){const d=this.docs.get(path);if(!d)return;this.guard();const from=redo?d.future:d.past,to=redo?d.past:d.future;if(!from.length)return;to.push(d.text);d.text=from.pop();d.version++;this.emit();return this.state();}
  async reload(path){this.guard();const d=await this.ensure(path);const disk=await this.project.read(path);if(d.readOnly){Object.assign(d,disk,{past:[],future:[]});d.version++;}else this.change(d,()=>{d.text=disk.text;});d.saved=disk.text;d.revision=disk.revision;d.conflict=false;this.emit();return this.state();}
  async refresh(){if(this.busy)return;for(const d of this.docs.values()){const version=d.version;try{const disk=await this.project.read(d.path);if(d.version!==version)continue;if(disk.revision===d.revision)continue;if(this.isDirty(d))d.conflict=true;else{Object.assign(d,disk,{saved:disk.text,past:[],future:[],conflict:false});d.version++;}}catch{d.conflict=true;}}this.emit();}
  discard(path){this.guard();const d=this.docs.get(path);if(d)this.change(d,()=>{d.text=d.saved;});return this.state();}
  async save({paths,versions}){
    this.guard();const chosen=paths.map(p=>this.docs.get(p)).filter(d=>d&&this.isDirty(d));
    for(const d of chosen)if(d.version!==versions[d.path])throw Error('保存期间文档已修改，请重试');
    if(!chosen.length)return {saved:0,state:this.state()};
    const writes=chosen.map(d=>({path:d.path,text:d.text,revision:d.revision}));
    this.busy=true;this.emit();try{const files=await this.project.saveMany(writes);for(const file of files){const d=this.docs.get(file.path);Object.assign(d,file,{saved:file.text,conflict:false});d.version++;}return {saved:files.length,state:this.state()};}
    finally{this.busy=false;this.emit();}
  }
}
module.exports={Documents,nodeAt,setAt};
