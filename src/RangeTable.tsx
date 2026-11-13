import {assetFile} from './assetPaths.mjs';
import NumericInput from './NumericInput';
import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {t} from './i18n';
import Icon from './Icon';
import HelpTip from './HelpTip';
import {rangeChannels,referenceLabels,velocityHints,referencesFor} from './rangeChannels.mjs';


function ReferenceSelect({name,value,onChange}:any){
  const [open,setOpen]=useState(false),[index,setIndex]=useState(0),[position,setPosition]=useState({left:0,top:0,width:260});
  const button=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null),id=useId(),options=referencesFor(name);
  const valid=options.includes(value),hint=velocityHints[value];
  const show=()=>{const b=button.current!.getBoundingClientRect(),width=Math.min(innerWidth-16,Math.max(b.width,300)),height=options.length*38+10;setPosition({left:Math.max(8,Math.min(b.left,innerWidth-width-8)),top:Math.max(8,b.bottom+height<innerHeight?b.bottom+4:b.top-height-4),width});setIndex(Math.max(0,options.indexOf(value)));setOpen(true);};
  const choose=(next:string)=>{onChange(next);setOpen(false);button.current?.focus({preventScroll:true});};
  useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!button.current?.contains(e.target as Node)&&!menu.current?.contains(e.target as Node))setOpen(false);};const close=()=>setOpen(false);window.addEventListener('pointerdown',outside);window.addEventListener('resize',close);window.addEventListener('scroll',close,true);return()=>{window.removeEventListener('pointerdown',outside);window.removeEventListener('resize',close);window.removeEventListener('scroll',close,true);};},[open]);
  if(options.length===1&&valid)return <span className="range-absolute" title="Absolute">{t('绝对值')}</span>;
  return <div className="range-reference"><button ref={button} type="button" role="combobox" aria-label={name+'.Reference'} aria-invalid={!valid} aria-haspopup="listbox" aria-controls={open?id:undefined} aria-expanded={open} aria-activedescendant={open?id+'-'+index:undefined} title={value}
    onClick={()=>open?setOpen(false):show()} onKeyDown={e=>{if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();if(!open)show();else setIndex(e.key==='Home'?0:e.key==='End'?options.length-1:(index+(e.key==='ArrowUp'?-1:1)+options.length)%options.length);}if(open&&e.key==='Enter'){e.preventDefault();choose(options[index]);}if(open&&e.key==='Escape'){e.preventDefault();e.stopPropagation();setOpen(false);}if(e.key==='Tab')setOpen(false);}}><span>{t(referenceLabels[value]||value)}</span><Icon name="down" size={14}/></button>{hint&&<HelpTip label={name+' '+t('速度参考说明')}>{t(hint)}</HelpTip>}
    {open&&createPortal(<div ref={menu} className="range-reference-menu" style={position} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setOpen(false);button.current?.focus();}}}><div id={id} role="listbox" aria-label={name+'.Reference'}>{options.map((option:string,i:number)=><div className={'range-reference-option '+(i===index?'highlighted':'')} key={option}>
      <button type="button" role="option" id={id+'-'+i} aria-selected={value===option} onClick={()=>choose(option)}><span>{t(referenceLabels[option])}</span>{value===option&&<Icon name="check" size={14}/>}</button>{velocityHints[option]&&<HelpTip label={t(referenceLabels[option])+' '+t('说明')}>{t(velocityHints[option])}</HelpTip>}
    </div>)}</div></div>,button.current?.closest('dialog[open]')||document.body)}
  </div>;
}

export default function RangeTable({value,onField}:any){
  const extra=Object.keys(value).filter(key=>!rangeChannels.some(([name])=>name===key));
  return <div className="range-table-scroll">{extra.length>0&&<p className="range-error" role="alert">{t('存在旧版或未知字段，请在源码中修复：')}{extra.join(', ')}</p>}<table className="range-table"><thead><tr>{['通道','范围','参考系','启用'].map(label=><th key={label}>{t(label)}</th>)}</tr></thead><tbody>{rangeChannels.map(([name,label,icon])=>{
    const channel=value[name],unknown=channel&&Object.keys(channel).filter(k=>!['Type','Min','Max','Reference','bEnabled'].includes(k));
    if(!channel||typeof channel!=='object'||Array.isArray(channel))return <tr key={name}><th>{t(label)}</th><td colSpan={3} role="alert" className="range-error">{t('通道配置无效，请在源码中修复')}</td></tr>;
    return <tr key={name} data-range-channel={name} className={channel.bEnabled?'':'range-disabled'}><th scope="row" title={name}><div className="range-channel"><Icon name={'channel-'+icon} size={18}/><span>{t(label)}</span></div>{unknown.length>0&&<small className="range-error" role="alert">{unknown.join(', ')}</small>}</th>
      <td><NumericInput name={name} value={channel} onChange={(next:any)=>onField(['Channels',name],next,channel)}/></td><td><ReferenceSelect name={name} value={channel.Reference} onChange={(next:string)=>onField(['Channels',name,'Reference'],next,channel.Reference)}/></td><td><input type="checkbox" aria-label={name+'.bEnabled'} checked={channel.bEnabled===true} onChange={e=>onField(['Channels',name,'bEnabled'],e.target.checked,channel.bEnabled)}/></td></tr>;
  })}</tbody></table></div>;
}
