import * as THREE from 'three';
import {blockMaterial,waterTexture} from './PixelMaterials';
export type WorldBox={id:number;name:string;x:number;y:number;z:number;w:number;d:number;h:number;material:string;solid:boolean;shape:string};
export type WorldData={key:string;environment:string;seed:string;version:number;spawn:number[];target:number[];boxes:WorldBox[];water:{x:number;y:number;z:number;w:number;d:number;kind:string}[];palette:Record<string,{top:string;side:string}>;rampTriangles:number[];biomes:{kind:string;x:number;y:number;rx:number;ry:number}[];size:number};
type Instance={mesh:THREE.InstancedMesh;index:number;matrix:THREE.Matrix4};
export class ProceduralScene{
  root=new THREE.Group();solids:THREE.InstancedMesh[]=[];
  private instances=new Map<number,Instance>();private faded=new Map<number,THREE.Mesh>();private waters:THREE.Texture[]=[];
  private clearSky=new THREE.Color('#b9d8e7');private swampSky=new THREE.Color('#a4b5a6');
  constructor(public data:WorldData,private scene:THREE.Scene){
    const groups=new Map<string,WorldBox[]>();
    for(const box of data.boxes){const key=box.material+':'+box.shape+':'+box.solid;if(!groups.has(key))groups.set(key,[]);groups.get(key)!.push(box);}
    for(const boxes of groups.values()){
      const first=boxes[0],geometry=first.shape==='ramp'?this.ramp():new THREE.BoxGeometry(1,1,1);
      geometry.clearGroups();
      const material=blockMaterial(first.material,data.palette[first.material]);
      const mesh=new THREE.InstancedMesh(geometry,material,boxes.length);mesh.castShadow=!first.name.startsWith('terrain');mesh.receiveShadow=true;
      boxes.forEach((b,i)=>{const matrix=new THREE.Matrix4().compose(new THREE.Vector3(b.x,b.z+b.h/2,b.y),new THREE.Quaternion(),new THREE.Vector3(b.w,b.h,b.d));mesh.setMatrixAt(i,matrix);this.instances.set(b.id,{mesh,index:i,matrix});});
      mesh.computeBoundingSphere();mesh.instanceMatrix.needsUpdate=true;this.root.add(mesh);if(first.solid)this.solids.push(mesh);
    }
    for(const kind of ['lake','swamp']){
      const cells=data.water.filter(w=>w.kind===kind);if(!cells.length)continue;
      const map=waterTexture();this.waters.push(map);
      const material=new THREE.MeshStandardMaterial({map,color:kind==='lake'?'#61c6d6':'#7b8754',transparent:true,opacity:kind==='lake'?.62:.78,roughness:.32,metalness:.08,depthWrite:false,side:THREE.DoubleSide});
      const mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),material,cells.length);
      cells.forEach((w,i)=>mesh.setMatrixAt(i,new THREE.Matrix4().compose(new THREE.Vector3(w.x,w.z,w.y),new THREE.Quaternion(),new THREE.Vector3(w.w,1,w.d))));mesh.computeBoundingSphere();mesh.renderOrder=1;this.root.add(mesh);
    }
    scene.add(this.root);scene.background=this.clearSky.clone();scene.fog=new THREE.Fog(this.clearSky,40,110);
  }
  private ramp(){
    const values=this.data.rampTriangles,positions=[];
    // X/Y/Z -> Three X/Z/Y flips handedness, so reverse each triangle.
    for(let i=0;i<values.length;i+=9)for(const j of [0,6,3])positions.push(values[i+j],values[i+j+2],values[i+j+1]);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;
  }
  update(frame:any){
    const active=new Set<number>();
    for(const [key,value] of Object.entries(frame.meshOpacity||{})){
      const id=Number(key),opacity=value as number,instance=this.instances.get(id);if(!instance||opacity>=.999)continue;active.add(id);
      let fade=this.faded.get(id);
      if(!fade){const source=instance.mesh.material as THREE.MeshStandardMaterial,material=source.clone();material.onBeforeCompile=source.onBeforeCompile;material.customProgramCacheKey=source.customProgramCacheKey;material.transparent=true;material.depthWrite=false;fade=new THREE.Mesh(instance.mesh.geometry,material);fade.matrixAutoUpdate=false;fade.matrix.copy(instance.matrix);fade.receiveShadow=true;this.root.add(fade);this.faded.set(id,fade);instance.mesh.setMatrixAt(instance.index,new THREE.Matrix4().makeScale(0,0,0));instance.mesh.instanceMatrix.needsUpdate=true;}
      (fade.material as THREE.Material).opacity=opacity;
    }
    for(const [id,fade] of this.faded)if(!active.has(id)){const instance=this.instances.get(id)!;instance.mesh.setMatrixAt(instance.index,instance.matrix);instance.mesh.instanceMatrix.needsUpdate=true;fade.removeFromParent();(fade.material as THREE.Material).dispose();this.faded.delete(id);}
    for(const texture of this.waters)texture.offset.set((frame.time||0)*.012,(frame.time||0)*.006);
    const swamp=this.data.biomes.find(b=>b.kind==='swamp')!,p=frame.owner||{X:0,Y:0};
    const distance=Math.hypot((p.X/100-swamp.x)/swamp.rx,(p.Y/100-swamp.y)/swamp.ry),weight=THREE.MathUtils.smoothstep(1.8-distance,0,1);
    const color=this.clearSky.clone().lerp(this.swampSky,weight);(this.scene.background as THREE.Color).copy(color);
    if(this.scene.fog instanceof THREE.Fog){this.scene.fog.color.copy(color);this.scene.fog.near=40-24*weight;this.scene.fog.far=110-55*weight;}
  }
  dispose(){
    this.root.removeFromParent();for(const fade of this.faded.values()){fade.removeFromParent();(fade.material as THREE.Material).dispose();}this.faded.clear();
    this.root.traverse((o:any)=>{o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();});this.waters=[];this.instances.clear();
  }
}
