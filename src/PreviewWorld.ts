import * as THREE from 'three';
import {ProceduralScene,WorldData} from './ProceduralScene';
import {BlockAvatar} from './BlockAvatar';
const presets={lab:{label:'固定实验场',spawn:[0,0,88],target:[250,160,92]},explore:{label:'种子探索',spawn:[0,0,88],target:[250,160,92]}};
export type Environment=keyof typeof presets;
export {presets};
export class PreviewWorld{
 private terrain:ProceduralScene|null=null;private player=new BlockAvatar();private npcs=new Map<string,BlockAvatar>();
 private raycaster=new THREE.Raycaster();private disposed=false;
 private selectedBox=new THREE.Box3Helper(new THREE.Box3(),0xf2c16f);
 private ghostNpc=new BlockAvatar(true);private ghostVolume=new THREE.Mesh(new THREE.BoxGeometry(5,5,5),new THREE.MeshBasicMaterial({color:0x79dab5,transparent:true,opacity:.25,depthWrite:false}));
 constructor(private scene:THREE.Scene,private owner:THREE.Mesh,private subject:THREE.Mesh,private grid:THREE.GridHelper){
  scene.add(this.player.root,this.selectedBox,this.ghostNpc.root,this.ghostVolume);this.selectedBox.visible=false;this.ghostNpc.root.visible=false;this.ghostVolume.visible=false;
  this.ghostNpc.root.traverse((o:any)=>{if(o.material){o.material.transparent=true;o.material.opacity=.5;}});
 }
 async prepare(data:WorldData,character:string){
  if(this.disposed)return;if(this.terrain?.data.key!==data.key){this.terrain?.dispose();this.terrain=new ProceduralScene(data,this.scene);}
  this.grid.visible=false;this.owner.visible=character==='capsule';this.subject.visible=false;this.player.root.visible=character!=='capsule';
 }
 overview(camera:THREE.PerspectiveCamera){const size=this.terrain?.data.size||128;camera.fov=60;const half=Math.atan(Math.tan(Math.PI/6)*Math.min(1,camera.aspect)),distance=(size*.74+5)/Math.sin(half);camera.position.set(0,.83,.56).normalize().multiplyScalar(distance);camera.up.set(0,1,0);camera.lookAt(0,0,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();}
 private ray(camera:THREE.Camera,x:number,y:number){camera.updateMatrixWorld();this.raycaster.far=Infinity;this.raycaster.setFromCamera(new THREE.Vector2(x,y),camera);}
 placement(camera:THREE.Camera,x:number,y:number){this.ray(camera,x,y);const hit=this.raycaster.intersectObjects(this.terrain?.solids||[],false)[0];return hit&&(hit.face?.normal.y||0)>.5?hit.point:null;}
 pickNpc(camera:THREE.Camera,x:number,y:number){this.ray(camera,x,y);let found='',distance=Infinity;for(const [id,n] of this.npcs){const hit=this.raycaster.intersectObject(n.root,true)[0];if(hit&&hit.distance<distance){distance=hit.distance;found=id;}}return found;}
 ghost(kind:string,point:THREE.Vector3|null){this.ghostNpc.root.visible=kind==='npc'&&!!point;this.ghostVolume.visible=kind==='volume'&&!!point;if(point){this.ghostNpc.root.position.copy(point);this.ghostVolume.position.copy(point).add(new THREE.Vector3(0,2.5,0));}}
 npcVisible(camera:THREE.Camera,anchor:THREE.Vector3){const direction=anchor.clone().sub(camera.position),distance=direction.length();this.raycaster.set(camera.position,direction.normalize());this.raycaster.far=Math.max(0,distance-.2);return !this.terrain||this.raycaster.intersectObjects(this.terrain.solids,false).length===0;}
 update(frame:any,_elapsed:number,_dt:number,_status:string,editing=false,actors?:any[],selected?:string){
  const p=frame.owner;this.player.root.visible=!editing;if(p){this.player.root.position.set(p.X/100,(p.Z-88)/100,p.Y/100);this.player.root.rotation.y=Math.PI/2-(frame.heading||0)*Math.PI/180;this.player.update(frame);this.owner.position.set(p.X/100,p.Z/100,p.Y/100);}
  const list=actors??(Array.isArray(frame.npcs)?frame.npcs:frame.subject?[{id:'guide',position:[frame.subject.X,frame.subject.Y,frame.subject.Z],heading:frame.subjectHeading??180}]:[]);
  const wanted=new Set(list.map(n=>n.id));for(const [id,n] of this.npcs)if(!wanted.has(id)){n.dispose();this.npcs.delete(id);}
  this.selectedBox.visible=false;
  for(const data of list){let n=this.npcs.get(data.id);if(!n){n=new BlockAvatar(true);this.npcs.set(data.id,n);this.scene.add(n.root);}n.root.position.set(data.position[0]/100,(data.position[2]-88)/100,data.position[1]/100);n.root.rotation.y=Math.PI/2-data.heading*Math.PI/180;n.update(editing?{}:frame);if(editing&&data.id===selected){n.root.updateMatrixWorld(true);this.selectedBox.box.setFromObject(n.root);this.selectedBox.visible=true;}}
  this.terrain?.update(editing?{...frame,owner:{X:0,Y:0},meshOpacity:{},time:0}:frame);
  if(editing&&this.scene.fog instanceof THREE.Fog){this.scene.fog.near=1000;this.scene.fog.far=2000;}
 }
 dispose(){this.disposed=true;this.terrain?.dispose();this.player.dispose();this.ghostNpc.dispose();for(const n of this.npcs.values())n.dispose();this.npcs.clear();this.ghostVolume.removeFromParent();this.ghostVolume.geometry.dispose();this.ghostVolume.material.dispose();this.selectedBox.removeFromParent();this.selectedBox.geometry.dispose();(this.selectedBox.material as THREE.Material).dispose();}
}
