const path=require('node:path'),{Worker}=require('node:worker_threads');
const {normalize}=require('./procedural-world.cjs');
// Bounded cache, duplicate requests share one background job.
const cache=new Map(),pending=new Map();let queue=Promise.resolve();
function getWorld(options){
 const config=normalize(options);if(cache.has(config.key))return Promise.resolve(cache.get(config.key));
 if(pending.has(config.key))return pending.get(config.key);
 const task=queue.then(()=>new Promise((resolve,reject)=>{
   const worker=new Worker(path.join(__dirname,'world-worker.cjs'),{workerData:config});let complete=false;
   const timer=setTimeout(()=>{worker.terminate();reject(Error('地图生成超时'));},20000);
   worker.once('message',result=>{complete=true;clearTimeout(timer);if(result.error)return reject(Error(result.error));cache.set(config.key,result.value);while(cache.size>2)cache.delete(cache.keys().next().value);resolve(result.value);});
   worker.once('error',e=>{clearTimeout(timer);reject(e);});worker.once('exit',code=>{if(!complete){clearTimeout(timer);reject(Error('地图生成进程退出：'+code));}});
 })).finally(()=>pending.delete(config.key));queue=task.catch(()=>{});pending.set(config.key,task);return task;
}
module.exports={getWorld};
