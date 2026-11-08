
// Rendering has its own clock. Missed browser callbacks never advance gameplay
// or cause a burst of render catch-up frames.
export function createRenderClock(){
 let rate,next;
 return (now,fps)=>{
  if(rate!==fps){rate=fps;next=now;}
  if(now+.1<next)return false;
  const interval=1000/fps;next+=interval;
  if(next<now-interval)next=now+interval;
  return true;
 };
}
