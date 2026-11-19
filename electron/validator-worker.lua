-- Editor-owned worker. Framework rules and the database ReadView come from the selected project.
local bootstrap = assert(io.read('*l'), 'Missing initialization')
local function jsonSource(text)
 local key='"Foundation.Serialization.JsonReader":'
 local p=assert(text:find(key,1,true))+#key
 assert(text:sub(p,p)=='"');p=p+1
 local out={}
 while p<=#text do
  local c=text:sub(p,p);p=p+1
  if c=='"' then break end
  if c=='\\' then
   local e=text:sub(p,p);p=p+1
   local escapes={['"']='"',['\\']='\\',['/']='/',n='\n',r='\r',t='\t',b='\b',f='\f'}
   if e=='u' then c=utf8.char(tonumber(text:sub(p,p+3),16));p=p+4 else c=assert(escapes[e]) end
  end
  out[#out+1]=c
 end
 return table.concat(out)
end
local Json=assert(load(jsonSource(bootstrap),'JsonReader'))()
local init=Json.Decode(bootstrap)
local modules=init.modules
table.insert(package.searchers,1,function(name)
 if package.preload[name] then return package.preload[name] end
 if modules[name] then return assert(load(modules[name],name)) end
 return '\n\tModule not supplied: '..name
end)
package.loaded['Foundation.Serialization.JsonReader']=Json
local Data=require('DatabaseSystem.Core.Data')
local ReadView=require('DatabaseSystem.Query.ReadView')
local Reference=require('DatabaseSystem.Core.Reference')
local Index=require('DatabaseSystem.Storage.Index')
local Workspace=require('CameraFramework.Editor.Workspace')
local Documents=require('CameraFramework.Documents')
local Journal=assert(load(init.journalScript,'EditorJournalBridge'))()
local entries,raw,documents,parseErrors={},{},{},{}
local sourceCache,sharedCache,rootErrors={},{},{}
local baseline=false
local function array(value) return Data.Array(value or {}) end
local function reply(id,result)
 result.id=id;result.runtime=true
 io.write('EDITOR_RESULT:'..Data.Encode(result)..'\n');io.flush()
end
reply(init.id,{ready=true,issues=array(),checked=0})

local function synchronize(request)
 local structural=request.assets~=nil
 if structural then
  entries={}
  local index=Index.Decode(request.index,{})
  for _,asset in ipairs(request.assets) do
   local definition=assert(index.Definitions[asset.documentId],'Unindexed asset')
   assert(definition.SchemaVersion==1 and definition.ReferenceMode=='Explicit','Camera index requires version 1 / Explicit')
   entries[asset.documentId]=asset
  end
  for id in pairs(raw) do if not entries[id] then raw[id],documents[id],parseErrors[id]=nil,nil,nil end end
  sourceCache,sharedCache,rootErrors={},{},{}
 end
 for id,change in pairs(request.changes or {}) do
  raw[id]=change.text
  local ok,value=pcall(function()return Data.Document(Json.Decode(change.text,id))end)
  if ok then documents[id]={Data=value,Revision=change.revision,ReferenceMode='Explicit'};parseErrors[id]=nil
  else documents[id]=nil;parseErrors[id]=tostring(value) end
 end
 local affected={}
 for _,id in ipairs(request.affected or {}) do affected[id]=true end
 for id in pairs(affected) do sourceCache[id],sharedCache[id],rootErrors[id]=nil,nil,nil end
 for id in pairs(sourceCache) do if not documents[id] then sourceCache[id]=nil end end
 for id in pairs(sharedCache) do if not documents[id] then sharedCache[id]=nil end end
 return structural,affected
end
local function validate(request)
 local structural,affected=synchronize(request)
 local full=request.full or structural or not baseline
 for id in pairs(request.changes or {})do if id:match('%.share$') or id:match('%.camera$') or id:match('%.postProcessing$')then full=true end end
 if full then sourceCache,sharedCache,rootErrors={},{},{} end
 local snapshot={Documents=documents,Revision=request.revision,ReadCache={}}
 local view=ReadView.New(snapshot,function()return true end)
 local workspace=Workspace.New({View=view})
 local touched={}
 local original=workspace.OnSource
 function workspace:OnSource(id,value)
  original(self,id,value)
  value=Documents.Project(value)
  local Validator=require('Foundation.Validation.ValueValidator')
  local allowed=id:match('%.sensitivity$') and {Type=true,bEnabled=true,EscapeCurve=true,ReturnCurve=true}
   or id:match('%.smooth$') and {Type=true,bEnabled=true,SpeedRange=true,MaxLag=true,ResponseCurve=true}
  if allowed then for name,node in pairs(value.Channels)do Validator.ValidateAllowedFields(node,allowed,id..'.Channels.'..name)end end
  if id:match('%.effect$')then require('CameraFramework.Editor.GameplayCameraSystem.AssetLoading.Effects.AssetDefinition').ValidateOutputs(value.Outputs,id..'.Outputs',false,require('CameraFramework.Editor.Validation.EffectContract').ValidateDomain(value.Source,value.Domain,id))end
 end
 workspace.Loader.RawAssets=sourceCache
 workspace.Loader.SharedAssets=sharedCache
 local load=workspace.Loader.Load
 function workspace.Loader:Load(id,depth) touched[id]=true;return load(self,id,depth) end
 local issues={}
 for id,message in pairs(parseErrors)do issues[#issues+1]={path=entries[id] and entries[id].path or id,severity='error',message=message}end
 local checked=0
 local function check(id,fn)
  local ok,message=pcall(fn)
  if ok then rootErrors[id]=nil else rootErrors[id]=tostring(message) end
  return ok
 end
 local ok,problem=pcall(function()
  if #issues>0 then return end
  local targets={}
  for id,document in pairs(documents)do if full or affected[id]then targets[id]=document end end
  local selected=setmetatable({}, {__index=documents,__pairs=function()return next,targets,nil end})
  Reference.Validate({Documents=selected})
  local shared='Shared/Framework.share'
  assert(documents[shared],'Missing shared framework')
  workspace:OnPath(shared);workspace:OnSource(shared,documents[shared].Data);touched[shared]=true
  if full then
   workspace:Build()
   for id in pairs(entries)do workspace.Loader:Load(id);checked=checked+1 end
   baseline=true
  else
   for id in pairs(affected)do
    if entries[id]then
     check(id,function()
      if id:match('%.share$') or id:match('%.camera$') or id:match('%.postProcessing$')then
       workspace:OnPath(id);workspace:OnSource(id,assert(documents[id]).Data);touched[id]=true
      else workspace.Loader:Load(id) end
     end)
     checked=checked+1
    end
   end
   -- Reuse the framework's complete-entry rules on the registered rig/pipeline links.
   local cameraId='Camera/Framework.camera'
   local camera=assert(documents[cameraId],'Missing camera framework').Data;touched[cameraId]=true
   local function linkedRig(ref)
    local id=ref['$ref'].DocumentId;touched[id]=true
    local rawRig=assert(documents[id],'Missing camera rig').Data
    local rig=Documents.Project(rawRig)
    for index,pipeline in ipairs(rawRig.Pipelines)do rig.Pipelines[index]=Data.Clone(workspace.Loader:Load(pipeline['$ref'].DocumentId))end
    return rig
   end
   check('@complete',function()
    local links=Documents.Project(camera);links.Idle=linkedRig(camera.Idle)
    for index,entry in ipairs(camera.Rigs)do links.Rigs[index].Asset=linkedRig(entry.Asset)end
    workspace:OnComplete({GameplayCameraSystem=links},workspace.Loader)
   end)
  end
 end)
 if not ok then baseline=false;issues[#issues+1]={path='',severity='error',message=tostring(problem)} end
 for id,message in pairs(rootErrors)do if message then issues[#issues+1]={path=entries[id] and entries[id].path or '',severity='error',message=message}end end
 sourceCache,sharedCache=workspace.Loader.RawAssets,workspace.Loader.SharedAssets
 view:Release()
 local dependencies={};for id in pairs(touched)do dependencies[#dependencies+1]=id end;table.sort(dependencies)
 return {issues=array(issues),checked=checked,full=not not full,dependencies=array(dependencies)}
end
for line in io.lines()do
 local ok,request=pcall(Json.Decode,line)
 if ok then
  local isJournal=request.operation=='journal'
  local success,result=pcall(isJournal and Journal.Handle or validate,request)
  if not success then
   if isJournal then result={error=tostring(result)}
   else baseline=false;result={issues=array({{path='',severity='error',message=tostring(result)}}),checked=0}end
  end
  reply(request.id,result)
 else reply(0,{issues=array({{path='',severity='error',message=tostring(request)}}),checked=0})end
end
