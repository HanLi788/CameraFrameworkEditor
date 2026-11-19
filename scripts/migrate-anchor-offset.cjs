#!/usr/bin/env node
// Convert source assets only; Lua runtime/editor protocol must be upgraded together.
const fs=require('node:fs'),path=require('node:path'),{isDeepStrictEqual:same}=require('node:util');
const axes=['AnchorOffsetX','AnchorOffsetY','AnchorOffsetZ'];
function effectOutputs(outputs,file){
 if(!outputs||typeof outputs!=='object'||Array.isArray(outputs))return;
 const vector=outputs.AnchorLocOffset;
 if(vector!==undefined){
  if(vector.Type!=='Vector'||!Array.isArray(vector.Range)||vector.Range.length!==3||vector.Range.some(part=>typeof part!=='string'))throw Error(file+': invalid vector effect output');
  for(const axis of ['X','Y','Z'])if(Object.hasOwn(outputs,'AnchorLocOffset.'+axis)||Object.hasOwn(outputs,'AnchorOffset'+axis))throw Error(file+': both vector and scalar effect outputs exist');
 }
 const next={};
 for(const [name,value]of Object.entries(outputs)){
  const axis=axes.indexOf(name),target=axis<0?name:'AnchorLocOffset.'+'XYZ'[axis];
  if(axis>=0&&Object.hasOwn(outputs,target))throw Error(file+': both old and new scalar effect outputs exist');
  if(name==='AnchorLocOffset')for(let i=0;i<3;i++)next['AnchorLocOffset.'+'XYZ'[i]]={...structuredClone(vector),Type:'Scalar',Range:vector.Range[i]};
  else next[target]=value;
 }
 for(const key of Object.keys(outputs))delete outputs[key];Object.assign(outputs,next);
}
function migrate(document,file,notes=[]){
 const data=structuredClone(document);
 if(file.endsWith('.effect'))effectOutputs(data.Outputs,file);
 function visit(value){
  if(!value||typeof value!=='object')return;
  if(axes.some(key=>Object.hasOwn(value,key))){
   if(Object.hasOwn(value,'AnchorLocOffset'))throw Error(file+': both old and new anchor channels exist');
   const nodes=axes.map(key=>value[key]),effect=file.endsWith('.effect'),first=nodes.find(v=>v!==undefined);
   if(!effect&&nodes.some(v=>v===undefined))throw Error(file+': incomplete anchor channels');
   let merged;
   if(typeof first==='number')merged=nodes;
   else{
    const common=node=>Object.fromEntries(Object.entries(node).filter(([key])=>!['Value','Type','ValueType','Min','Max','MappingName','Range'].includes(key)));
    if(nodes.filter(Boolean).some(node=>!same(common(node),common(first))))throw Error(file+': per-axis settings differ; merge must be reviewed');
    merged=structuredClone(first);merged.Type='Vector';
    if(Object.hasOwn(first,'ValueType')){
     delete merged.Type;merged.ValueType='Vector';
     if(nodes.every(node=>same(node.Value,first.Value)))merged.Value=first.Value;
     else if(same(nodes.map(node=>node.Value),[[0,0,0],[0,0,0],[0,0,200]])){
      merged.Value=[0,0,200];merged.Reference='CurrentViewpoint|default|World';
      notes.push('Convert split height to [0,0,200] in World rotation space');
     }else throw Error(file+': distinct per-axis target vectors require an explicit migration decision');
     if(first.ValueType==='Point')notes.push('Point trajectory changes to viewpoint-relative vector offset');
    }else if(Object.hasOwn(first,'Min')){merged.Min=nodes.map(n=>n.Min);merged.Max=nodes.map(n=>n.Max);}
    else if(Object.hasOwn(first,'MappingName'))merged.MappingName=nodes.map(n=>n.MappingName);
    else if(Object.hasOwn(first,'Range'))merged.Range=nodes.map(n=>n?.Range||'{0}');
   }
   const replacement={};for(const [key,child]of Object.entries(value)){if(axes.includes(key)){if(!Object.hasOwn(replacement,'AnchorLocOffset'))replacement.AnchorLocOffset=merged;}else replacement[key]=child;}
   for(const key of Object.keys(value))delete value[key];Object.assign(value,replacement);
  }
  for(const child of Object.values(value))visit(child);
  if(typeof value.Reference==='string'&&/^CurrentViewpoint(?:\|(?:default|socket_[a-z_]+))?$/.test(value.Reference)){
   const slot=value.Reference.split('|')[1]||'default';
   value.Reference='CurrentViewpoint|'+slot+'|'+(slot!=='default'&&value.bUseSocketRotation?'Socket':'Viewpoint');
  }
  delete value.bUseSocketRotation;
 }
 visit(data);return {data,notes};
}
function run(argv){
 const option=name=>{const i=argv.indexOf(name);return i<0?undefined:argv[i+1];};
 const supplied=option('--root');if(!supplied)throw Error('Usage: node scripts/migrate-anchor-offset.cjs --root <CameraFramework-or-Assets> [--apply --backup-dir <outside-Assets-directory>]');
 const resolved=fs.realpathSync(supplied),root=path.basename(resolved)==='Assets'?resolved:path.join(resolved,'Assets');
 const plans=[];
 function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(entry.isSymbolicLink())throw Error('Refusing symbolic link: '+path.join(dir,entry.name));const file=path.join(dir,entry.name);if(entry.isDirectory()){walk(file);continue;}const text=fs.readFileSync(file,'utf8');let before;try{before=JSON.parse(text);}catch{continue;}const relative=path.relative(root,file),result=migrate(before,relative);if(!same(before,result.data))plans.push({file,relative,text,...result});}}
 walk(root);const apply=argv.includes('--apply'),backup=option('--backup-dir');
 if(apply&&plans.length){
  if(!backup)throw Error('--apply requires --backup-dir; no files were written');
  const backupRoot=path.resolve(backup),relative=path.relative(root,backupRoot);
  if(!relative.startsWith('..')&&!path.isAbsolute(relative))throw Error('Backup directory must be outside Assets');
  if(fs.existsSync(backupRoot))throw Error('Backup directory already exists: '+backupRoot);
  for(const plan of plans)if(fs.readFileSync(plan.file,'utf8')!==plan.text)throw Error('Source changed during migration: '+plan.relative);
  fs.mkdirSync(backupRoot,{recursive:true});
  for(const plan of plans){const target=path.join(backupRoot,plan.relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,plan.text);}
  const written=[];try{for(const plan of plans){written.push(plan);fs.writeFileSync(plan.file,(JSON.stringify(plan.data,null,2)+'\n').replace(/\n/g,'\r\n'));}}
  catch(error){for(const plan of written)fs.writeFileSync(plan.file,plan.text);throw error;}
  fs.writeFileSync(path.join(backupRoot,'migration-report.json'),JSON.stringify(plans.map(({relative,notes})=>({file:relative,notes})),null,2));
 }
 return {mode:apply?'apply':'dry-run',files:plans.length,notes:plans.filter(p=>p.notes.length).map(({relative,notes})=>({file:relative,notes}))};
}
if(require.main===module){try{process.stdout.write(JSON.stringify(run(process.argv.slice(2)),null,2)+'\n');}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={migrate,run};
