const {test}=require('node:test'),assert=require('node:assert/strict');
test('immediate Save observes all queued form transformations in their original order',async()=>{
 const {trackDocumentEdit,queueDocumentEdit,flushDocumentEdits}=await import('../src/documentEdits.mjs');
 let text={Outputs:{}},release;const gate=new Promise(resolve=>release=resolve);
 trackDocumentEdit('filter',queueDocumentEdit('filter',async()=>{await gate;text={...text,Outputs:{Exposure:0}};}));
 trackDocumentEdit('filter',queueDocumentEdit('filter',async()=>{text={...text,Outputs:{...text.Outputs,Exposure:.35}};}));
 let saved;const save=flushDocumentEdits('filter').then(()=>saved=structuredClone(text));release();await save;assert.deepEqual(saved,{Outputs:{Exposure:.35}});
});
test('saving one document does not wait for another and failed edits remain observable',async()=>{
 const {trackDocumentEdit,queueDocumentEdit,flushDocumentEdits}=await import('../src/documentEdits.mjs');let release;
 trackDocumentEdit('other',new Promise(resolve=>release=resolve));await flushDocumentEdits('current');
 const failed=trackDocumentEdit('current',queueDocumentEdit('current',async()=>{throw Error('edit rejected');}));await assert.rejects(flushDocumentEdits('current'),/edit rejected/);await assert.rejects(failed,/edit rejected/);
 let next=false;await trackDocumentEdit('current',queueDocumentEdit('current',()=>{next=true;}));release();await flushDocumentEdits();assert.equal(next,true);
});
