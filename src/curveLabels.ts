import {t} from './i18n';
import {filename} from './types';

// Only the bundled preset paths have authored translations. Custom filenames remain verbatim.
const presets:Record<string,string>={
  'Bezier/Linear':'线性','Bezier/EaseIn':'缓入','Bezier/EaseOut':'缓出','Bezier/EaseInOut':'缓入缓出',
  'Bezier/EaseInOutCubicApprox':'三次缓入缓出近似','CubicHermiteSpline/SmoothStep':'平滑阶跃',
  'CubicHermiteSpline/RangeUnit':'恒定倍率','CubicHermiteSpline/RangeSoftEdge':'柔和边缘','CubicHermiteSpline/RangeLinearEdge':'线性边缘'
};
export function curveLabel(path:string){
  const key=path.startsWith('Assets/Shared/CurveAssets/')?path.slice('Assets/Shared/CurveAssets/'.length).replace(/\.curve$/i,''):'';
  return presets[key]?t(presets[key]):filename(path).replace(/\.curve$/i,'');
}
export function curveOptionLabel(path:string,choices:{path:string}[]){
  const label=curveLabel(path);
  return choices.some(a=>a.path!==path&&curveLabel(a.path)===label)?`${label} — ${path.slice(0,path.lastIndexOf('/'))}`:label;
}
