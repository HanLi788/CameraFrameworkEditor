const path=require('node:path'),{spawn}=require('node:child_process');
function startGame(project){
 const child=spawn(project.runtime,[path.resolve('tests/wal-game-host.lua'),project.workspaceRoot],{windowsHide:true,stdio:['pipe','pipe','pipe']}),jobs=new Map();let seq=0,output='',errors='';
 child.stdout.setEncoding('utf8');child.stdout.on('data',chunk=>{output+=chunk;let end;while((end=output.indexOf('\n'))>=0){const line=output.slice(0,end);output=output.slice(end+1);if(!line.startsWith('HOST_RESULT:'))continue;const {id,result}=JSON.parse(line.slice(12));const job=jobs.get(id);if(job){jobs.delete(id);clearTimeout(job.timer);result.Error?job.reject(Error(result.Error)):job.resolve(result);}}});child.stderr.on('data',chunk=>errors+=chunk);child.stdin.on('error',()=>{});
 const request=(action,args={},initial=false)=>new Promise((resolve,reject)=>{const key=initial?0:++seq,timer=setTimeout(()=>{jobs.delete(key);reject(Error(errors||'Game host timeout'));},20000);jobs.set(key,{resolve,reject,timer});if(!initial)child.stdin.write(JSON.stringify({action,...args,id:key})+'\n');});
 child.on('exit',()=>{for(const job of jobs.values()){clearTimeout(job.timer);job.reject(Error(errors||'Game host exited'));}jobs.clear();});
 return {ready:request('',{},true),request,close:()=>{child.stdin.end();child.kill();}};
}
module.exports={startGame};
