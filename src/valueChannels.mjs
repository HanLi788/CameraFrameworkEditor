import {rangeError} from './rangeChannels.mjs';
export const valueLabels={Scalar:'标量',Angle:'角度',Point:'点',Displacement:'位移',Absolute:'绝对值',World:'世界',Owner:'所属对象',CurrentTarget:'当前观察目标',CameraTarget:'相机目标状态',CameraRender:'相机渲染状态',IdleDefault:'闲置默认状态',IdleCurrent:'闲置当前状态',Explicit:'显式参考',TransitionStart:'过渡起点',OnlyAtStart:'仅开始时',EveryFrame:'每帧'};
export const valueTypes=name=>name.startsWith('AnchorLocOffset.')?['Displacement','Point']:['Yaw','Pitch','Roll'].includes(name)?['Angle']:['Scalar'];
export const valueReferences=kind=>kind==='Scalar'?['Absolute','TransitionStart','IdleDefault','IdleCurrent','Explicit']:['World','Owner','CurrentTarget','CameraTarget','CameraRender','IdleDefault','IdleCurrent','Explicit'];
export function valueError(name,reference,value){return rangeError(reference==='Absolute'?name:'',value,value);}
export function changeReference(channel,reference){
  const next={...channel,Reference:reference};
  delete next.Base;delete next.Origin;delete next.Rotation;
  if(reference==='Explicit'){
    if(['Scalar','Angle'].includes(channel.ValueType))next.Base=channel.Base??0;
    else {next.Origin=channel.Origin??{X:0,Y:0,Z:0};next.Rotation=channel.Rotation??{Pitch:0,Yaw:0,Roll:0};}
  }
  return next;
}
