export const rangeChannels=[
  ['AnchorLocOffset.X','锚点偏移 X','axisX'],['AnchorLocOffset.Y','锚点偏移 Y','axisY'],['AnchorLocOffset.Z','锚点偏移 Z','axisZ'],
  ['Yaw','水平角','yaw'],['Pitch','俯仰角','pitch'],['Roll','翻滚角','roll'],['Dist','距离','distance'],['FOV','视场角','fov'],
  ['AspectRatio','宽高比','aspect'],['OrthoWidth','正交宽度','orthoWidth'],['OrthoNearClipPlane','正交近裁面','nearPlane'],['OrthoFarClipPlane','正交远裁面','farPlane']
];
export const referenceLabels={Absolute:'绝对值',World:'世界',OwnerRotation:'所属对象朝向',OwnerHorizontalVelocity:'所属对象水平速度方向',OwnerSpatialVelocity:'所属对象空间速度方向'};
export const velocityHints={
  OwnerHorizontalVelocity:'使用水平速度方向，仅适用于水平角。速度低于 10 cm/s 时保持已有方向；首次无有效速度时使用所属对象朝向，直到有效运动或重置。',
  OwnerSpatialVelocity:'使用空间速度方向，世界 +Z 为向上方向。速度低于 10 cm/s，或与向上方向平行时保持已有方向；首次无有效方向时使用所属对象朝向，直到有效运动或重置。'
};
export function referencesFor(name){return ['Yaw','Pitch','Roll'].includes(name)?['World','OwnerRotation',...(name==='Yaw'?['OwnerHorizontalVelocity']:[]),'OwnerSpatialVelocity']:['Absolute'];}
export function rangeError(name,min,max){
  if(!Number.isFinite(min)||!Number.isFinite(max))return '请输入完整的有限数值';
  if([min,max].some(n=>Number.isInteger(n)&&!Number.isSafeInteger(n)))return '整数超出安全范围';
  if(min>max)return '最小值不能大于最大值';
  if(['Yaw','Pitch','Roll'].includes(name)&&(min< -180||max>180))return '角度范围必须在 [-180, 180] 内';
  if(name==='Dist'&&min<0)return '距离不能为负数';
  if(name==='FOV'&&(min<=0||max>=180))return '视场角必须在 (0, 180) 内';
  if(['AspectRatio','OrthoWidth'].includes(name)&&min<=0)return '范围数值必须大于零';
  return '';
}
export function parseRangeNumber(text){const value=Number(text);return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text.trim())&&!(value===0&&/[1-9]/.test(text.split(/[eE]/)[0]))?value:NaN;}
