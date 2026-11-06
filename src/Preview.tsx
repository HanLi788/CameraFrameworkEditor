import Icon,{IconButton} from './Icon';
import {useEffect,useMemo,useRef,useState} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {Asset} from './types';
const channelNames=['AnchorLocOffset.X','AnchorLocOffset.Y','AnchorLocOffset.Z','Yaw','Pitch','Roll','Dist','FOV','AspectRatio','OrthoWidth','OrthoNearClipPlane','OrthoFarClipPlane'];
const phaseNames:any={Idle:'闲置',Entering:'进入',Holding:'停留',Exiting:'退出'};
const vec=(v:any)=>new THREE.Vector3(v.X/100,v.Z/100,v.Y/100);
function initialFrame(assets:Asset[]){
  const d=assets.find(a=>a.id==='Rig.IdleCamera.Default')?.data?.Defaults;if(!d)return null;
  const values:any={...d,'AnchorLocOffset.X':d.AnchorLocOffset[0],'AnchorLocOffset.Y':d.AnchorLocOffset[1],'AnchorLocOffset.Z':d.AnchorLocOffset[2]};delete values.AnchorLocOffset;
  const p=THREE.MathUtils.degToRad(d.Pitch),y=THREE.MathUtils.degToRad(d.Yaw),r=THREE.MathUtils.degToRad(d.Roll);
  const forward={X:Math.cos(p)*Math.cos(y),Y:Math.cos(p)*Math.sin(y),Z:Math.sin(p)};
  const up={X:-(Math.cos(r)*Math.sin(p)*Math.cos(y)+Math.sin(r)*Math.sin(y)),Y:Math.cos(y)*Math.sin(r)-Math.cos(r)*Math.sin(p)*Math.sin(y),Z:Math.cos(r)*Math.cos(p)};
  return {time:0,hold:0,phase:'Idle',target:values,render:values,output:values,location:{X:d.AnchorLocOffset[0]-forward.X*d.Dist,Y:d.AnchorLocOffset[1]-forward.Y*d.Dist,Z:88+d.AnchorLocOffset[2]-forward.Z*d.Dist},forward,up,projection:'Perspective',subject:{X:250,Y:0,Z:88},obstacle:false};
}
export default function Preview({rig,assets,simulation,onCommand,disabled}:{disabled?:boolean;rig:Asset|undefined;assets:Asset[];simulation:any;onCommand:any}){
  const mount=useRef<HTMLDivElement>(null),sceneRef=useRef<any>(null),latest=useRef<any>(null);
  const [view,setView]=useState('camera'),[error,setError]=useState(''),[channels,setChannels]=useState(false),[speed,setSpeed]=useState(0),[obstacle,setObstacle]=useState(false),[selected,setSelected]=useState('');
  const status=simulation?.status||'stopped';const frame=simulation?.frame||initialFrame(assets);latest.current={frame,view};
  const transition=useMemo(()=>{const ids:any[]=[];const walk=(v:any)=>{if(!v||typeof v!=='object')return;if(v.Phase==='Enter'&&v.AssetId)ids.push(v.AssetId);for(const x of Object.values(v))if(x&&typeof x==='object')walk(x);};walk(rig?.data?.Processors?.Input);return assets.find(a=>a.id===ids[0]);},[rig,assets]);
  const slots=transition?.data?.ValueAssets||[];
  useEffect(()=>setSelected(''),[rig?.id]);
  const options=()=>({speed,obstacle,...(selected&&slots[Number(selected)]?.Id!==undefined?{id:slots[Number(selected)].Id}:{})});
  useEffect(()=>{
    const el=mount.current;if(!el)return;let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true});}catch(e){setError('无法创建 3D 视口：'+e.message);return;}
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor('#20252c');el.appendChild(renderer.domElement);
    const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#e1efff','#4b4f49',2.5));const light=new THREE.DirectionalLight('#fff0d4',3);light.position.set(4,9,6);scene.add(light);
    const observer=new THREE.PerspectiveCamera(45,1,.01,2000);observer.position.set(9,7,11);
    const perspective=new THREE.PerspectiveCamera(60,16/9,.01,10000),orthographic=new THREE.OrthographicCamera(-2,2,2,-2,-10000,10000);
    const controls=new OrbitControls(observer,renderer.domElement);controls.target.set(0,.88,0);controls.enableDamping=true;
    scene.add(new THREE.GridHelper(100,100,'#55616a','#333d45'));
    const owner=new THREE.Mesh(new THREE.CapsuleGeometry(.34,1.08,8,16),new THREE.MeshStandardMaterial({color:'#85a5ad',roughness:.7}));owner.position.y=.88;scene.add(owner);
    const subject=new THREE.Mesh(new THREE.CapsuleGeometry(.34,1.08,8,16),new THREE.MeshStandardMaterial({color:'#b7a47d',roughness:.7}));scene.add(subject);
    const wall=new THREE.Mesh(new THREE.BoxGeometry(.7,2,1.6),new THREE.MeshStandardMaterial({color:'#596a7b',roughness:.9,transparent:true}));wall.position.set(-1.8,1,0);scene.add(wall);
    const body=new THREE.Mesh(new THREE.BoxGeometry(.35,.23,.4),new THREE.MeshStandardMaterial({color:'#dcb57c'}));scene.add(body);
    let camera:THREE.PerspectiveCamera|THREE.OrthographicCamera=perspective;let helper=new THREE.CameraHelper(camera);scene.add(helper);
    sceneRef.current={observer,controls};
    const resize=()=>{const w=el.clientWidth,h=el.clientHeight;if(w&&h){renderer.setSize(w,h);observer.aspect=w/h;observer.updateProjectionMatrix();}};const ro=new ResizeObserver(resize);ro.observe(el);resize();
    renderer.setAnimationLoop(()=>{
      const f=latest.current?.frame;if(!f)return;const mode=latest.current.view,v=f.output;
      const wanted=f.projection==='Orthographic'?orthographic:perspective;if(wanted!==camera){scene.remove(helper);helper.dispose();camera=wanted;helper=new THREE.CameraHelper(camera);scene.add(helper);}
      const aspect=v.AspectRatio;perspective.aspect=aspect;perspective.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(v.FOV)/2)/aspect));perspective.updateProjectionMatrix();
      orthographic.left=-v.OrthoWidth/200;orthographic.right=v.OrthoWidth/200;orthographic.top=v.OrthoWidth/(200*aspect);orthographic.bottom=-orthographic.top;orthographic.near=v.OrthoNearClipPlane/100;orthographic.far=v.OrthoFarClipPlane/100;orthographic.updateProjectionMatrix();
      camera.position.copy(vec(f.location));camera.up.copy(vec(f.up).normalize());camera.lookAt(camera.position.clone().add(vec(f.forward).normalize()));camera.updateMatrixWorld();helper.update();body.position.copy(camera.position);body.quaternion.copy(camera.quaternion);
      subject.position.copy(vec(f.subject));wall.visible=f.obstacle===true;wall.material.opacity=f.obstacleOpacity??1;controls.enabled=mode==='orbit';controls.update();helper.visible=body.visible=mode==='orbit';
      const w=el.clientWidth,h=el.clientHeight;renderer.setScissorTest(false);renderer.setViewport(0,0,w,h);renderer.clear();if(mode==='camera'){const cw=Math.min(w,h*aspect),ch=cw/aspect;renderer.setViewport((w-cw)/2,(h-ch)/2,cw,ch);renderer.setScissor((w-cw)/2,(h-ch)/2,cw,ch);renderer.setScissorTest(true);}
      renderer.render(scene,mode==='camera'?camera:observer);
    });
    return()=>{renderer.setAnimationLoop(null);ro.disconnect();controls.dispose();scene.traverse((o:any)=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach((m:any)=>m.dispose());else o.material?.dispose();});renderer.dispose();el.removeChild(renderer.domElement);sceneRef.current=null;};
  },[]);
  return <div className="preview" data-simulation-status={status} data-simulation-phase={frame?.phase||'Idle'}>
    <div className="simulation-toolbar"><IconButton icon="play" label={status==='paused'?'继续模拟':'播放模拟'} disabled={disabled||!rig||status==='loading'||status==='running'} onClick={()=>onCommand(status==='paused'?'resume':'start',options())}/><IconButton icon="pause" label="暂停模拟" disabled={status!=='running'} onClick={()=>onCommand('pause')}/><IconButton icon="stop" label="停止模拟" disabled={status==='stopped'} onClick={()=>onCommand('stop')}/><IconButton icon="reset" label="重新播放" disabled={disabled||!rig||status==='loading'} onClick={()=>onCommand('start',options())}/><span className="simulation-phase">{status==='loading'?'准备运行…':status==='error'?'运行失败':status==='paused'?'已暂停':status==='stopped'?'已停止':phaseNames[frame?.phase]} · <span data-simulation-time>{(frame?.time||0).toFixed(2)}</span>s{frame?.phase==='Holding'&&` · 停留 ${frame.hold.toFixed(2)} / 2.00s`}</span><div className="spacer"/><button aria-pressed={channels} onClick={()=>setChannels(v=>!v)}>12 通道</button></div>
    <div className="simulation-options"><label>速度 <input aria-label="模拟速度" type="number" value={speed} onChange={e=>setSpeed(Number(e.target.value))}/> cm/s</label><label><input type="checkbox" checked={obstacle} onChange={e=>setObstacle(e.target.checked)}/>遮挡物</label>{slots.length>1&&<select aria-label="模拟目标 ID" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">默认（第一槽）</option>{slots.map((slot:any,i:number)=>slot.Id!==undefined&&<option key={i} value={String(i)}>{typeof slot.Id==='number'?'整数':'字符串'}：{slot.Id}</option>)}</select>}<small>播放时读取当前资产草稿；修改后重新播放生效</small></div>
    <div className="simulation-viewport"><div className="viewport-toolbar"><div className="segmented"><button className={view==='orbit'?'active':''} onClick={()=>setView('orbit')}>自由观察</button><button className={view==='camera'?'active':''} onClick={()=>setView('camera')}>相机画面</button></div><button onClick={()=>{const s=sceneRef.current;if(s){s.observer.position.set(9,7,11);s.controls.target.set(0,.88,0);}}}><Icon name="reset"/>重置观察</button></div><div ref={mount} className="canvas-host"/>{(error||simulation?.error)&&<div className="viewport-note simulation-error">{error||simulation.error}</div>}{channels&&frame&&<div className="channel-monitor"><table><thead><tr><th>通道</th><th>目标</th><th>渲染</th><th>输出</th></tr></thead><tbody>{channelNames.map(name=><tr key={name} data-channel={name}><td>{name}</td>{['target','render','output'].map(k=><td key={k}>{frame[k][name].toFixed(2)}</td>)}</tr>)}</tbody></table></div>}</div>
    <div className="simulation-note">真实 Lua 管线 · 进入完成后停留 2 秒再退出 · 预览世界提供角色与碰撞，UE 后处理画面需在引擎确认</div>
  </div>;
}
