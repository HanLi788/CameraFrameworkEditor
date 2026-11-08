// Produce collision data from the exact glTF triangles used by the viewport.
// No map authoring: the downloaded scene is kept intact and transformed as one asset.
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
globalThis.ProgressEvent=class ProgressEvent{constructor(type,data){this.type=type;Object.assign(this,data);}};
const source='public/preview/maps/city/scene.gltf',data=JSON.parse(await fs.readFile(source,'utf8'));
for(const b of data.buffers)b.uri='data:application/octet-stream;base64,'+(await fs.readFile('public/preview/maps/city/'+b.uri)).toString('base64');
delete data.images;delete data.textures;delete data.materials;for(const m of data.meshes)for(const p of m.primitives)delete p.material;
const {scene}=await new GLTFLoader().parseAsync(JSON.stringify(data),'');
const preset=JSON.parse(await fs.readFile('electron/preview-presets.json','utf8')).city;scene.scale.setScalar(preset.scale);scene.position.fromArray(preset.offset);scene.updateMatrixWorld(true);
const tris=[],meshes=[],v=new THREE.Vector3();
scene.traverse(o=>{if(!o.isMesh)return;meshes.push(o.name);const g=o.geometry,p=g.attributes.position,index=g.index;for(let i=0;i<(index?.count||p.count);i+=3){const a=[];for(let k=0;k<3;k++){v.fromBufferAttribute(p,index?index.getX(i+k):i+k).applyMatrix4(o.matrixWorld);a.push(...[v.x,v.z,v.y].map(n=>Math.round(n*100000)/1000));}const ab=new THREE.Vector3(a[3]-a[0],a[4]-a[1],a[5]-a[2]),ac=new THREE.Vector3(a[6]-a[0],a[7]-a[1],a[8]-a[2]);if(ab.cross(ac).lengthSq()>.0001)tris.push([...a,meshes.length]);}});
const nodes=[],ordered=[];
function build(items){const b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(const t of items)for(let k=0;k<9;k++) {const axis=k%3;b[axis]=Math.min(b[axis],t[k]);b[axis+3]=Math.max(b[axis+3],t[k]);}const n={b},id=nodes.push(n);if(items.length<=12){n.s=ordered.length+1;n.n=items.length;ordered.push(...items);}else{let axis=0;for(let k=1;k<3;k++)if(b[k+3]-b[k]>b[axis+3]-b[axis])axis=k;items.sort((a,c)=>a[axis]+a[axis+3]+a[axis+6]-c[axis]-c[axis+3]-c[axis+6]);const half=Math.floor(items.length/2);n.l=build(items.slice(0,half));n.r=build(items.slice(half));}return id;}
build(tris);await fs.mkdir('electron/preview-data',{recursive:true});await fs.writeFile('electron/preview-data/city.json',JSON.stringify({nodes,triangles:ordered,meshes}));
const presets=JSON.parse(await fs.readFile('electron/preview-presets.json','utf8')),ray=new THREE.Raycaster();
for(const preset of Object.values(presets).filter(p=>p.model))for(let n=0;n<=20;n++){
  const p=preset.route[0].map((x,k)=>x+(preset.route[1][k]-x)*n/20),feet=(p[2]-88)/100;
  ray.set(new THREE.Vector3(p[0]/100,feet+1,p[1]/100),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(scene)[0];
  if(!hit||Math.abs(hit.point.y-feet)>.05)throw Error('Preset route is not supported by the downloaded ground: '+preset.label);
}
console.log('Triangles',tris.length,'BVH nodes',nodes.length,'preset routes verified');
