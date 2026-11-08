const FRAME_RATES=Object.freeze([30,60,90,120]);

// Count completed fixed steps against monotonic wall time. A bounded IPC batch
// yields to the UI between catch-up requests without discarding overdue time.
class SimulationClock {
  constructor(rate,now){
    if(!FRAME_RATES.includes(rate))throw Error('不支持的模拟帧率');
    this.rate=rate;this.period=1000/rate;this.origin=now;this.steps=0;
    this.sampleOrigin=now;this.sampleSteps=0;this.actualHz=null;
  }
  due(now,limit=8){return Math.max(0,Math.min(limit,Math.floor((now-this.origin)/this.period+1e-7)-this.steps));}
  complete(count){this.steps+=count;}
  delay(now){return Math.max(0,this.origin+(this.steps+1)*this.period-now);}
  metrics(now){
    const elapsed=Math.max(0,now-this.origin);
    const window=Math.max(0,now-this.sampleOrigin);
    if(window>=250){this.actualHz=(this.steps-this.sampleSteps)*1000/window;if(window>=1000){this.sampleOrigin=now;this.sampleSteps=this.steps;}}
    return {targetHz:this.rate,actualHz:this.actualHz,
      lateMs:Math.max(0,elapsed-(this.steps+1)*this.period)};
  }
}
module.exports={FRAME_RATES,SimulationClock};
