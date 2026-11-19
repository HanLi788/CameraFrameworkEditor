// Slider limits are suggestions; only the native hard boundaries reject a value.
export function postValueIssue(channel,value){
 if(!Number.isFinite(value))return {message:'请输入完整的有限数值'};
 if(channel.positive&&value<=0)return {message:'数值必须大于零'};
 if(!channel.positive&&Number.isFinite(channel.minimum)&&value<channel.minimum)return {message:'数值不能小于',limit:channel.minimum};
 if(Number.isFinite(channel.maximum)&&value>channel.maximum)return {message:'数值不能大于',limit:channel.maximum};
 return null;
}
export function sliderBounds(channel,value){
 const current=postValueIssue(channel,value)?channel.default:value;
 let min=Number.isFinite(channel.min)?channel.min:Number.isFinite(channel.minimum)?channel.minimum:0;
 let max=Number.isFinite(channel.max)?channel.max:Number.isFinite(channel.maximum)?channel.maximum:1;
 if(Number.isFinite(current)){min=Math.min(min,current);max=Math.max(max,current);}
 if(Number.isFinite(channel.minimum))min=Math.max(min,channel.minimum);
 if(channel.positive&&min<=0)min=Math.min(Number.isFinite(current)&&current>0?current:1e-6,1e-6);
 if(Number.isFinite(channel.maximum))max=Math.min(max,channel.maximum);
 return {min,max:Math.max(min,max)};
}
