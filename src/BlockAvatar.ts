import * as THREE from 'three';
import {pixelTexture} from './PixelMaterials';

// Six original cuboid body parts. Feet at zero, head at 1.76 m, front is +Z.
export class BlockAvatar{
  root=new THREE.Group();private limbs:THREE.Group[]=[];private head:THREE.Mesh;
  constructor(private guide=false){
    const skin=guide?'#bd8a62':'#d2a17b',shirt=guide?'#b58a3e':'#347c83',pants=guide?'#4d5944':'#3b4f68';
    const part=(w:number,h:number,d:number,kind:string,color:string)=>{
      const canvas=document.createElement('canvas');canvas.width=96;canvas.height=16;const ctx=canvas.getContext('2d')!;
      for(let f=0;f<6;f++){
        const at=f*16;ctx.fillStyle=color;ctx.fillRect(at,0,16,16);
        for(let y=0;y<16;y++)for(let x=0;x<16;x++){ctx.fillStyle=(x*17+y*31+f*7)%11<5?'#ffffff0b':'#0000000b';ctx.fillRect(at+x,y,1,1);}
        if(kind==='head'){
          ctx.fillStyle=guide?'#60503c':'#40322b';ctx.fillRect(at,0,16,f===3?0:f===2||f===5?16:4);
          if(f===4){ctx.fillStyle='#eee5ce';ctx.fillRect(at+3,7,3,2);ctx.fillRect(at+10,7,3,2);ctx.fillStyle='#273b3d';ctx.fillRect(at+4,7,2,2);ctx.fillRect(at+10,7,2,2);ctx.fillStyle='#9a684e';ctx.fillRect(at+7,10,2,2);ctx.fillStyle='#664737';ctx.fillRect(at+6,13,4,1);
            if(guide){ctx.fillStyle='#d9c797';ctx.fillRect(at,3,16,2);ctx.fillStyle='#ddd6c4';ctx.fillRect(at+4,12,2,3);ctx.fillRect(at+10,12,2,3);}
          }
        }else if(kind==='arm'){ctx.fillStyle=skin;ctx.fillRect(at,9,16,7);}
        else if(kind==='leg'){ctx.fillStyle='#333332';ctx.fillRect(at,13,16,3);}
        else if(kind==='body'){
          ctx.fillStyle='#3b382c';ctx.fillRect(at,14,16,2);
          if(f===4){ctx.fillStyle=skin;ctx.fillRect(at+6,0,4,2);ctx.fillStyle=guide?'#e2c271':'#72b2b4';ctx.fillRect(at+7,3,2,10);if(guide){ctx.fillStyle='#445a48';ctx.fillRect(at+2,7,4,4);}}
        }
      }
      const geometry=new THREE.BoxGeometry(w,h,d),uv=geometry.getAttribute('uv');
      for(let f=0;f<6;f++)for(let i=0;i<4;i++)uv.setXY(f*4+i,(f+uv.getX(f*4+i))/6,uv.getY(f*4+i));
      geometry.clearGroups();const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map:pixelTexture(canvas),roughness:1}));mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
    };
    const body=part(.48,.64,.25,'body',shirt);body.position.y=.96;this.root.add(body);
    this.head=part(.48,.48,.48,'head',skin);this.head.position.y=1.52;this.root.add(this.head);
    for(let i=0;i<4;i++){
      const arm=i<2,pivot=new THREE.Group(),mesh=part(arm?.22:.23,.64,arm?.24:.25,arm?'arm':'leg',arm?shirt:pants);
      pivot.position.set((i%2===0?-1:1)*(arm?.35:.125),arm?1.28:.64,0);mesh.position.y=-.32;pivot.add(mesh);this.root.add(pivot);this.limbs.push(pivot);
    }
  }
  update(frame:any){
    const time=frame.time||0,speed=this.guide?0:frame.speed||0,walking=speed>1,airborne=!this.guide&&frame.mode==='game'&&frame.grounded===false;
    const stride=Math.sin(time*(speed>=350?13:8))*Math.min(.85,speed/420);
    for(let i=0;i<4;i++){const arm=i<2,side=i%2===0?1:-1;this.limbs[i].rotation.x=airborne?(arm?-.65:.25*side):walking?stride*side*(arm?1:-1):arm?Math.sin(time*1.4)*.025:0;this.limbs[i].rotation.z=arm?side*.025:0;}
    this.head.rotation.y=this.guide?Math.sin(time*.7)*.035:0;
  }
  dispose(){this.root.removeFromParent();this.root.traverse((o:any)=>{o.geometry?.dispose();if(o.material){o.material.map?.dispose();o.material.dispose();}});}
}
