// Save waits for asynchronous form edits as well as local numeric drafts.
const pending=new Map(),queues=new Map();
export function trackDocumentEdit(path,promise){
 const job=Promise.resolve(promise);let jobs=pending.get(path);if(!jobs){jobs=new Set();pending.set(path,jobs);}jobs.add(job);
 const remove=()=>{jobs.delete(job);if(!jobs.size&&pending.get(path)===jobs)pending.delete(path);};job.then(remove,remove);return job;
}
export function queueDocumentEdit(path,update){
 const job=(queues.get(path)||Promise.resolve()).catch(()=>{}).then(update);queues.set(path,job);
 const remove=()=>{if(queues.get(path)===job)queues.delete(path);};job.then(remove,remove);return job;
}
export async function flushDocumentEdits(path){
 while(true){const jobs=path?[...(pending.get(path)||[])]:[...pending.values()].flatMap(group=>[...group]);if(!jobs.length)return;await Promise.all(jobs);}
}
