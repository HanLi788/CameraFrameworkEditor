-- Actual game database and filesystem; tests supply an isolated workspace copy.
local root=assert(arg[1]):gsub('\\','/')
package.path=root..'/?.lua;'..root..'/?/init.lua;'..package.path
require('CameraFramework.Test.Support')
_G.import=nil -- Use actual standard filesystem IO rather than the UE test double.
local Data=require('DatabaseSystem.Core.Data')
local Store=require('CameraFramework.DocumentStore')
local Editor=require('DatabaseSystem.Journal.EditorWAL')
local FileSystem=require('DatabaseSystem.Adaptation.FileSystem')
local fs=FileSystem.New()
local options={SourceRoot=root..'/CameraFramework/Assets'}
local store=Store.New(options)
assert(store.Database.EditorReport.Status~='Failed',store.Database.EditorReport.Error)
local function reply(id,result)io.write('HOST_RESULT:'..Data.Encode({id=id,result=result})..'\n');io.flush()end
local function summary(report)return {Status=report.Status,Error=report.Error,Stage=report.Stage,Accepted=report.Accepted,Skipped=report.Skipped}end
reply(0,{Status='Ready'})
for line in io.lines()do
 local request=Data.Decode(line)
 local ok,result=pcall(function()
  local db=store.Database
  if request.action=='reload'then return summary(db:Reload())end
  if request.action=='checkpoint'then return summary(db:Checkpoint())end
  if request.action=='reset'then store:Destroy();store=Store.New(options);return {Status='Ready'}end
  if request.action=='query'then local view=db:Read();local found=view:Query({DocumentId=request.documentId,Pointer=request.pointer or ''});view:Release();return {Value=found.Value}end
  if request.action=='submit'then
   local view=db:Read();local current=view:Query({DocumentId=request.documentId});view:Release()
   return summary(db:Submit({DocumentId=request.documentId,ExpectedRevision=current.DocumentRevision,Patch=request.patch}))
  end
  if request.action=='queue'then
   local file=options.SourceRoot..'/Editor.wal';local text=fs:Read(file).Text
   local batch=Editor.Decode(text,'Documents.index.json')
   if not request.patch then
    local ids=Data.Array();for _,command in ipairs(batch.Requests)do ids[#ids+1]=command.RequestId end
    return {SessionId=batch.Header.SessionId,Count=#ids,Ids=ids}
   end
   local view=db:Read();local current=view:Query({DocumentId=request.documentId}).Value;view:Release()
   local command={SessionId=batch.Header.SessionId,RequestId=request.requestId,DocumentId=request.documentId,ExpectedChecksum=Editor.DocumentChecksum(current),Patch=request.patch}
   assert(not fs:Append(file,Editor.Encode(command),#text).bConflict);return {Status='Queued'}
  end
  error('Unknown host action')
 end)
 reply(request.id,ok and result or {Error=tostring(result)})
end
store:Destroy()
