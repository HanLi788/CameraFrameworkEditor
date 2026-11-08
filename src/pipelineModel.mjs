export const baseStages=['Input','Effects','Render','Occlusion','Smooth'];
export const stageLabels={Input:'输入',Effects:'效果',Render:'渲染目标',Occlusion:'遮挡',Smooth:'平滑',Subject:'主体',Evaluation:'评估'};
export const implementations=space=>[...baseStages.map(name=>'Common.'+name),...(space==='Battle'?['Battle.Subject','Battle.Evaluation']:[])];
const requires={'Common.Occlusion':['Render'],'Battle.Evaluation':['Subject']};
export function pipelineProblems(data){
  const errors=[];
  if(data.SchemaVersion!==3)errors.push(['管线资产版本必须为 3','']);
  if(!data.Stages||typeof data.Stages!=='object'||Array.isArray(data.Stages)||!Array.isArray(data.Flow)||!Array.isArray(data.Disabled))return [['管线结构无效，请在源码中修复','']];
  const all=[...data.Flow,...data.Disabled],allowed=implementations(data.SpaceType);
  if(!['Action','Battle','Idle','Interactive'].includes(data.SpaceType))errors.push(['未知相机空间类型：',String(data.SpaceType)]);
  if(!data.Flow.length)errors.push(['管线至少需要一个启用阶段','']);
  for(const name of new Set([...baseStages,...Object.keys(data.Stages),...all])){
    if(!data.Stages[name]||all.filter(n=>n===name).length!==1){errors.push(['阶段必须声明且只归属一个列表：',String(name)]);continue;}
    const stage=data.Stages[name];
    if(!allowed.includes(stage.Implementation))errors.push(['当前空间未注册此实现：',String(stage.Implementation)]);
    if(typeof stage!=='object'||Array.isArray(stage))errors.push(['管线结构无效，请在源码中修复',String(name)]);
    else for(const key of Object.keys(stage))if(key!=='Implementation')errors.push([key==='Options'?'管线阶段已移除 Options，请在源码中修复：':'阶段存在未知字段：',`${name}.${key}`]);
    const index=data.Flow.indexOf(name);
    if(index>=0)for(const dependency of requires[stage.Implementation]||[])if(data.Flow.indexOf(dependency)<0||data.Flow.indexOf(dependency)>=index)errors.push(['阶段缺少前置依赖：',`${name} → ${dependency}`]);
  }
  if(data.Flow.includes('Smooth')&&data.Flow.at(-1)!=='Smooth')errors.push(['平滑阶段必须最后执行','']);
  return errors;
}
export function toggleStage(data,name,enabled){
  const next={...data,Flow:data.Flow.filter(n=>n!==name),Disabled:data.Disabled.filter(n=>n!==name)};
  if(enabled){const at=name==='Smooth'?-1:next.Flow.indexOf('Smooth');if(at<0)next.Flow.push(name);else next.Flow.splice(at,0,name);}else next.Disabled.push(name);
  return next;
}
export function pipelineImpact(data,path,assets){
  if(!Array.isArray(data.Flow))return [];
  return assets.filter(a=>a.type==='Rig'&&a.data?.Pipelines?.includes(path)).map(a=>{
    const processors=a.data.Processors||{},missing=data.Flow.filter(n=>!Object.hasOwn(processors,n)),extra=Object.keys(processors).filter(n=>!data.Flow.includes(n));
    const space=/^Assets\/CameraAssets\/(Action|Battle|Idle|Interactive)Camera\//.exec(a.path)?.[1];
    return {path:a.path,missing,extra,spaceMismatch:!!space&&space!==data.SpaceType};
  }).filter(a=>a.missing.length||a.extra.length||a.spaceMismatch);
}
