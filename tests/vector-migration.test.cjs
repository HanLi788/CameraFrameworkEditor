const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {migrate,run}=require('../scripts/migrate-anchor-offset.cjs');
const channel=(Value=[0,0,10])=>({ValueType:'Point',Value,Reference:'CurrentViewpoint|socket_chest',bUseSocketRotation:true,Sample:'OnlyAtStart',Curve:'Shared/Linear.curve',bEnabled:true});
test('vector migration preserves literal metadata, shared settings and input, and rejects incompatible axes',()=>{
 const source={Name:'AnchorOffsetX',Description:'CurrentViewpoint|socket_chest',Channels:Object.fromEntries(['X','Y','Z'].map(axis=>['AnchorOffset'+axis,channel()]))},copy=structuredClone(source),result=migrate(source,'Value.transitionValue');
 assert.deepEqual(source,copy);assert.deepEqual(result.data.Channels.AnchorLocOffset.Value,[0,0,10]);assert.equal(result.data.Channels.AnchorLocOffset.Reference,'CurrentViewpoint|socket_chest|Socket');assert.equal(result.data.Channels.AnchorLocOffset.ValueType,'Vector');assert.equal(Object.hasOwn(result.data.Channels.AnchorLocOffset,'bUseSocketRotation'),false);assert.equal(result.data.Name,source.Name);assert.equal(result.data.Description,source.Description);assert.equal(result.notes.length,1);assert.deepEqual(migrate(result.data,'Value.transitionValue').data,result.data);
 copy.Channels.AnchorOffsetY.Sample='EveryFrame';assert.throws(()=>migrate(copy,'Value.transitionValue'),/settings differ/);
 const height={Channels:{AnchorOffsetX:{...channel([0,0,0]),ValueType:'Displacement'},AnchorOffsetY:{...channel([0,0,0]),ValueType:'Displacement'},AnchorOffsetZ:{...channel([0,0,200]),ValueType:'Displacement'}}};const h=migrate(height,'Height.transitionValue');assert.equal(h.data.Channels.AnchorLocOffset.Reference,'CurrentViewpoint|default|World');assert.deepEqual(h.data.Channels.AnchorLocOffset.Value,[0,0,200]);
});
test('migration previews without writes and applying requires a fresh backup outside Assets',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'camera-vector-migration-')),root=path.join(temp,'Assets');fs.mkdirSync(root);const file=path.join(root,'Example.transitionValue'),old=JSON.stringify({Channels:Object.fromEntries(['X','Y','Z'].map(axis=>['AnchorOffset'+axis,channel()]))});fs.writeFileSync(file,old);
 assert.equal(run(['--root',root]).files,1);assert.equal(fs.readFileSync(file,'utf8'),old);assert.throws(()=>run(['--root',root,'--apply']),/backup-dir/);assert.equal(fs.readFileSync(file,'utf8'),old);assert.throws(()=>run(['--root',root,'--apply','--backup-dir',path.join(root,'backup')]),/outside Assets/);
 const backup=path.join(temp,'backup');assert.equal(run(['--root',root,'--apply','--backup-dir',backup]).files,1);assert.equal(fs.readFileSync(path.join(backup,'Example.transitionValue'),'utf8'),old);assert.ok(JSON.parse(fs.readFileSync(file,'utf8')).Channels.AnchorLocOffset);assert.equal(run(['--root',root]).files,0);
});

test('effect migration preserves per-axis scalar curves and splits vector outputs without aliases',()=>{
 const source={Outputs:{AnchorOffsetX:{Type:'Scalar',Range:'[0,20]',Curve:'X.curve'},AnchorOffsetZ:{Type:'Scalar',Range:'[-5,0]',Curve:'Z.curve'}}};
 const result=migrate(source,'Test.effect').data;
 assert.deepEqual(result.Outputs,{'AnchorLocOffset.X':source.Outputs.AnchorOffsetX,'AnchorLocOffset.Z':source.Outputs.AnchorOffsetZ});
 assert.deepEqual(source.Outputs.AnchorOffsetX,{Type:'Scalar',Range:'[0,20]',Curve:'X.curve'});
 const vector={Type:'Vector',Range:['[0,20]','{0}','{-5}'],Curve:{$ref:{DocumentId:'Linear.curve',Pointer:''}}};
 const split=migrate({Outputs:{AnchorLocOffset:vector,FOV:{Type:'Scalar',Range:'{5}'}}},'Test.effect').data;
 assert.equal(split.Outputs['AnchorLocOffset.X'].Type,'Scalar');assert.equal(split.Outputs['AnchorLocOffset.Y'].Range,'{0}');assert.deepEqual(split.Outputs['AnchorLocOffset.Z'].Curve,vector.Curve);assert.equal(split.Outputs.FOV.Range,'{5}');
 assert.deepEqual(migrate(split,'Test.effect').data,split);
 for(const outputs of [{AnchorLocOffset:vector,'AnchorLocOffset.X':source.Outputs.AnchorOffsetX},{AnchorOffsetX:source.Outputs.AnchorOffsetX,'AnchorLocOffset.X':source.Outputs.AnchorOffsetX},{AnchorLocOffset:{...vector,Range:['{0}']}}])assert.throws(()=>migrate({Outputs:outputs},'Test.effect'));
});
test('a partially written asset restores every attempted file from the pre-migration source',()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'camera-vector-rollback-')),root=path.join(temp,'Assets');fs.mkdirSync(root);const source=JSON.stringify({Channels:Object.fromEntries(['X','Y','Z'].map(axis=>['AnchorOffset'+axis,channel()]))});
 const first=path.join(root,'A.transitionValue'),second=path.join(root,'B.transitionValue');fs.writeFileSync(first,source);fs.writeFileSync(second,source);
 const originalWrite=fs.writeFileSync;let failed=false;
 fs.writeFileSync=function(file,...args){if(file===second&&!failed){failed=true;originalWrite(file,'{partial');throw Error('simulated write failure');}return originalWrite(file,...args);};
 try{assert.throws(()=>run(['--root',root,'--apply','--backup-dir',path.join(temp,'backup')]),/simulated/);}finally{fs.writeFileSync=originalWrite;}
 assert.equal(fs.readFileSync(first,'utf8'),source);assert.equal(fs.readFileSync(second,'utf8'),source);
});
