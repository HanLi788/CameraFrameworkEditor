import * as THREE from 'three';
export const previewPostChannels=new Set(['ExposureCompensation','VignetteIntensity',...['Saturation','Contrast','Gamma','Gain','Offset'].flatMap(n=>['X','Y','Z','W'].map(c=>n+c)),...['R','G','B'].map(c=>'SceneColorTint'+c)]);
// Approximate WebGL display of final Lua subsystem values; no spatial mixing or JS accumulation.
export class GamePostProcessing {
 target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,samples:4});
 scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
 uniforms={image:{value:this.target.texture},exposure:{value:0},vignette:{value:0},saturation:{value:new THREE.Vector3(1,1,1)},contrast:{value:new THREE.Vector3(1,1,1)},gamma:{value:new THREE.Vector3(1,1,1)},gain:{value:new THREE.Vector3(1,1,1)},offset:{value:new THREE.Vector3()},tint:{value:new THREE.Vector3(1,1,1)}};
 material=new THREE.ShaderMaterial({uniforms:this.uniforms,vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:`varying vec2 vUv;uniform sampler2D image;uniform float exposure,vignette;uniform vec3 saturation,contrast,gamma,gain,offset,tint;
 void main(){vec3 c=texture2D(image,vUv).rgb*exp2(exposure);float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,saturation);c=max((c-.18)*contrast+.18,vec3(0.));c=pow(c,1./max(gamma,vec3(.01)))*gain+offset;c*=tint;float edge=smoothstep(.2,.75,length(vUv-.5));c*=1.-clamp(vignette,0.,1.)*edge;gl_FragColor=vec4(max(c,vec3(0.)),1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`});
 quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);
 constructor(){this.scene.add(this.quad);}
 render(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,values:any,w:number,h:number,area:{x:number,y:number,w:number,h:number}){
  const u=this.uniforms,v=(n:string,d:number)=>values[n]??d;u.exposure.value=v('ExposureCompensation',0);u.vignette.value=v('VignetteIntensity',0);
  for(const [key,name,d] of [['saturation','Saturation',1],['contrast','Contrast',1],['gamma','Gamma',1],['gain','Gain',1],['offset','Offset',0]] as const){const a=v(name+'W',d);u[key].value.set(...['X','Y','Z'].map(c=>key==='offset'?v(name+c,d)+a:v(name+c,d)*a) as [number,number,number]);}
  u.tint.value.set(v('SceneColorTintR',1),v('SceneColorTintG',1),v('SceneColorTintB',1));
  const neutral=u.exposure.value===0&&u.vignette.value===0&&['saturation','contrast','gamma','gain','tint'].every(k=>u[k].value.equals(new THREE.Vector3(1,1,1)))&&u.offset.value.lengthSq()===0;
  renderer.setRenderTarget(null);renderer.setScissorTest(false);renderer.setViewport(0,0,w,h);renderer.clear();
  if(!neutral){const pixel=renderer.getPixelRatio(),tw=Math.max(1,Math.round(area.w*pixel)),th=Math.max(1,Math.round(area.h*pixel));if(this.target.width!==tw||this.target.height!==th)this.target.setSize(tw,th);renderer.setRenderTarget(this.target);renderer.clear();renderer.render(scene,camera);renderer.setRenderTarget(null);}
  renderer.setViewport(area.x,area.y,area.w,area.h);renderer.setScissor(area.x,area.y,area.w,area.h);renderer.setScissorTest(true);renderer.render(neutral?scene:this.scene,neutral?camera:this.camera);
 }
 dispose(){this.target.dispose();this.material.dispose();this.quad.geometry.dispose();}
}
