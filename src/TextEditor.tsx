import Editor,{loader} from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import 'monaco-editor/esm/vs/basic-languages/lua/lua.contribution';
import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution';
import 'monaco-editor/esm/vs/language/json/monaco.contribution';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
window.MonacoEnvironment={getWorker:(_id:string,label:string)=>label==='json'?new JsonWorker():new EditorWorker()};
loader.config({monaco});
export default function TextEditor({doc,onChange,onReady}:{doc:any;onChange:(text:string)=>void;onReady:(editor:any)=>void}){
  const language=doc.path.endsWith('.lua')?'lua':/\.md$/i.test(doc.path)?'markdown':/\.(json|value|rig|input|curve|range|smooth|sensitivity|occlusion|effect|pipeline)$/.test(doc.path)?'json':'plaintext';
  return <Editor path={doc.path} value={doc.text} language={language} theme="vs-dark" onMount={onReady} onChange={v=>onChange(v??'')} options={{fontSize:13,fontFamily:'Cascadia Code, Consolas, monospace',minimap:{enabled:false},automaticLayout:true,scrollBeyondLastLine:false,tabSize:2,wordWrap:'on',padding:{top:18},renderLineHighlight:'line'}}/>;
}
