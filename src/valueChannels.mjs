import {rangeError} from './rangeChannels.mjs';
export const valueLabels={Scalar:'标量',Angle:'角度',Point:'点',Displacement:'位移',Absolute:'绝对值',World:'世界',Viewpoint:'视点',CurrentTarget:'当前观察目标',CameraTarget:'相机目标状态',CameraRender:'相机渲染状态',IdleDefault:'闲置默认状态',IdleCurrent:'闲置当前状态',Explicit:'显式参考',TransitionStart:'过渡起点',OnlyAtStart:'仅开始时',EveryFrame:'每帧'};
Object.assign(valueLabels,{'CurrentViewpoint':'当前视点','CurrentViewpoint|default':'视点 · 默认',...Object.fromEntries(Object.entries({chest:'胸部',back:'背部',center:'中心',hand_l:'左手',hand_r:'右手',foot_l:'左脚',foot_r:'右脚'}).map(([name,label])=>['CurrentViewpoint|socket_'+name,'视点 · '+label+'插槽']))});
export const valueTypes=name=>name.startsWith('AnchorOffset')?['Displacement','Point']:['RotationYaw','RotationPitch','RotationRoll'].includes(name)?['Angle']:['Scalar'];
export const viewpointReferences=['CurrentViewpoint','CurrentViewpoint|default',...['chest','back','center','hand_l','hand_r','foot_l','foot_r'].map(name=>'CurrentViewpoint|socket_'+name)];
export const isViewpointReference=reference=>viewpointReferences.includes(reference);
export const valueReferences=(kind,sequence=false)=>kind==='Scalar'?['Absolute','TransitionStart',...(sequence?[]:['IdleDefault','IdleCurrent']),'Explicit']:sequence?['World','CameraTarget','CameraRender','Explicit']:['World',...viewpointReferences,'CurrentTarget','CameraTarget','CameraRender','IdleDefault','IdleCurrent','Explicit'];
export function valueError(name,reference,value){return rangeError(reference==='Absolute'?name:'',value,value);}
export function changeReference(channel,reference){
  const next={...channel,Reference:reference};
  delete next.Base;delete next.Origin;delete next.Rotation;
  if(isViewpointReference(reference)&&channel.ValueType!=='Scalar')next.bUseSocketRotation=channel.bUseSocketRotation??false;
  else delete next.bUseSocketRotation;
  if(reference==='Explicit'){
    if(['Scalar','Angle'].includes(channel.ValueType))next.Base=channel.Base??0;
    else {next.Origin=channel.Origin??{X:0,Y:0,Z:0};next.Rotation=channel.Rotation??{Pitch:0,Yaw:0,Roll:0};}
  }
  return next;
}
