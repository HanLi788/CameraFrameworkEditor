import {t} from './i18n';
import Icon,{IconButton} from './Icon';
import {postChannelLabel} from './postProcessingLabels.mjs';
import {useLanguage} from './i18n';
export default function PostBindings({path,config,error,transform,catalog,outputs}:any){
 const language=useLanguage();
 const source=()=>window.cameraEditor.openFile({path:'PostProcessing/Bindings.lua'});
 if(!config||!Array.isArray(config.Bindings)||config.Bindings.some((b:any)=>!b||typeof b.Id!=='string'||typeof b.Asset!=='string'||!b.Activation||typeof b.Activation.Kind!=='string'))return <section className="effect-card"><p role="alert">{error||t(config?'绑定配置无效，请检查源码':'正在加载…')}</p><button onClick={source}>{t('绑定源码')}</button></section>;
 const bindings=config.Bindings||[],rows=bindings.map((b:any,index:number)=>({...b,index})).filter((b:any)=>b.Asset===path);
 const patch=(index:number,change:any)=>transform((c:any)=>({...c,Bindings:c.Bindings.map((b:any,i:number)=>i===index?change(b):b)}));
 const channels=catalog.filter((c:any)=>Object.hasOwn(outputs||{},c.name));
 return <>
 <section className="effect-card post-bindings"><header className="effect-table-heading"><h3><Icon name="link"/>{t('玩法绑定')}</h3><button onClick={source}>{t('绑定源码')}</button><IconButton icon="plus" label={t('添加绑定')} onClick={()=>transform((c:any)=>{const prefix=path.split('/').at(-2)||'Post';let n=1;while(c.Bindings.some((b:any)=>b.Id===prefix+'.'+n))n++;return {...c,Bindings:[...c.Bindings,{Id:prefix+'.'+n,Asset:path,Activation:{Kind:'Manual'}}]};})}/></header>
 <div className="range-table-scroll"><table className="range-table" aria-label={t('玩法绑定')}><thead><tr><th>Id</th><th>{t('激活方式')}</th><th>{t('相机空间')}</th><th>{t('装置')}</th><th/></tr></thead><tbody>{rows.map((b:any)=><tr key={b.index} data-post-binding={b.index}>
 <td><input aria-label={'Binding.'+b.index+'.Id'} value={b.Id} onChange={e=>patch(b.index,(v:any)=>({...v,Id:e.target.value}))}/></td>
 <td><select aria-label={'Binding.'+b.index+'.Kind'} value={b.Activation.Kind} onChange={e=>{const Kind=e.target.value;patch(b.index,(v:any)=>({...v,Activation:{Kind,...(['Space','Rig'].includes(Kind)?{Space:v.Activation.Space||'Action'}:{}),...(Kind==='Rig'?{Name:v.Activation.Name||''}:{})}}));}}>{['Always','Manual','Space','Rig','Switch'].map(k=><option key={k}>{k}</option>)}</select></td>
 <td>{['Space','Rig'].includes(b.Activation.Kind)&&<input aria-label={'Binding.'+b.index+'.Space'} value={b.Activation.Space} onChange={e=>patch(b.index,(v:any)=>({...v,Activation:{...v.Activation,Space:e.target.value}}))}/>}</td>
 <td>{b.Activation.Kind==='Rig'&&<input aria-label={'Binding.'+b.index+'.Name'} value={b.Activation.Name} onChange={e=>patch(b.index,(v:any)=>({...v,Activation:{...v.Activation,Name:e.target.value}}))}/>}</td>
 <td><IconButton icon="close" label={t('移除绑定')+' '+b.Id} onClick={()=>transform((c:any)=>({...c,Bindings:c.Bindings.filter((_:any,i:number)=>i!==b.index)}))}/></td>
 </tr>)}</tbody></table></div>{!rows.length&&<p className="empty-state">{t('尚未绑定')}</p>}
 </section>
 <section className="effect-card"><header className="effect-table-heading"><h3><Icon name="smooth"/>{t('共享基准与平滑')}</h3></header><div className="range-table-scroll"><table className="range-table" aria-label={t('共享基准与平滑')}><thead><tr><th>{t('通道')}</th><th>{t('默认值')}</th><th>{t('响应时间常数（秒）')}</th></tr></thead><tbody>{channels.map((c:any)=>{const setting=config.Channels?.[c.name]||{};const set=(key:string,value:number)=>transform((v:any)=>({...v,Channels:{...v.Channels,[c.name]:{...v.Channels?.[c.name],[key]:value}}}));return <tr key={c.name}><th>{postChannelLabel(c,language)}</th>{[['Default',setting.Default??c.default],['SmoothTime',setting.SmoothTime??0]].map(([key,value])=><td key={key as string}><input type="number" step="any" min={key==='SmoothTime'?0:undefined} aria-label={c.name+'.'+key} value={value} onChange={e=>{if(e.target.value.trim()&&Number.isFinite(Number(e.target.value)))set(key as string,Number(e.target.value));}}/></td>)}</tr>;})}</tbody></table></div></section>
 </>;
}
