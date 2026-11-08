const {parentPort,workerData}=require('node:worker_threads');
const {generate}=require('./procedural-world.cjs');
try{parentPort.postMessage({value:generate(workerData)});}catch(e){parentPort.postMessage({error:e.message});}
