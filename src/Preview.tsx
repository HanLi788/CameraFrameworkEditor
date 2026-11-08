import {GamePostProcessing} from './GamePostProcessing';
import SceneInspector from './SceneInspector';
import SceneDirectory from './SceneDirectory';
import HelpTip from './HelpTip';
import {t} from './i18n';
import Icon,{IconButton} from './Icon';
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {Asset} from './types';
const api=window.cameraEditor;
import {PreviewWorld,presets,Environment} from './PreviewWorld';
const channelNames=['AnchorLocOffset.X','AnchorLocOffset.Y','AnchorLocOffset.Z','Yaw','Pitch','Roll','Dist','FOV','AspectRatio','OrthoWidth','OrthoNearClipPlane','OrthoFarClipPlane'];
const phaseNames:any={Idle:'闲置',Entering:'进入',Holding:'停留',Exiting:'退出'};
const vec=(v:any)=>new THREE.Vector3(v.X/100,v.Z/100,v.Y/100);
function initialFrame(assets:Asset[],environment:Environment){
  const preset=presets[environment],offset={X:preset.spawn[0],Y:preset.spawn[1],Z:preset.spawn[2]-88};
  const d=assets.find(a=>a.path==='Assets/CameraAssets/IdleCamera/Player/Default/Default.rig')?.data?.Defaults||{AnchorLocOffset:[0,0,0],Yaw:0,Pitch:0,Roll:0,Dist:400,FOV:90,AspectRatio:16/9,OrthoWidth:512,OrthoNearClipPlane:0,OrthoFarClipPlane:200000};
  const values:any={...d,'AnchorLocOffset.X':d.AnchorLocOffset[0],'AnchorLocOffset.Y':d.AnchorLocOffset[1],'AnchorLocOffset.Z':d.AnchorLocOffset[2]};delete values.AnchorLocOffset;
  const p=THREE.MathUtils.degToRad(d.Pitch),y=THREE.MathUtils.degToRad(d.Yaw),r=THREE.MathUtils.degToRad(d.Roll);
  const forward={X:Math.cos(p)*Math.cos(y),Y:Math.cos(p)*Math.sin(y),Z:Math.sin(p)};
  const up={X:-(Math.cos(r)*Math.sin(p)*Math.cos(y)+Math.sin(r)*Math.sin(y)),Y:Math.cos(y)*Math.sin(r)-Math.cos(r)*Math.sin(p)*Math.sin(y),Z:Math.cos(r)*Math.cos(p)};
  return {time:0,hold:0,phase:'Idle',environment,owner:{X:preset.spawn[0],Y:preset.spawn[1],Z:preset.spawn[2]},heading:0,speed:0,motion:'idle',target:values,render:values,output:values,location:{X:offset.X+d.AnchorLocOffset[0]-forward.X*d.Dist,Y:offset.Y+d.AnchorLocOffset[1]-forward.Y*d.Dist,Z:offset.Z+88+d.AnchorLocOffset[2]-forward.Z*d.Dist},forward,up,projection:'Perspective',subject:environment==='lab'?{X:preset.target[0],Y:preset.target[1],Z:preset.target[2]}:null,obstacle:false};
}
export default function Preview({assets,simulation,onCommand,world,attract,launchSignal,onExit,onSettings,settings,catalog}:any){
  const mount=useRef<HTMLDivElement>(null),sceneRef=useRef<any>(null),latest=useRef<any>(null);
  const [debug,setDebug]=useState(false),[group,setGroup]=useState('Exposure'),[overrides,setOverrides]=useState<Record<string,number>>({});
  const npcs=world.npcs||[];
  const toggleDebug=()=>{if(!['running','paused'].includes(status)||frame?.dialogue||frame?.dialogueClosing)return;clearInput();setDebug(value=>!value);setOverrides({});setChannels(false);};
  const layout=useRef<HTMLDivElement>(null);
  const [split,setSplit]=useState(()=>{try{return JSON.parse(localStorage.getItem('post-debug-split')||'null')||{left:18,right:30};}catch{return {left:18,right:30};}});
  const splitter=(side:string)=>(e:React.PointerEvent)=>{e.currentTarget.setPointerCapture(e.pointerId);};
  const resizeSplit=(side:string)=>(e:React.PointerEvent)=>{if(!e.currentTarget.hasPointerCapture(e.pointerId))return;const r=layout.current!.getBoundingClientRect(),percent=side==='left'?(e.clientX-r.left)/r.width*100:(r.right-e.clientX)/r.width*100;setSplit(old=>{const value={...old,[side]:Math.max(side==='left'?15:23,Math.min(side==='left'?30:42,percent))};localStorage.setItem('post-debug-split',JSON.stringify(value));return value;});};
  const [error,setError]=useState(''),[channels,setChannels]=useState(false);
  const environment:Environment=world.environment,seed=world.seed,character='block',mapCollision=true;
  const [resourceState,setResourceState]=useState('loading'),[resourceError,setResourceError]=useState(''),[retry,setRetry]=useState(0),[launching,setLaunching]=useState(false),[stage,setStage]=useState(''),[launchError,setLaunchError]=useState(''),[readyWorldKey,setReadyWorldKey]=useState('');
  const launchId=useRef(0),launchActive=useRef(false);
  const viewport=useRef<HTMLDivElement>(null),bubble=useRef<HTMLButtonElement>(null),dialoguePanel=useRef<HTMLElement>(null),drag=useRef(false);
  const command=useRef(onCommand);command.current=onCommand;
  const performanceRef=useRef<HTMLSpanElement>(null);
  const status=launching?'loading':simulation?.status||'stopped';const worldKey=`1:${environment}:${environment==='lab'?'camera-lab':seed}`;const frame=simulation?.frame?.worldKey===worldKey?simulation.frame:initialFrame([],environment);latest.current={frame:attract?initialFrame([],environment):frame,view:attract?'orbit':'camera',status,attract,settings,catalog,npcs,postProcessing:{...frame.postProcessing,...(debug?overrides:{})}};

  const mouse=useRef({x:0,y:0,raf:0});
  const flushMouse=()=>{const m=mouse.current;cancelAnimationFrame(m.raf);m.raf=0;if(m.x||m.y){command.current('input',{signals:[{kind:'changed',name:'MouseX',value:m.x},{kind:'changed',name:'MouseY',value:m.y}]});m.x=0;m.y=0;}};
  const queueMouse=(x:number,y:number)=>{const m=mouse.current;m.x+=x;m.y+=y;if(!m.raf)m.raf=requestAnimationFrame(flushMouse);};
  const clearInput=()=>{cancelAnimationFrame(mouse.current.raf);mouse.current={x:0,y:0,raf:0};drag.current=false;command.current('input',{clear:true});};
  const options=()=>({mode:'game',environment,seed,version:1,mapCollision});

  const exitToMenu=()=>{setDebug(false);setOverrides({});launchId.current++;launchActive.current=false;setLaunching(false);setLaunchError('');clearInput();onExit();};
  const cancelLaunch=exitToMenu;
  const startGame=async(shouldResume=true)=>{
    setDebug(false);setOverrides({});

    if(launchActive.current)return;const id=++launchId.current;launchActive.current=true;setLaunching(true);setLaunchError('');clearInput();setStage('正在生成地图…');const started=performance.now();
    const minimum=()=>new Promise(resolve=>setTimeout(resolve,Math.max(0,1000-(performance.now()-started))));
    try{
      const data=await api.scene(options());if(id!==launchId.current)return;setStage('正在准备模型与材质…');
      const scene=sceneRef.current;if(!scene)throw Error('视口尚未准备好');await scene.world.prepare(data,character);if(id!==launchId.current)return;
      await scene.renderer.compileAsync(scene.scene,scene.observer);if(id!==launchId.current)return;setStage('正在校验配置并初始化 Lua…');
      const prepared=await api.simulate('prepare',options());if(id!==launchId.current)return;if(prepared.status!=='paused')throw Error('运行准备已取消');
      setStage('准备完成');await minimum();if(id!==launchId.current)return;
      if(shouldResume)await api.simulate('resume');if(id!==launchId.current)return;setLaunching(false);launchActive.current=false;
    }catch(e){await minimum();if(id!==launchId.current)return;setLaunchError(String(e.message||e));setLaunching(false);launchActive.current=false;}
  };
  useEffect(()=>()=>{launchId.current++;launchActive.current=false;},[]);
  useEffect(()=>{if(launchSignal)startGame();},[launchSignal]);
  useEffect(()=>{if(attract){setDebug(false);setOverrides({});launchId.current++;launchActive.current=false;setLaunching(false);setLaunchError('');}},[attract]);
  const signal=(kind:string,name:string,value?:number)=>{flushMouse();command.current('input',{signals:[{kind,name,value}]});};
  const closeDialogue=()=>{clearInput();command.current('input',{action:'close-dialogue'});viewport.current?.focus({preventScroll:true});};
  useEffect(()=>{const blur=()=>clearInput();const hidden=()=>{if(document.hidden){clearInput();if(latest.current?.status==='running')command.current('pause');}};window.addEventListener('blur',blur);document.addEventListener('visibilitychange',hidden);return()=>{window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',hidden);clearInput();};},[]);
  useEffect(()=>{clearInput();},[status,debug]);
  useEffect(()=>{if(frame?.dialogue){clearInput();dialoguePanel.current?.focus({preventScroll:true});}},[frame?.dialogue]);
  useEffect(()=>{if(status==='running'&&!frame?.dialogue)viewport.current?.focus({preventScroll:true});},[status]);
  const key=(e:React.KeyboardEvent,down:boolean)=>{
    if(e.code==='F8'){e.preventDefault();if(down&&!e.repeat)toggleDebug();return;}
    if(e.key==='Escape'){if(!down)return;clearInput();e.preventDefault();if(frame?.dialogue)closeDialogue();else if(status==='running')onCommand('pause');else if(status==='paused')onCommand('resume');return;}
    if(frame?.dialogue){if(e.code==='Space'&&(e.target as HTMLElement).tagName!=='BUTTON')e.preventDefault();return;}
    if(e.target!==viewport.current||status!=='running'||frame?.dialogue)return;
    const names:Record<string,string>={Space:'SpaceBar',ShiftLeft:'LeftShift',ShiftRight:'RightShift',ControlLeft:'LeftControl',ControlRight:'RightControl',AltLeft:'LeftAlt',AltRight:'RightAlt',ArrowUp:'Up',ArrowDown:'Down',ArrowLeft:'Left',ArrowRight:'Right',Digit0:'Zero',Digit1:'One',Digit2:'Two',Digit3:'Three',Digit4:'Four',Digit5:'Five',Digit6:'Six',Digit7:'Seven',Digit8:'Eight',Digit9:'Nine'};
    const name=names[e.code]||(/^Key[A-Z]$/.test(e.code)?e.code.slice(3):e.code);
    if(/^[A-Za-z][A-Za-z0-9]*$/.test(name)){e.preventDefault();if(!e.repeat)signal(down?'pressed':'released',name);}

  };
  useEffect(()=>{
    const el=mount.current;if(!el)return;let renderer:THREE.WebGLRenderer;
    try{renderer=new THREE.WebGLRenderer({antialias:true});}catch(e){setError(t('无法创建 3D 视口：')+e.message);return;}
    renderer.info.autoReset=false;renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.setClearColor('#20252c');el.appendChild(renderer.domElement);
    const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#e1efff','#4b4f49',2.5));const light=new THREE.DirectionalLight('#fff0d4',3);light.position.set(-18,35,-22);light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-48,right:48,top:48,bottom:-48,near:.5,far:110});light.shadow.bias=-.0003;light.shadow.normalBias=.04;scene.add(light);
    const observer=new THREE.PerspectiveCamera(45,1,.01,2000);observer.position.set(9,7,11);
    const perspective=new THREE.PerspectiveCamera(60,16/9,.01,10000),orthographic=new THREE.OrthographicCamera(-2,2,2,-2,-10000,10000);
    observer.lookAt(0,.88,0);
    const grid=new THREE.GridHelper(100,100,'#55616a','#333d45');scene.add(grid);
    const owner=new THREE.Mesh(new THREE.CapsuleGeometry(.34,1.08,8,16),new THREE.MeshStandardMaterial({color:'#85a5ad',roughness:.7}));owner.position.y=.88;scene.add(owner);
    const subject=new THREE.Mesh(new THREE.CapsuleGeometry(.34,1.08,8,16),new THREE.MeshStandardMaterial({color:'#b7a47d',roughness:.7}));scene.add(subject);
    const wall=new THREE.Mesh(new THREE.BoxGeometry(.7,2,1.6),new THREE.MeshStandardMaterial({color:'#596a7b',roughness:.9,transparent:true}));wall.position.set(-1.8,1,0);scene.add(wall);
    const body=new THREE.Mesh(new THREE.BoxGeometry(.35,.23,.4),new THREE.MeshStandardMaterial({color:'#dcb57c'}));scene.add(body);
    let camera:THREE.PerspectiveCamera|THREE.OrthographicCamera=perspective;let helper=new THREE.CameraHelper(camera);scene.add(helper);
    const world=new PreviewWorld(scene,owner,subject,grid),post=new GamePostProcessing();sceneRef.current={observer,world,renderer,scene,light};
    let previous=performance.now(),rendered=previous,count=0,stamp=previous,infoStamp=0;
    const resize=()=>{const w=el.clientWidth,h=el.clientHeight;if(w&&h){renderer.setSize(w,h);observer.aspect=w/h;observer.updateProjectionMatrix();}};const ro=new ResizeObserver(resize);ro.observe(el);resize();
    renderer.setAnimationLoop(()=>{
      const now=performance.now(),interval=1000/(latest.current?.attract?30:latest.current?.settings?.fps||60);
      if(document.hidden||now-previous<interval)return;previous=now-(now-previous)%interval;const dt=(now-rendered)/1000;rendered=now;
      const f=latest.current?.frame;if(!f)return;const mode=latest.current.view,v=f.output;
      const wanted=f.projection==='Orthographic'?orthographic:perspective;if(wanted!==camera){scene.remove(helper);helper.dispose();camera=wanted;helper=new THREE.CameraHelper(camera);scene.add(helper);}
      const aspect=v.AspectRatio;perspective.aspect=aspect;perspective.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(v.FOV)/2)/aspect));perspective.updateProjectionMatrix();
      orthographic.left=-v.OrthoWidth/200;orthographic.right=v.OrthoWidth/200;orthographic.top=v.OrthoWidth/(200*aspect);orthographic.bottom=-orthographic.top;orthographic.near=v.OrthoNearClipPlane/100;orthographic.far=v.OrthoFarClipPlane/100;orthographic.updateProjectionMatrix();
      camera.position.copy(vec(f.location));camera.up.copy(vec(f.up).normalize());camera.lookAt(camera.position.clone().add(vec(f.forward).normalize()));camera.updateMatrixWorld();helper.update();body.position.copy(camera.position);body.quaternion.copy(camera.quaternion);
      if(f.subject)subject.position.copy(vec(f.subject));wall.visible=f.obstacle===true;wall.material.opacity=f.obstacleOpacity??1;if(latest.current.attract){const angle=now*.000025;observer.position.set(16+Math.cos(angle)*38,23,Math.sin(angle)*38);observer.lookAt(16,0,0);}helper.visible=false;body.visible=false;
      world.update(f,now/1000,dt,latest.current.status,false,latest.current.attract?latest.current.npcs:undefined);
      const w=el.clientWidth,h=el.clientHeight,activeCamera=mode==='camera'?camera:observer;
      const position=[activeCamera.position.x*100,activeCamera.position.z*100,activeCamera.position.y*100];
      const result={values:latest.current.attract?{}:latest.current.postProcessing,errors:[],active:[]};
      const cw=mode==='camera'?Math.min(w,h*aspect):w,ch=mode==='camera'?cw/aspect:h;
      renderer.info.reset();post.render(renderer,scene,activeCamera,result.errors.length?{}:result.values,w,h,{x:(w-cw)/2,y:(h-ch)/2,w:cw,h:ch});
      el.dataset.observerPosition=JSON.stringify(position);el.dataset.postValues=JSON.stringify(result.values);el.dataset.postActive=JSON.stringify(result.active);el.dataset.sceneActors=JSON.stringify(latest.current.npcs);el.dataset.observerDirection=JSON.stringify(activeCamera.getWorldDirection(new THREE.Vector3()).toArray());
      const button=bubble.current;
      if(button&&!f.subject)button.hidden=true;
      if(button&&f.subject){const activeCamera=mode==='camera'?camera:observer,anchor=vec(f.subject).add(new THREE.Vector3(0,1.22,0)),projected=anchor.clone().project(activeCamera);
        const cw=mode==='camera'?Math.min(w,h*aspect):w,ch=mode==='camera'?cw/aspect:h;
        button.hidden=!(latest.current.status==='running'&&f.canTalk&&!f.dialogue&&mode==='camera'&&Math.abs(projected.x)<.94&&Math.abs(projected.y)<.94&&projected.z>-1&&projected.z<1&&world.npcVisible(activeCamera,anchor));
        if(!button.hidden){button.style.left=`${(w-cw)/2+(projected.x+1)*cw/2}px`;button.style.top=`${(h-ch)/2+(1-projected.y)*ch/2}px`;}
      }
      count++;if(now-stamp>=1000){if(performanceRef.current)performanceRef.current.textContent=`${Math.round(count*1000/(now-stamp))} FPS · ${renderer.info.render.calls} draws · ${(renderer.info.render.triangles/1000).toFixed(1)}k △`;stamp=now;count=0;}
    });
    return()=>{renderer.setAnimationLoop(null);ro.disconnect();post.dispose();world.dispose();scene.traverse((o:any)=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach((m:any)=>m.dispose());else o.material?.dispose();});renderer.dispose();el.removeChild(renderer.domElement);sceneRef.current=null;};
  },[]);
  useEffect(()=>{const s=sceneRef.current;if(!s)return;const quality=settings.quality;s.renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='low'?1:quality==='high'?2:1.5));s.renderer.shadowMap.enabled=quality!=='low';const size=quality==='high'?2048:1024;s.light.shadow.mapSize.set(size,size);s.light.shadow.map?.dispose();s.light.shadow.map=null;},[settings.quality]);
  useEffect(()=>{let cancelled=false;setResourceState('loading');setReadyWorldKey('');setResourceError('');const s=sceneRef.current;if(!s)return;
    api.scene({environment,seed,version:1}).then(data=>{if(!cancelled)return s.world.prepare(data,character);}).then(()=>{if(!cancelled){setResourceState('ready');setReadyWorldKey(worldKey);}}).catch(e=>{if(!cancelled){setResourceState('error');setResourceError(String(e.message||e));}});
    const p=presets[environment].spawn;s.observer.position.set(p[0]/100-14,p[2]/100+24,p[1]/100+34);s.observer.lookAt(p[0]/100+16,p[2]/100,p[1]/100);
    return()=>{cancelled=true;};
  },[environment,seed,character,retry]);
  return <div className={"preview "+(debug?'scene-editing ':'')+(attract?"attract-preview":"")} data-camera-mode="camera" data-post-debug={debug} data-preview-resources={resourceState} data-ready-world={readyWorldKey} data-world-key={worldKey} data-preview-environment={environment} data-simulation-status={status} data-simulation-phase={frame?.phase||'Idle'}>
    {!attract&&<div className="preview-presets"><button onClick={cancelLaunch}><Icon name="home"/>{t('返回主菜单')}</button>{['running','paused'].includes(status)&&<IconButton icon={status==='paused'?'play':'pause'} label={status==='paused'?t('继续游戏'):t('暂停游戏')} onClick={()=>{clearInput();onCommand(status==='paused'?'resume':'pause');}}/>}<button onClick={()=>{clearInput();onSettings();}} disabled={!['running','paused'].includes(status)}>{t('游戏设置')}</button><button aria-pressed={debug} disabled={!['running','paused'].includes(status)||!!frame?.dialogue||!!frame?.dialogueClosing} onClick={toggleDebug}><Icon name="post-palette"/>{t(debug?'退出后处理调试':'后处理调试')}</button><span>{world.builtin?t('默认实验场'):world.name}</span><div className="spacer"/><HelpTip label={t('操作说明')}>{t(debug?'调参仅临时覆盖当前预览，恢复或退出后重新使用玩法输出。点击游戏画面可继续操作角色；F8 切换调试。':'输入遵循工作区绑定。默认：WASD 移动、Space 跳跃、Shift 冲刺、Q 奔跑、C 慢行；按住鼠标左键拖动观察。Esc 暂停／继续游戏，对话中按 Esc 或点击 × 退出。')}</HelpTip><HelpTip icon="camera" label={t('运行说明')}>{t('游戏开始时读取编辑器当前草稿；修改配置后，返回主菜单重新开始以应用。相机由工作区的 Lua 框架驱动，UE 运动、物理与渲染效果仍需在引擎中确认。')}</HelpTip></div>}
    <div className={'scene-layout '+(debug?'is-editing post-debug-layout':'')} ref={layout} style={{'--scene-left':split.left+'%','--scene-right':split.right+'%'} as React.CSSProperties}>
    {debug&&<><SceneDirectory catalog={catalog} group={group} onSelect={setGroup}/><div className="scene-splitter" role="separator" aria-label={t('调整目录宽度')} onPointerDown={splitter('left')} onPointerMove={resizeSplit('left')} onPointerUp={e=>e.currentTarget.releasePointerCapture(e.pointerId)}/></>}
    <div className="simulation-viewport" ref={viewport} tabIndex={0} aria-label={t('游戏视口')} onKeyDown={e=>key(e,true)} onKeyUp={e=>key(e,false)} onBlur={e=>{if(e.target===viewport.current||!e.currentTarget.contains(e.relatedTarget as Node))clearInput();}} onContextMenu={e=>e.preventDefault()}><div className="game-runtime"><span>{t(phaseNames[frame?.phase]||'闲置')} · <strong title={frame?.rigPath}>{frame?.rigName||'Default'}.rig</strong></span><span>{t('当前能力')}：{frame?.ability||'Idle'}</span><span data-simulation-time>{(frame?.time||0).toFixed(2)}</span>s</div><div className="viewport-toolbar"><button aria-pressed={channels} onClick={()=>setChannels(v=>!v)}>{t("12 通道")}</button><span>{t('移动速度倍率')} {settings.movementMultiplier??1}×</span></div><div ref={mount} className="canvas-host" onPointerDown={e=>{if(frame?.dialogue)return;viewport.current?.focus({preventScroll:true});if(status==='running'){signal('pressed',['LeftMouseButton','MiddleMouseButton','RightMouseButton'][e.button]);drag.current=e.button===0;e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();}}} onPointerUp={e=>{signal('released',['LeftMouseButton','MiddleMouseButton','RightMouseButton'][e.button]);drag.current=false;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}} onPointerCancel={clearInput} onPointerMove={e=>{if(drag.current&&!frame?.dialogue)queueMouse(e.movementX*settings.sensitivity,-e.movementY*settings.sensitivity);}} onWheel={e=>{if(status==='running'&&!frame?.dialogue&&document.activeElement===viewport.current)signal('changed','MouseScrollWheel',-e.deltaY/(e.deltaMode===0?100:3));}}/>
      <button ref={bubble} hidden className="npc-bubble" aria-label={t('与向导对话')} onPointerDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();clearInput();command.current('input',{action:'dialogue'});}}><Icon name="dialogue"/>{t('交谈')}</button>
      {frame?.dialogue&&<section ref={dialoguePanel} tabIndex={-1} className="dialogue-panel" role="dialog" aria-label={t('向导对话')} onPointerDown={e=>e.stopPropagation()}><button className="dialogue-close" aria-label={t('退出对话')} title={t('退出对话')+' (Esc)'} onClick={closeDialogue}><Icon name="close"/></button><small>{t('原野向导')}</small><p>{t('欢迎来到相机试验场。')}</p></section>}
      {frame?.dialogueClosing&&<div className="game-dialogue-status" role="status">{t('正在退出对话…')}</div>}{!launching&&!launchError&&resourceState!=='ready'&&<div className="preview-loading" role="status">{resourceState==='loading'?t('正在加载预览素材…'):t('预览素材加载失败')}<small>{resourceError}</small>{resourceState==='error'&&<button onClick={()=>setRetry(v=>v+1)}>{t('重试加载')}</button>}</div>}{(launching||launchError)&&<div className="game-loading" data-game-loading={launching?'loading':'error'} role={launching?'status':'alert'}><Icon name={launchError?'warning':'camera'} size={36}/><h2>{t(launchError?'启动失败':'正在进入原野')}</h2><p>{t(launchError||stage)}</p>{launching?<><div className="loading-track"/><button onClick={cancelLaunch}>{t('取消加载')}</button></>:<><button className="primary" onClick={()=>startGame()}>{t('重试')}</button><button onClick={cancelLaunch}>{t('返回场景')}</button></>}</div>}<span className="preview-legend"><i/>{t("玩家")}{frame?.subject&&<><i/>NPC</>}</span><span ref={performanceRef} className="preview-performance"/>{!launching&&!launchError&&(error||simulation?.error)&&<div className="viewport-note simulation-error">{error||simulation.error}</div>}{channels&&frame&&<div className="channel-monitor"><table><thead><tr><th>{t("通道")}</th><th>{t("目标")}</th><th>{t("渲染")}</th><th>{t("输出")}</th></tr></thead><tbody>{channelNames.map(name=><tr key={name} data-channel={name}><td>{name}</td>{['target','render','output'].map(k=><td key={k}>{frame[k][name].toFixed(2)}</td>)}</tr>)}</tbody></table></div>}</div>
    {debug&&<><div className="scene-splitter" role="separator" aria-label={t('调整详情宽度')} onPointerDown={splitter('right')} onPointerMove={resizeSplit('right')} onPointerUp={e=>e.currentTarget.releasePointerCapture(e.pointerId)}/><SceneInspector values={frame.postProcessing||{}} overrides={overrides} onChange={(name:string,value:number)=>setOverrides(old=>({...old,[name]:value}))} onRestore={(name?:string)=>setOverrides(old=>{if(!name)return {};const next={...old};delete next[name];return next;})} group={group} catalog={catalog}/></>}

    </div>
  </div>;
}
