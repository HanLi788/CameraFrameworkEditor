export const supportedVolumeChannels=new Set(['ExposureCompensation','VignetteIntensity',...['Saturation','Contrast','Gamma','Gain','Offset'].flatMap(n=>['X','Y','Z','W'].map(c=>n+c)),...['R','G','B'].map(c=>'SceneColorTint'+c)]);
export function volumeInfluence(v,position){
 if(!v.enabled)return 0;if(v.global)return v.weight;
 const distance=Math.hypot(...v.center.map((p,i)=>Math.max(0,Math.abs(position[i]-p)-v.size[i]/2)));
 return (distance===0?1:v.blend>0?Math.max(0,1-distance/v.blend):0)*v.weight;
}
export function sampleVolumes(volumes,catalog,position,offsets={}){
 const values=Object.fromEntries(catalog.map(c=>[c.name,c.default])),active=[];
 const ordered=volumes.map((v,i)=>({v,i})).sort((a,b)=>Number(b.v.global)-Number(a.v.global)||a.v.priority-b.v.priority||a.i-b.i);
 for(const {v} of ordered){const weight=volumeInfluence(v,position);if(!weight)continue;active.push({id:v.id,weight});for(const [key,value] of Object.entries(v.values))if(Object.hasOwn(values,key))values[key]+=(value-values[key])*weight;}
 const errors=[];
 for(const c of catalog){values[c.name]+=offsets[c.name]||0;const v=values[c.name];if(!Number.isFinite(v)||c.minimum!==undefined&&v<c.minimum||c.maximum!==undefined&&v>c.maximum||c.positive&&v<=0)errors.push(c.name);}
 return {values,active,errors};
}

export const defaultVolumeValues=catalog=>Object.fromEntries(catalog.map(c=>[c.name,c.default]));
export const overridePeers=(catalog,name)=>{const channel=catalog.find(c=>c.name===name);return catalog.filter(c=>c.name===name||channel?.native&&c.native===channel.native);};
export function setVolumeOverride(values,catalog,name,enabled,drafts={}){const next={...values};for(const c of overridePeers(catalog,name)){if(enabled)next[c.name]=next[c.name]??drafts[c.name]??c.default;else delete next[c.name];}return next;}
