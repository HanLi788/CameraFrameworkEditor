const {test}=require('node:test'),assert=require('node:assert/strict');
const moduleReady=import('../src/renderFrames.mjs');
test('render clock meets 30/60/90/120 caps without changing logic or exceeding browser callbacks',async()=>{
 const {createRenderClock}=await moduleReady;
 for(const rate of [30,60,90,120]){
  const due=createRenderClock();let rendered=0;for(let i=0;i<2400;i++)if(due(i*1000/240,rate))rendered++;
  assert.ok(Math.abs(rendered-rate*10)<=1,`${rate}: ${rendered}`);
 }
 const due=createRenderClock();let rendered=0;for(let i=0;i<600;i++)if(due(i*1000/60,120))rendered++;
 assert.equal(rendered,600);
 assert.equal(due(20000,120),true);assert.equal(due(20000,120),false);
 assert.equal(due(20000,30),true);assert.equal(due(20001,30),false);
});
