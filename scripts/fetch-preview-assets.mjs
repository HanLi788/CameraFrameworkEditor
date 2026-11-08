// Optional recovery tool. Normal builds use the versioned assets offline.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve('public/preview'),records=JSON.parse(await fs.readFile(path.join(root,'sources.json'),'utf8'));
for(const record of records){
  const destination=path.resolve(root,record.file);
  if(!destination.startsWith(root+path.sep)||!record.url.startsWith('https://'))throw Error('Invalid preview asset manifest');
  const existing=await fs.readFile(destination).catch(()=>null);
  const matches=bytes=>bytes.length===record.bytes&&createHash('sha256').update(bytes).digest('hex')===record.sha256;
  if(existing&&matches(existing)){console.log('Verified',record.file);continue;}
  const response=await fetch(record.url);if(!response.ok)throw Error(`Download failed: ${response.status} ${record.file}`);
  const bytes=Buffer.from(await response.arrayBuffer());if(!matches(bytes))throw Error('Source checksum changed: '+record.file);
  await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,bytes);console.log('Restored',record.file);
}
