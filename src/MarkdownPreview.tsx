import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {useEffect,useState} from 'react';
function MarkdownImage({path,src,alt}:any){
  const [data,setData]=useState('');
  useEffect(()=>{let active=true;setData('');window.cameraEditor.markdownImage(path,src).then((value:string)=>{if(active)setData(value);}).catch(()=>{});return()=>{active=false;};},[path,src]);
  return data?<img src={data} alt={alt}/>:<span title={src}>{alt||src}</span>;
}
export default function MarkdownPreview({doc,open,report}:any){
  const navigate=(href:string)=>{
    if(/^https?:\/\//i.test(href)){window.cameraEditor.external(href).catch(report);return;}
    if(!href||href.startsWith('#')||/^[a-z]+:/i.test(href))return;
    try{
      const parts=doc.path.split('/').slice(0,-1);
      for(const part of decodeURIComponent(href.split('#')[0]).split('/')){
        if(part==='..'){if(!parts.length)throw Error('链接超出框架目录');parts.pop();}
        else if(part&&part!=='.')parts.push(part);
      }
      open(parts.join('/'));
    }catch(e){report(e);}
  };
  return <article className="markdown-preview"><Markdown remarkPlugins={[remarkGfm]} skipHtml components={{a:({href,children})=><a href={href} onClick={e=>{e.preventDefault();navigate(href||'');}}>{children}</a>,img:({src,alt})=><MarkdownImage path={doc.path} src={src} alt={alt}/>}}>{doc.text}</Markdown></article>;
}
