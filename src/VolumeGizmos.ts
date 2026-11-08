import * as THREE from 'three';
export class VolumeGizmos {
 root=new THREE.Group();signature='';ray=new THREE.Raycaster();
 constructor(scene:THREE.Scene){scene.add(this.root);}
 clear(){while(this.root.children.length){const child=this.root.children[0] as any;child.geometry?.dispose();child.material?.dispose();this.root.remove(child);}}
 update(volumes:any[],selected:string,visible:boolean){
  this.root.visible=visible;const signature=JSON.stringify([volumes.map(({id,name,global,enabled,center,size,blend})=>({id,name,global,enabled,center,size,blend})),selected]);if(signature===this.signature)return;this.signature=signature;this.clear();
  for(const v of volumes.filter(v=>!v.global)){
   const box=new THREE.BoxGeometry(v.size[0]/100,v.size[2]/100,v.size[1]/100),edges=new THREE.EdgesGeometry(box);box.dispose();
   const line=new THREE.LineSegments(edges,new THREE.LineBasicMaterial({color:v.id===selected?0xffd27f:v.enabled?0x7ee0cb:0x707880,depthTest:false,transparent:true,opacity:.9}));line.position.set(v.center[0]/100,v.center[2]/100,v.center[1]/100);line.renderOrder=100;this.root.add(line);
   if(v.blend>0){const b=new THREE.BoxGeometry((v.size[0]+v.blend*2)/100,(v.size[2]+v.blend*2)/100,(v.size[1]+v.blend*2)/100),e=new THREE.EdgesGeometry(b);b.dispose();const blend=new THREE.LineSegments(e,new THREE.LineDashedMaterial({color:0x7ee0cb,transparent:true,opacity:.35,dashSize:.3,gapSize:.2,depthTest:false}));blend.computeLineDistances();blend.position.copy(line.position);this.root.add(blend);}
  }
 }
 select(volumes:any[],camera:THREE.Camera,x:number,y:number){this.ray.setFromCamera(new THREE.Vector2(x,y),camera);let nearest=Infinity,id='';for(const v of volumes.filter(v=>!v.global)){const center=new THREE.Vector3(v.center[0]/100,v.center[2]/100,v.center[1]/100),size=new THREE.Vector3(v.size[0]/100,v.size[2]/100,v.size[1]/100),hit=this.ray.ray.intersectBox(new THREE.Box3().setFromCenterAndSize(center,size),new THREE.Vector3());if(hit){const distance=hit.distanceTo(this.ray.ray.origin);if(distance<nearest){nearest=distance;id=v.id;}}}return id;}
 dispose(){this.clear();this.root.removeFromParent();}
}
