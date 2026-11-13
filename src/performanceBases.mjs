export const performanceBaseLabels={
 PERFORMANCE_PLAYER:'玩家',PERFORMANCE_AVATAR:'Avatar',PERFORMANCE_ROLE:'角色',
 PERFORMANCE_MUTABLEPAWN:'可变角色',PERFORMANCE_NPC:'NPC',PERFORMANCE_SCENEITEM:'场景物件',
 PERFORMANCE_TOTEM:'图腾',PERFORMANCE_PREVIEWPLAYEER:'预览玩家',PERFORMANCE_PREVIEWNPC:'预览 NPC',
 PERFORMANCE_SEQUENCEPLAYER:'过场玩家',PERFORMANCE_SEQUENCEPNPC:'过场 NPC'
};
export function performanceBaseOptions(registered,assets,current){
 const options=new Map();
 for(const name of registered||[])if(typeof name==='string'&&/^PERFORMANCE_[A-Z0-9_]+$/.test(name))options.set(name,{value:name,registered:true});
 const existing=new Set(assets.filter(a=>a.type==='Value').map(a=>a.data?.PerformanceType?.BaseName).filter(name=>typeof name==='string'&&/^PERFORMANCE_[A-Z0-9_]+$/.test(name)));
 for(const name of [...existing].sort())if(!options.has(name))options.set(name,{value:name,registered:false});
 if(typeof current==='string'&&!options.has(current))options.set(current,{value:current,registered:false});
 return [...options.values()];
}
