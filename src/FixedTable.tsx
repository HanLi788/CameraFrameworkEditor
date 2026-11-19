import type {TableHTMLAttributes,ReactNode} from 'react';

export const tableColumns={
 range:[180,272,200,48],value:[180,64,244,328,104,160,48],
 smooth:[180,244,112,160,48],sensitivity:[180,160,160,48],
 user:[180,448,112,48],effect:[180,216,188,64],properties:[180,240,96,216],
 post:[200,260,112,64],numericPost:[200,216,188,64],
};
type Props=TableHTMLAttributes<HTMLTableElement>&{columns:number[];children:ReactNode};
export default function FixedTable({columns,children,style,...props}:Props){
 const width=columns.reduce((total,column)=>total+column,0);
 return <table {...props} style={{...style,width,minWidth:width,maxWidth:'none'}}><colgroup>{columns.map((width,index)=><col key={index} style={{width}}/>)}</colgroup>{children}</table>;
}
