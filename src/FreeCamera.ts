import * as THREE from 'three';
export class FreeCamera {
 keys=new Set<string>();speed=8;
 constructor(public camera:THREE.PerspectiveCamera){}
 clear(){this.keys.clear();}
 look(x:number,y:number,sensitivity:number){const r=new THREE.Euler().setFromQuaternion(this.camera.quaternion,'YXZ');r.y-=x*.003*sensitivity;r.x=THREE.MathUtils.clamp(r.x-y*.003*sensitivity,-Math.PI*.495,Math.PI*.495);r.z=0;this.camera.quaternion.setFromEuler(r);}
 update(dt:number){
  this.camera.updateMatrix();const forward=this.camera.getWorldDirection(new THREE.Vector3()),right=new THREE.Vector3().setFromMatrixColumn(this.camera.matrix,0);
  const n=(a:string,b:string)=>Number(this.keys.has(a))-Number(this.keys.has(b));
  const direction=forward.multiplyScalar(n('KeyW','KeyS')).addScaledVector(right,n('KeyD','KeyA')).add(new THREE.Vector3(0,n('KeyE','KeyQ'),0));
  if(direction.lengthSq())this.camera.position.addScaledVector(direction.normalize(),Math.min(dt,.05)*this.speed*(this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')?3:1));
 }
}
