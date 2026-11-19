import {rangeError} from './rangeChannels.mjs';
export const valueLabels={Scalar:'标量',Angle:'角度',Vector:'向量',OnlyAtStart:'仅开始时',EveryFrame:'每帧'};
export const valueTypes=name=>name==='AnchorLocOffset'?['Vector']:['RotationYaw','RotationPitch','RotationRoll'].includes(name)?['Angle']:['Scalar'];
export const valueReferences=(kind,_sequence=false,catalog)=>catalog?.[kind]||[];
export function valueError(name,reference,value){return rangeError(reference==='Absolute'?name:'',value,value);}
export function changeReference(channel,reference){
  const next={...channel,Reference:reference};
  delete next.Base;delete next.Origin;delete next.Rotation;
  delete next.bUseSocketRotation;
  if(reference==='Explicit'){
    if(channel.ValueType!=='Vector')next.Base=channel.Base??0;
    else {next.Origin=channel.Origin??{X:0,Y:0,Z:0};next.Rotation=channel.Rotation??{Pitch:0,Yaw:0,Roll:0};}
  }
  return next;
}
