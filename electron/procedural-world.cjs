// Versioned deterministic world description. Metres, X/Y ground plane, Z up.
// Rendering and collision both consume these exact primitives.
const VERSION=1, CELL=4, SIZE=32;
const palette={
 grass:{top:'#82ad48',side:'#8c6849'},grassLight:{top:'#8eb851',side:'#92704e'},grassDark:{top:'#739d40',side:'#806345'},
 mud:{top:'#64663c',side:'#625343'},sand:{top:'#d8c598',side:'#b8a27a'},path:{top:'#b9a078',side:'#8b6d4d'},
 stone:{top:'#a2adb1',side:'#89979e'},trunk:{top:'#785639',side:'#6e5038'},leaf:{top:'#658a39',side:'#53772f'},
 swampLeaf:{top:'#62713a',side:'#4e5f32'},wood:{top:'#a1855e',side:'#806247'},reed:{top:'#87934a',side:'#687a3f'}
};
function normalize(options={}){
 const environment=options.environment||'lab';if(!['lab','explore'].includes(environment))throw Error('未知程序化地图');
 const seed=environment==='lab'?'camera-lab':String(options.seed??'Camera-2026').trim();
 if(!seed||seed.length>64)throw Error('种子须为 1–64 个字符');
 if(options.version!==undefined&&options.version!==VERSION)throw Error('不支持的地图生成器版本');
 return {environment,seed,version:VERSION,key:`${VERSION}:${environment}:${seed}`};
}
function hash(seed){let value=2166136261;for(const c of seed){value^=c.codePointAt(0);value=Math.imul(value,16777619);}return value>>>0;}
function random(seed){let state=hash(seed);return()=>{state+=0x6D2B79F5;let x=state;x=Math.imul(x^x>>>15,x|1);x^=x+Math.imul(x^x>>>7,x|61);return ((x^x>>>14)>>>0)/4294967296;};}
// Local triangle coordinates also shipped to the renderer for sloped primitives.
const cube=[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]];
const faces=[[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]];
const rampVertices=cube.map((p,i)=>i===4||i===7?[p[0],p[1],-.5]:p);
const rampTriangles=faces.flatMap(f=>f.flatMap(i=>rampVertices[i]));
function generate(options={}){
 const config=normalize(options),rng=random(config.seed),explore=config.environment==='explore',boxes=[],water=[];
 const add=(name,x,y,z,w,d,h,material,solid=true,shape='box')=>{const b={id:boxes.length+1,name,x,y,z,w,d,h,material,solid,shape};boxes.push(b);return b;};
 const lake={kind:'lake',x:explore?24+rng()*10:30,y:explore?14+rng()*12:20,rx:explore?9+rng()*5:11,ry:explore?8+rng()*4:9};
 const swamp={kind:'swamp',x:explore?20+rng()*14:28,y:explore?-20-rng()*12:-24,rx:explore?10+rng()*4:12,ry:explore?9+rng()*3:10};
 const phase=[rng()*6.28,rng()*6.28,rng()*6.28],heights=[],tiles=[];
 for(let ix=0;ix<SIZE;ix++){heights[ix]=[];for(let iy=0;iy<SIZE;iy++){
   const x=(ix-SIZE/2+.5)*CELL,y=(iy-SIZE/2+.5)*CELL,dist=Math.hypot(x,y);
   const basin=[lake,swamp].find(b=>((x-b.x)/b.rx)**2+((y-b.y)/b.ry)**2<1);
   const shore=[lake,swamp].find(b=>((x-b.x)/(b.rx+4))**2+((y-b.y)/(b.ry+4))**2<1);
   const corridor=(Math.abs(y)<4&&x>-8&&x<48)||(Math.abs(x-10)<4&&Math.abs(y)<42);
   const safe=dist<10||corridor||(!explore&&x>-12&&x<24&&Math.abs(y)<16);
   const noise=(Math.sin(x*.075+phase[0])+Math.cos(y*.09+phase[1])+Math.sin((x+y)*.05+phase[2]))/3;
   const edge=Math.max(0,(Math.max(Math.abs(x),Math.abs(y))-48)/8);
   let h=safe?0:Math.max(0,Math.round((noise+1)*1.5+edge*2)*.5);
   if(shore&&!safe)h=0;
   if(basin&&!safe)h=basin.kind==='lake'?-.5:-.3;
   heights[ix][iy]=h;
   const material=basin&&!safe?(basin.kind==='lake'?'sand':'mud'):shore&&!safe?(shore.kind==='lake'?'sand':'mud'):corridor?'path':['grass','grassLight','grassDark'][Math.floor(rng()*3)];
   add(`terrain-${ix}-${iy}`,x,y,-3,CELL,CELL,h+3,material);
   tiles.push({x,y,h,safe,basin:basin&&!safe?basin.kind:null,shore:shore?.kind});
   if(basin&&!safe)water.push({x,y,z:.04,w:CELL,d:CELL,kind:basin.kind});
 }}
 // Fixed guide clearing and reachable spawn on the protected central patch.
 add('guide-plaza',2.5,1.6,0,4,4,.04,'stone');
 const markers=[];
 if(!explore){
   add('occlusion-wall',9,-7,0,.6,10,3.6,'stone');add('occlusion-corner',12,-12,0,6.6,.6,3.6,'stone');
   add('passage-wall',13,-7,0,.6,6,3.6,'stone');
   for(let i=0;i<6;i++)add('step-'+i,13+i*.8,8,0,.8,3,(i+1)*.2,'stone');
   add('raised-platform',19,8,0,5,7,1.2,'grass');add('ramp',14.1,12,0,4.8,3,1.2,'grass',true,'ramp');
   markers.push({name:'walls',x:9,y:-7},{name:'steps',x:15,y:8});
 }
 for(const tile of tiles){
   const {x,y,h}=tile;
   if(tile.safe||Math.hypot(x,y)<13||(!explore&&x>7&&x<24&&Math.abs(y)<18))continue;
   const chance=rng();
   if(!tile.basin&&chance<.075){
     const tx=x+(rng()-.5),ty=y+(rng()-.5),height=2.4+rng()*1.3,wet=tile.shore==='swamp';
     add('tree-trunk',tx,ty,h,.55,.55,height,'trunk');
     add('tree-crown',tx,ty,h+height- .15,3.2,3.2,1.7,wet?'swampLeaf':'leaf');
     add('tree-crown-top',tx+.25,ty-.2,h+height+1.5,2.2,2.2,1,wet?'swampLeaf':'leaf');
   }else if(!tile.basin&&chance<.11){const size=.65+rng();add('rock',x,y,h,size,size*.9,size*.8,'stone');}
   if(tile.basin==='swamp'||tile.shore==='swamp'){
     for(let i=0;i<2;i++)add('reeds',x+(rng()-.5)*2.6,y+(rng()-.5)*2.6,Math.max(.04,h),.12,.12,.35+rng()*.55,'reed',false);
   }
 }
 // A dry boardwalk across the marsh is generated from the same solid boxes.
 for(let x=swamp.x-swamp.rx-2;x<=swamp.x+swamp.rx+2;x+=2)add('boardwalk',x,swamp.y,.12,2,1.8,.18,'wood');
 const world={...config,procedural:true,palette,boxes,water,biomes:[lake,swamp],markers,rampTriangles,
   spawn:[0,0,88],target:[250,160,92],route:[[0,-600,88],[0,600,88]],bounds:[-64,-64,64,64],size:128,cell:CELL};
 return {world,collision:collisionFor(world)};
}
function collisionFor(world){
 const triangles=[];
 for(const b of world.boxes){if(!b.solid)continue;const vertices=(b.shape==='ramp'?rampVertices:cube).map(p=>[(b.x+p[0]*b.w)*100,(b.y+p[1]*b.d)*100,(b.z+(p[2]+.5)*b.h)*100]);
   for(const f of faces){const a=vertices[f[0]],c=vertices[f[1]],d=vertices[f[2]],u=c.map((v,i)=>v-a[i]),v=d.map((n,i)=>n-a[i]);if(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])<1e-7)continue;triangles.push([...a,...c,...d].map(n=>Math.round(n*1000)/1000).concat(b.id));}
 }
 const nodes=[];
 function build(start,end){const index=nodes.length+1,node={b:[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity]};nodes.push(node);
   for(let i=start;i<end;i++)for(let j=0;j<9;j++){const k=j%3;node.b[k]=Math.min(node.b[k],triangles[i][j]);node.b[k+3]=Math.max(node.b[k+3],triangles[i][j]);}
   if(end-start<=12){node.s=start+1;node.n=end-start;}else{const ext=node.b.slice(3).map((v,i)=>v-node.b[i]),axis=ext.indexOf(Math.max(...ext));const sorted=triangles.slice(start,end).sort((a,b)=>(a[axis]+a[axis+3]+a[axis+6])-(b[axis]+b[axis+3]+b[axis+6]));for(let i=0;i<sorted.length;i++)triangles[start+i]=sorted[i];const mid=(start+end)>>1;node.l=build(start,mid);node.r=build(mid,end);}return index;
 }
 build(0,triangles.length);return {triangles,nodes,meshes:world.boxes.map(b=>b.name+'-'+b.id)};
}
module.exports={VERSION,normalize,generate,collisionFor};
