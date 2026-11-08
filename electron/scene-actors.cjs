const defaultNpcs=id=>id==='lab'?[{id:'guide',name:'NPC 9999',position:[250,160,92],heading:180,dialogueId:9999}]:[];
function validateNpcs(npcs){
 if(!Array.isArray(npcs)||npcs.length>32)throw Error('NPC 数量须为 0–32');const ids=new Set();
 for(const n of npcs){if(!n||typeof n.id!=='string'||!/^[a-zA-Z0-9-]{1,64}$/.test(n.id)||ids.has(n.id))throw Error('NPC 标识无效或重复');ids.add(n.id);
 if(typeof n.name!=='string'||!n.name.trim()||n.name.length>64||!Array.isArray(n.position)||n.position.length!==3||!n.position.every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e6)||!Number.isFinite(n.heading)||Math.abs(n.heading)>360||!Number.isSafeInteger(n.dialogueId)||n.dialogueId<1)throw Error('NPC 参数无效');}
 return structuredClone(npcs);
}
module.exports={defaultNpcs,validateNpcs};
