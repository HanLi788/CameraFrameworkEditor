import type {ButtonHTMLAttributes} from 'react';
const shapes:Record<string,string>={
  open:'M14 3h7v7 M21 3l-11 11 M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5',
  folder:'M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z',
  locate:'M12 2v3 M12 19v3 M2 12h3 M19 12h3 M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0 M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0',
  replace:'M4 7h16l-4-4 M20 17H4l4 4 M20 7l-4 4 M4 17l4-4',
  link:'M10 13a4 4 0 0 0 6 0l4-4a4 4 0 0 0-6-6l-2 2 M14 11a4 4 0 0 0-6 0l-4 4a4 4 0 0 0 6 6l2-2',
  close:'M6 6l12 12 M18 6L6 18',plus:'M12 4v16 M4 12h16',
  save:'M5 3h12l4 4v14H3V3Z M7 3v6h10V3 M7 21v-8h10v8',
  saveAll:'M6 3h11l4 4v11H6Z M3 7v14h14 M10 3v6h7V3 M10 18v-5h7v5',
  undo:'M8 4L3 9l5 5 M3 9h10a7 7 0 0 1 7 7v4',redo:'M16 4l5 5-5 5 M21 9H11a7 7 0 0 0-7 7v4',
  reset:'M3 11a9 9 0 1 1 2 7 M3 4v7h7',check:'M4 12l5 5L20 6',
  chevron:'M9 5l7 7-7 7',down:'M5 9l7 7 7-7',
  camera:'M3 7h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3Z M16 10l5-3v12l-5-3 M6 7V4h5v3',
  curve:'M3 20V4 M3 20h18 M4 18C13 18 9 6 20 6',
  input:'M3 5h18v14H3Z M6 9h1 M10 9h1 M14 9h1 M18 9h1 M6 13h1 M10 13h8',
  range:'M4 4v16h5 M20 4v16h-5 M8 12h8 M10 9l-3 3 3 3 M14 9l3 3-3 3',
  sliders:'M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6',
  smooth:'M2 15c5 0 4-8 8-8s3 10 7 10 3-5 5-5',
  effect:'M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',
  occlusion:'M4 3h10v18H4Z M18 7h3v10h-3 M7 7h4 M7 11h4 M7 15h4',
  pipeline:'M3 3h6v6H3Z M15 15h6v6h-6Z M9 6h9v9 M15 12l3 3 3-3',
  file:'M5 3h9l5 5v13H5Z M14 3v6h5 M8 13h8 M8 17h6',
  code:'M8 6l-6 6 6 6 M16 6l6 6-6 6 M14 3l-4 18',
  home:'M3 11l9-8 9 8 M5 10v11h14V10 M9 21v-7h6v7',
  warning:'M12 3L2 21h20Z M12 9v5 M12 17v.5',
  lock:'M6 10h12v11H6Z M8 10V6a4 4 0 0 1 8 0v4 M12 14v3',
  copy:'M8 8h13v13H8Z M16 8V3H3v13h5',trash:'M3 6h18 M8 6V3h8v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  move:'M12 2v20 M2 12h20 M9 5l3-3 3 3 M9 19l3 3 3-3 M5 9l-3 3 3 3 M19 9l3 3-3 3',
  play:'M7 3l14 9-14 9Z',pause:'M7 4v16 M17 4v16',stop:'M5 5h14v14H5Z',
  up:'M6 15l6-6 6 6',
  value:'M4 4h16v16H4Z M8 8h8 M8 12h4 M8 16h8',
  search:'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0 M15 15l6 6'
};
export const assetIcons:Record<string,string>={Value:'value',Rig:'camera',Input:'input',Range:'range',Sensitivity:'sliders',Smooth:'smooth',Effect:'effect',Occlusion:'occlusion',Curve:'curve',Pipeline:'pipeline'};
export default function Icon({name,size=16,className=''}:{name:string;size?:number;className?:string}){return <svg className={'ui-icon '+className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={shapes[name]||shapes.file}/></svg>;}
export function IconButton({icon,label,children,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{icon:string;label:string}){return <button {...props} aria-label={props['aria-label']||label} title={props.title||label}><Icon name={icon}/>{children}</button>;}
