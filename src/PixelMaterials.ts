import * as THREE from 'three';

// Original, deterministic pixel art; no downloaded textures or game assets.
export function pixelTexture(canvas:HTMLCanvasElement){
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  // Face atlases must not blend neighbouring tiles through generated mip levels.
  texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;
  return texture;
}
function noise(x:number,y:number,seed:number){let n=Math.imul(x+seed*131,374761393)^Math.imul(y+17,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
export function blockMaterial(kind:string,palette:{top:string;side:string}){
  const canvas=document.createElement('canvas');canvas.width=48;canvas.height=16;const ctx=canvas.getContext('2d')!;
  const grass=kind.startsWith('grass');
  for(let face=0;face<3;face++)for(let y=0;y<16;y++)for(let x=0;x<16;x++){
    const top=face===0,seed=kind.length*19+face*71;
    let base=top?palette.top:palette.side,shade=(noise(x,y,seed)-.5)*.27;
    if(grass&&face===1&&y<3+Math.floor(noise(x,0,8)*3))base=palette.top;
    if(kind==='trunk'){if(top){const ring=Math.max(Math.abs(x-7.5),Math.abs(y-7.5));shade+=(Math.floor(ring)%3===0?-.22:.09);}else shade+=(x%5===0?-.22:.04);}
    if(kind==='wood')shade+=(y%5===0?-.23:.04)+(x===((Math.floor(y/5)%2)*8)?-.12:0);
    if(kind==='stone')shade+=(x===0||y===0?-.12:0)+(noise(Math.floor(x/3),Math.floor(y/3),4)-.5)*.14;
    if(kind.toLowerCase().includes('leaf'))shade+=(noise(Math.floor(x/2),Math.floor(y/2),12)>.6?.12:-.10);
    const color=new THREE.Color(base).multiplyScalar(1+shade);ctx.fillStyle='#'+color.getHexString();ctx.fillRect(face*16+x,y,1,1);
  }
  const material=new THREE.MeshStandardMaterial({map:pixelTexture(canvas),roughness:1});
  // Project in metres so large instanced boxes retain one block per metre,
  // instead of stretching one tiny texture over an entire wall or ground tile.
  material.onBeforeCompile=shader=>{
    shader.uniforms.blockTop={value:new THREE.Color(palette.top)};shader.uniforms.blockSide={value:new THREE.Color(palette.side)};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vBlockPoint; varying vec3 vBlockNormal;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vBlockNormal=normal; vBlockPoint=position;
      #ifdef USE_INSTANCING
        vBlockPoint=(instanceMatrix*vec4(position,1.0)).xyz;
      #endif
      vBlockPoint=(modelMatrix*vec4(vBlockPoint,1.0)).xyz;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vBlockPoint; varying vec3 vBlockNormal; uniform vec3 blockTop; uniform vec3 blockSide;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec3 n=abs(vBlockNormal); vec2 blockUV;
      float face=1.0;
      if(n.y>0.5){blockUV=vBlockPoint.xz;face=vBlockNormal.y>0.0?0.0:2.0;}
      else if(n.x>n.z){blockUV=vBlockPoint.zy;}else{blockUV=vBlockPoint.xy;}
      vec2 pixel=floor(fract(blockUV)*16.0);
      vec2 footprint=fwidth(blockUV)*16.0;
      float detail=1.0-smoothstep(0.7,2.0,max(footprint.x,footprint.y));
      vec4 texel=texture2D(map,vec2((face*16.0+pixel.x+0.5)/48.0,(pixel.y+0.5)/16.0));
      diffuseColor*=vec4(mix(face<0.5?blockTop:blockSide,texel.rgb,detail),texel.a);
    `);
  };
  material.customProgramCacheKey=()=> 'pixel-block-v2';return material;
}

export function waterTexture(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=16;const ctx=canvas.getContext('2d')!;
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){const v=Math.floor(190+noise(Math.floor(x/2),y,9)*45);ctx.fillStyle=`rgb(${v},${v},255)`;ctx.fillRect(x,y,1,1);}
  const texture=pixelTexture(canvas);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(4,4);return texture;
}
