import {rangeChannels,rangeError} from './rangeChannels.mjs';
export const smoothChannels=[['AnchorLoc','锚点位置','anchor'],['CameraRot','相机旋转','rotation'],...rangeChannels.slice(6)];
export function speedError(_name,min,max){return rangeError('',min,max)||(min<0?'平滑速率不能为负数':'');}
export function lagError(name,value){return rangeError('',value,value)||(value<0?'最大滞后不能为负数':name==='CameraRot.MaxLag'&&value>180?'旋转最大滞后不能超过 180°':'');}
export const smoothHints={
  speed:'归一化误差经响应曲线映射到此速率区间，再进行指数平滑；速率越大，追随越快。推进时间时，实际速率为零会直接贴合目标。',
  lag:'限制当前值与目标值的剩余差距。位置和距离使用 cm，旋转和视场角使用度，其余使用各通道的单位。旋转最大滞后不超过 180°；推进时间时，零滞后直接贴合目标。'
};
