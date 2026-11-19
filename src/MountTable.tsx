import {t} from './i18n';
import FixedTable from './FixedTable';
export default function MountTable({title,columns=['资产'],children,actions,kind}:any){
 const widths=columns.map((_:string,index:number)=>columns.length===1?344:index===0?96:344);
 return <section className="mount-table-section" style={{width:widths.reduce((a:number,b:number)=>a+b,0)}} data-mount-kind={kind}><div className="mount-table-heading"><h3>{t(title)}</h3>{actions}</div><FixedTable columns={widths} className="mount-table" aria-label={t(title)}><thead><tr>{columns.map((column:string)=><th key={column} scope="col">{t(column)}</th>)}</tr></thead><tbody>{children}</tbody></FixedTable></section>;
}
