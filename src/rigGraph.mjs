// References describe a graph. Render occurrences as a tree, but count owners by
// distinct Rig path so repeated mounts and indirect dependencies are not double counted.
const key = path => path.toLowerCase();
export function assetIndex(assets) { return new Map(assets.map(asset => [key(asset.path), asset])); }
export function rigOwners(assets) {
  const index=assetIndex(assets), owners=new Map();
  for(const rig of assets.filter(asset=>asset.type==='Rig')){
    const visited=new Set(),pending=[rig.path];
    while(pending.length){
      const path=pending.pop(),id=key(path);if(visited.has(id))continue;visited.add(id);
      if(!owners.has(id))owners.set(id,new Set());owners.get(id).add(rig.path);
      for(const ref of index.get(id)?.refs||[])pending.push(ref.path);
    }
  }
  return new Map([...owners].map(([path,rigs])=>[path,[...rigs].sort()]));
}
export const rigGroups=[
  ['Pipelines','管线'],['Ranges','范围约束'],['Processors.Input','输入'],
  ['Processors.Occlusion','遮挡'],
  ['Processors.Effects','效果'],['Processors.Smooth','平滑'],['ValueAssets','目标值'],
];
export function buildRigTree(assets,rigPath,maxNodes=1200){
  const index=assetIndex(assets),nodes=new Map();let remaining=maxNodes;
  const visit=(path,id,ancestors,parent,edge='')=>{
    const asset=index.get(key(path)),canonical=asset?.path||path;
    const node={id,path:canonical,asset,parent,edge,kind:'asset',issue:'',children:[]};nodes.set(id,node);remaining--;
    if(!asset){node.issue='missing';return node;}
    if(ancestors.has(key(path))){node.issue='cycle';return node;}
    if(remaining<=0||ancestors.size>=32){node.issue='limit';return node;}
    const next=new Set([...ancestors,key(path)]);
    const append=(target,refs)=>{
      for(const ref of refs){
        if(remaining<=0){const limit={id:target.id+'/limit',kind:'limit',issue:'limit',parent:target.id,path:'',children:[]};target.children.push(limit);nodes.set(limit.id,limit);break;}
        const childId=target.id+'/'+encodeURIComponent(ref.field)+':'+encodeURIComponent(ref.path);
        target.children.push(visit(ref.path,childId,next,target.id,ref.field));
      }
    };
    if(id==='root'){
      const groups=new Map();
      for(const ref of asset.refs){const group=rigGroups.find(([prefix])=>ref.field.startsWith(prefix+'.'))||['Other','其他引用'];if(!groups.has(group[0]))groups.set(group[0],{label:group[1],refs:[]});groups.get(group[0]).refs.push(ref);}
      for(const [groupKey,group] of groups){const child={id:'group:'+groupKey,kind:'group',label:group.label,parent:id,path:'',children:[]};nodes.set(child.id,child);append(child,group.refs);node.children.push(child);}
      node.children.sort((a,b)=>{const rank=n=>{const i=rigGroups.findIndex(([k])=>n.id==='group:'+k);return i<0?99:i;};return rank(a)-rank(b);});
    }else append(node,asset.refs);
    return node;
  };
  const root=visit(rigPath,'root',new Set(),'');
  return {root,nodes};
}
export function findOccurrence(tree,path,preferred=''){
  const node=tree.nodes.get(preferred);if(node?.path&&key(node.path)===key(path))return node;
  return [...tree.nodes.values()].find(node=>node.path&&key(node.path)===key(path)&&node.kind==='asset');
}
export function ancestorIds(tree,node){const ids=[];while(node?.parent){ids.push(node.parent);node=tree.nodes.get(node.parent);}return ids;}

// Group labels do not add a reference level. Each occurrence keeps its own row.
export function layoutRigTree(tree,expanded){
 const nodes=[],links=[],width=276,height=56,step=376,gap=20,padding=24,top=52;
 let row=0,maxDepth=0;
 const children=node=>node.children.flatMap(child=>child.kind==='group'?child.children:[child]);
 const place=(node,depth,parent)=>{
  maxDepth=Math.max(maxDepth,depth);
  const item={node,depth,x:padding+depth*step,y:0,width,height};nodes.push(item);
  const visible=expanded.has(node.id)?children(node):[];
  const descendants=visible.map(child=>place(child,depth+1,item));
  item.y=descendants.length?(descendants[0].y+descendants.at(-1).y)/2:top+row++*(height+gap);
  if(parent)links.push({from:parent,to:item});return item;
 };
 place(tree.root,0,null);
 return {nodes,links,width:padding*2+maxDepth*step+width,height:Math.max(180,top+row*(height+gap)),step,nodeWidth:width,padding,maxDepth};
}
