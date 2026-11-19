export default function SelectInput({onValueChange,...props}:any){return <div className="adaptive-field select-input"><select {...props} onChange={event=>onValueChange(event.target.value)}/></div>;}
