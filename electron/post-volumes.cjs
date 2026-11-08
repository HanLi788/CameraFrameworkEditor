const globalVolume=(catalog=[])=>({id:'global',name:'Global',global:true,enabled:true,priority:0,weight:1,center:[0,0,0],size:[1000,1000,1000],blend:0,values:Object.fromEntries(catalog.map(c=>[c.name,c.default]))});
function validateVolumes(volumes,catalog){
 if(!Array.isArray(volumes)||!volumes.length||volumes.length>64)throw Error('后处理体积数量须为 1–64');
 const names=new Map(catalog.map(c=>[c.name,c])),ids=new Set();let globals=0;
 const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 for(const v of volumes){
  if(!v||typeof v!=='object'||typeof v.id!=='string'||!/^[a-zA-Z0-9-]{1,64}$/.test(v.id)||ids.has(v.id))throw Error('体积标识无效或重复');ids.add(v.id);
  if(typeof v.name!=='string'||!v.name.trim()||v.name.length>64||typeof v.global!=='boolean'||typeof v.enabled!=='boolean')throw Error('体积名称或状态无效');
  if(v.global){globals++;if(v.id!=='global'||!v.enabled)throw Error('必须保留启用的默认全局体积');}else if(v.id==='global')throw Error('全局体积标识不可用于局部体积');
  if(!finite(v.priority,-10000,10000)||!finite(v.weight,0,1)||!finite(v.blend,0,100000))throw Error('体积优先级、权重或混合距离无效');
  for(const [key,min,max] of [['center',-1000000,1000000],['size',1,2000000]])if(!Array.isArray(v[key])||v[key].length!==3||!v[key].every(x=>finite(x,min,max)))throw Error('体积位置或尺寸无效');
  if(!v.values||typeof v.values!=='object'||Array.isArray(v.values))throw Error('体积参数必须为对象');
  for(const [name,value] of Object.entries(v.values)){
   const c=names.get(name);if(!c||!finite(value,-1e12,1e12)||c.minimum!==undefined&&value<c.minimum||c.maximum!==undefined&&value>c.maximum||c.positive&&value<=0)throw Error('体积参数无效：'+name);
  }
 }
 if(globals!==1)throw Error('必须且只能保留一个全局体积');
 return structuredClone(volumes);
}
module.exports={globalVolume,validateVolumes};
