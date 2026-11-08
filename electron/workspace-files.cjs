const {PLAN,writable}=require('./postprocessing.cjs');
const fs=require('node:fs/promises'),path=require('node:path');
// Folder and non-asset file operations share the project's validation/backup boundary.
async function mutateFiles(project,request,snap,{cleanRelative,extensions,references,encode}){
 const source=cleanRelative(request.sourcePath||''),folder=snap.directories.includes(source);
 if(!source.startsWith('Assets/'))throw Error('只允许操作 Assets 内的文件或文件夹');
 const files=folder?snap.files.filter(f=>f.path.startsWith(source+'/')):snap.files.filter(f=>f.path===source);
 if(!folder&&!files.length)throw Error('文件不存在');
 if(!folder&&request.sourceRevision!==(await project.read(source)).revision)throw Error('文件已变化，请重试');
 for(const file of files)writable(file.path);
 const removing=request.kind==='delete',copying=request.kind==='copy';
 let destination;if(!removing){destination=cleanRelative(request.path);if(!destination.startsWith('Assets/'))throw Error('目标必须位于 Assets 内');if(destination===source||destination.startsWith(source+'/'))throw Error('不能移动到自身或其子目录');if(!folder&&path.extname(destination)!==path.extname(source))throw Error('重命名不能修改文件后缀');if(await fs.stat(await project.resolve(destination,true)).catch(()=>null))throw Error('目标已存在');}
 const mapping=new Map(files.map(f=>[f.path,destination+(folder?f.path.slice(source.length):'')]));const entries=[];
 const rewrite=data=>{const next=structuredClone(data);for(const r of references(next)){const original=[...mapping.keys()].find(p=>p.toLowerCase()===r.path.toLowerCase());if(!original)continue;let node=next;for(const key of r.parts.slice(0,-1))node=node[key];node[r.parts.at(-1)]=mapping.get(original);}return next;};
 for(const a of snap.assets){if(files.some(f=>f.path===a.path))continue;const used=a.refs.some(r=>files.some(f=>f.path.toLowerCase()===r.path.toLowerCase()));if(!used||copying)continue;if(removing)throw Error('文件夹内资产仍被引用：'+a.path);entries.push([a.path,encode(rewrite(a.data))]);}
 for(const f of files){const text=(await project.read(f.path)).text,asset=snap.assets.find(a=>a.path===f.path);if(!removing)entries.push([mapping.get(f.path),asset&&!copying?encode(rewrite(asset.data)):text]);if(!copying)entries.push([f.path,null]);}
 if(removing)project.assertPostUnreferenced(files.map(f=>f.path),snap);
 if(!removing&&!copying)await project.rewritePostBindings(entries,Object.fromEntries(mapping),snap);
 const check=await project.validate(Object.fromEntries(entries));if(check.issues.some(i=>i.severity==='error'))throw Error(check.issues.filter(i=>i.severity==='error').map(i=>i.message).join('\n'));
 entries.push([PLAN,check.planText]);
 await project.assertUnchanged(snap);if(destination&&await fs.stat(await project.resolve(destination,true)).catch(()=>null))throw Error('校验期间目标被创建，操作已取消');
 const before=[];for(const [rel] of entries)before.push([rel,await project.read(rel).then(d=>d.text).catch(e=>{if(e.code==='ENOENT')return null;throw e;})]);
 const backup=await project.backup(before,request.kind);const subdirs=folder?snap.directories.filter(d=>d===source||d.startsWith(source+'/')).sort((a,b)=>b.length-a.length):[];
 try{if(folder&&!removing)for(const d of [...subdirs].reverse())await fs.mkdir(await project.resolve(destination+d.slice(source.length),true),{recursive:true});for(const [rel,text] of entries){if(text===null)await fs.unlink(await project.resolve(rel));else await project.atomic(rel,text);}if(folder&&!copying)for(const d of subdirs)await fs.rmdir(await project.resolve(d));}
 catch(e){if(folder&&!copying)for(const d of [...subdirs].reverse())await fs.mkdir(await project.resolve(d,true),{recursive:true});for(const [rel,text]of before){if(text!==null)await project.atomic(rel,text);else await fs.unlink(await project.resolve(rel,true)).catch(()=>{});}if(folder&&destination)for(const d of subdirs)await fs.rmdir(await project.resolve(destination+d.slice(source.length),true)).catch(()=>{});throw e;}
 return {path:folder?undefined:destination,directory:folder?destination:undefined,backup,moves:copying?{}:Object.fromEntries(files.map(f=>[f.path,removing?null:mapping.get(f.path)]))};
}
module.exports={mutateFiles};
