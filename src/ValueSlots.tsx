import MountSlots from './MountSlots';
import {targetChoiceAllowed} from './transitionTargets.mjs';
export default function ValueSlots({value,assets,...props}:any){return <MountSlots {...props} value={value} assets={assets} path="ValueAssets" type="Value" choiceFilter={(asset:any,index:number)=>targetChoiceAllowed(asset,value,assets,index)}/>;}
