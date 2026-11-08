const {test}=require('node:test'),assert=require('node:assert/strict');
const {FRAME_RATES,SimulationClock}=require('../electron/simulation-clock.cjs');
test('fixed-step clocks produce exactly the selected number of logical steps per second',()=>{
 for(const rate of FRAME_RATES){const clock=new SimulationClock(rate,100);assert.equal(clock.due(100),0);assert.equal(clock.due(100+1000/rate),1);assert.equal(clock.due(1100,120),rate);clock.complete(rate);assert.equal(clock.due(1100),0);assert.ok(Math.abs(clock.delay(1100)-1000/rate)<1e-8);assert.equal(clock.metrics(1100).actualHz,rate);}
});
test('catch-up is bounded per batch and preserves all overdue logical time',()=>{
 const clock=new SimulationClock(120,0);let batches=0;
 while(clock.due(1000)){const count=clock.due(1000);assert.ok(count<=8);clock.complete(count);batches++;}
 assert.equal(clock.steps,120);assert.equal(batches,15);assert.equal(clock.metrics(1000).lateMs,0);
 assert.equal(clock.due(10000),8);clock.complete(8);assert.ok(clock.metrics(10000).lateMs>8000);assert.equal(clock.delay(10000),0);
});
test('pausing and rate switches start fresh wall clocks without counting paused time',()=>{
 const before=new SimulationClock(60,0);before.complete(60);const resumed=new SimulationClock(90,6000);assert.equal(resumed.due(6000),0);assert.equal(resumed.due(7000,120),90);assert.equal(resumed.metrics(6000).actualHz,null);assert.throws(()=>new SimulationClock(144,0));
});
test('actual logic frequency reflects recent work and exposes persistent lag',()=>{
 const clock=new SimulationClock(120,0);clock.complete(120);assert.equal(clock.metrics(1000).actualHz,120);
 clock.complete(60);const metrics=clock.metrics(2000);assert.equal(metrics.actualHz,60);assert.ok(metrics.lateMs>400);
});
