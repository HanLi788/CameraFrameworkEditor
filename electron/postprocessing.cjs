const PLAN='Assets/PostProcessingAssets/Framework.postProcessingPlan';
const BINDINGS='PostProcessing/Bindings.lua';
const generated=file=>typeof file==='string'&&file.toLowerCase().endsWith('.postprocessingplan');
function writable(file){if(generated(file))throw Error('后处理执行计划由保存自动生成，只读，不能编辑、复制、移动或删除');}
// Only literal configuration tables are rewritten. Executable Lua stays source-only.
function parseBindings(source){
 let at=0;const fail=()=>{throw Error('绑定配置包含动态 Lua，请使用源码编辑');};
 const skip=()=>{while(true){const start=at;while(/\s/.test(source[at]||'')&&at<source.length)at++;if(source.startsWith('--',at)){at+=2;const m=/^\[(=*)\[/.exec(source.slice(at));if(m){const end=source.indexOf(']'+m[1]+']',at+m[0].length);if(end<0)fail();at=end+m[1].length+2;}else{const end=source.indexOf('\n',at);at=end<0?source.length:end;}}if(at===start)break;}};
 const token=()=>{skip();const start=at,c=source[at++];if(c===undefined)return {kind:'eof',start};
  if(c==='"'||c==="'"){let value='';while(at<source.length){let x=source[at++];if(x===c)return {kind:'value',value,start};if(x==='\\'){const e=source[at++],esc={n:'\n',r:'\r',t:'\t',b:'\b',f:'\f',v:'\v',a:'\x07','\\':'\\','"':'"',"'":"'"};if(Object.hasOwn(esc,e))x=esc[e];else if(/[0-9]/.test(e)){const m=/^\d{0,2}/.exec(source.slice(at))[0];at+=m.length;const n=Number(e+m);if(n>255)fail();x=String.fromCharCode(n);}else fail();}value+=x;}fail();}
  const rest=source.slice(start),n=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(rest);if(n){at=start+n[0].length;return {kind:'value',value:Number(n[0]),start};}
  const id=/^[A-Za-z_][A-Za-z_0-9]*/.exec(rest);if(id){at=start+id[0].length;return {kind:'id',value:id[0],start};}return {kind:c,start};
 };
 let look=token();const take=kind=>{if(look.kind!==kind)fail();const old=look;look=token();return old;};
 const value=()=>{if(look.kind==='value')return take('value').value;if(look.kind==='id'&&['true','false'].includes(look.value))return take('id').value==='true';if(look.kind!=='{')fail();take('{');const object={},array=[];let mode='';
  while(look.kind!=='}'){let key,v;if(look.kind==='['){take('[');key=take('value').value;take(']');take('=');v=value();}else if(look.kind==='id'&&!['true','false'].includes(look.value)){key=take('id').value;take('=');v=value();}else{v=value();}
   if(key!==undefined){if(mode==='array'||typeof key!=='string'||['__proto__','constructor','prototype'].includes(key)||Object.hasOwn(object,key))fail();mode='object';object[key]=v;}else{if(mode==='object')fail();mode='array';array.push(v);}if(look.kind===','||look.kind===';')take(look.kind);else if(look.kind!=='}')fail();
  }take('}');return mode==='array'?array:object;
 };
 const start=look.start;if(take('id').value!=='return')fail();const config=value();if(look.kind===';')take(';');if(look.kind!=='eof')fail();
 if(!config||typeof config!=='object'||Array.isArray(config)||!Object.hasOwn(config,'Bindings'))fail();
 if(!Array.isArray(config.Bindings)&&Object.keys(config.Bindings||{}).length===0)config.Bindings=[];
 if(!Array.isArray(config.Bindings))fail();return {config,prefix:source.slice(0,start)};
}
const quote=s=>'"'+s.replace(/[\\"\x00-\x1f]/g,c=>c==='"'?'\\"':c==='\\'?'\\\\':'\\'+c.charCodeAt(0).toString().padStart(3,'0'))+'"';
function lua(value,depth=0){if(typeof value==='string')return quote(value);if(typeof value==='boolean')return String(value);if(typeof value==='number'&&Number.isFinite(value))return String(value);if(!value||typeof value!=='object')throw Error('绑定配置必须是有限 JSON 值');const entries=Array.isArray(value)?value.map(v=>lua(v,depth+1)):Object.entries(value).map(([k,v])=>'['+quote(k)+'] = '+lua(v,depth+1));return entries.length?'{\n'+'    '.repeat(depth+1)+entries.join(',\n'+'    '.repeat(depth+1))+',\n'+'    '.repeat(depth)+'}':'{}';}
function writeBindings(text,config){const {prefix}=parseBindings(text);return prefix+'return '+lua(config)+'\n';}
module.exports={PLAN,BINDINGS,generated,writable,parseBindings,writeBindings};
