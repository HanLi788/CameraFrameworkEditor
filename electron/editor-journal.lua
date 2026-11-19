-- Editor-owned bridge; all wire encoding and validation use the selected Lua project.
local Data=require('DatabaseSystem.Core.Data')
local Journal={}
local formalText,formalCache
local function decode(text)return Data.Document(Data.Decode(text))end
local function diff(before,after,path,operations)
 if Data.Equal(before,after)then return end
 if type(before)=='table' and before~=Data.JSON_NULL and type(after)=='table' and after~=Data.JSON_NULL
  and Data.Kind(before)=='Array' and Data.Kind(after)=='Array' and #before==#after then
  for index=1,#before do diff(before[index],after[index],path..'/'..(index-1),operations)end
  return
 end
 local object=type(before)=='table' and before~=Data.JSON_NULL and Data.Kind(before)=='Object'
  and type(after)=='table' and after~=Data.JSON_NULL and Data.Kind(after)=='Object'
 if not object then operations[#operations+1]={op='replace',path=path,value=after};return end
 local Pointer=require('DatabaseSystem.Core.Pointer')
 local keys,seen={},{}
 for key in pairs(before)do keys[#keys+1]=key;seen[key]=true end
 for key in pairs(after)do if not seen[key]then keys[#keys+1]=key end end
 table.sort(keys)
 for _,key in ipairs(keys)do
  local at=path..'/'..Pointer.Escape(key)
  if after[key]==nil then operations[#operations+1]={op='remove',path=at}
  elseif before[key]==nil then operations[#operations+1]={op='add',path=at,value=after[key]}
  else diff(before[key],after[key],at,operations)end
 end
end
function Journal.Handle(request)
 local WAL=require('DatabaseSystem.Journal.WAL')
 local Editor=require('DatabaseSystem.Journal.EditorWAL')
 local Patch=require('DatabaseSystem.Core.Patch')
 local Index=require('DatabaseSystem.Storage.Index')
 if request.formalText~=formalText then formalCache=WAL.Decode(request.formalText,'Documents.index.json');formalText=request.formalText end
 local formal=formalCache
 assert(not formal.Pending and not formal.bTornTail,'正式 WAL 尚未写完，请稍后重试')
 local batch=Editor.Decode(request.editorText,'Documents.index.json')
 assert(not batch.bPending,'编辑器队列尾部尚未写完，请稍后重试')
 local session=batch.Header.SessionId
 local accepted=formal.EditorRequests[session] or {}
 local queued={}
 for _,command in ipairs(batch.Requests)do
  local fingerprint=Editor.Fingerprint(command)
  assert(not queued[command.RequestId] or queued[command.RequestId]==fingerprint,'RequestId 内容冲突')
  queued[command.RequestId]=fingerprint
  if accepted[command.RequestId]then assert(accepted[command.RequestId]==fingerprint,'正式请求凭据不匹配')end
 end
 local acceptedCopy=Data.Object();for id,checksum in pairs(accepted)do acceptedCopy[id]=checksum end
 local receipt={SessionId=session,Accepted=acceptedCopy,Queued=Data.Object(queued),Commands=Data.Array(),Baselines=Data.Object()}
 if request.observe then return receipt end
 local index=Index.Decode(request.indexText,{})
 local indexChecksum=WAL.Checksum(request.indexText)
 local latest={}
 for _,change in ipairs(formal.Changes)do
  assert(change.IndexChecksum==indexChecksum,'正式 WAL 与索引不匹配，请重新进入游戏')
  latest[change.DocumentId]=change.After
 end
 local values={}
 local function current(id)
  if values[id]then return values[id]end
  local text=latest[id] or request.baselines[id]
  assert(text,'缺少修改前的逻辑文档：'..id)
  local value=decode(text);values[id]=value;receipt.Baselines[id]=Data.Encode(value)
  return value
 end
 local function apply(id,patch)
  local result=Patch.Apply(Data.Clone(current(id)),Patch.Copy(patch))
  assert(not result.Code,result.Error)
  values[id]=Data.Document(result.Value)
 end
 local selected={}
 for _,item in ipairs(request.items)do selected[item.documentId]=true end
 local seen={}
 for _,command in ipairs(batch.Requests)do
  if selected[command.DocumentId] and not accepted[command.RequestId] and not seen[command.RequestId]then
   assert(Editor.DocumentChecksum(current(command.DocumentId))==command.ExpectedChecksum,'编辑器队列逻辑基线不匹配：'..command.DocumentId)
   apply(command.DocumentId,command.Patch);seen[command.RequestId]=true
  end
 end
 for _,item in ipairs(request.items)do
  assert(item.sessionId==session,'编辑器会话已变化')
  local definition=assert(index.Definitions[item.documentId],'文档未登记')
  assert('Assets/'..definition.Path==item.path,'文档路径与索引不匹配')
  local command,line
  if item.line then
   local decoded=Editor.Decode(batch.HeaderText..item.line,'Documents.index.json')
   assert(#decoded.Requests==1 and not decoded.bPending,'重试命令损坏')
   command=decoded.Requests[1];line=item.line
   assert(command.RequestId==item.requestId and command.DocumentId==item.documentId,'重试命令身份不匹配')
  end
  if accepted[item.requestId] or queued[item.requestId]then
   assert(command,'缺少已提交请求的原始命令')
   assert((accepted[item.requestId] or queued[item.requestId])==Editor.Fingerprint(command),'请求内容不匹配')
   receipt.Commands[#receipt.Commands+1]={RequestId=item.requestId,Status=accepted[item.requestId] and 'Applied' or 'Queued',Line=line}
  else
   if not command then
    local operations=Data.Array();diff(decode(item.before),decode(item.after),'',operations)
    command={SessionId=session,RequestId=item.requestId,DocumentId=item.documentId,
     ExpectedChecksum=Editor.DocumentChecksum(current(item.documentId)),Patch=operations}
    line=Editor.Encode(command)
   end
   assert(Editor.DocumentChecksum(current(item.documentId))==command.ExpectedChecksum,'重试命令基线已变化：'..item.documentId)
   apply(item.documentId,command.Patch)
   receipt.Commands[#receipt.Commands+1]={RequestId=item.requestId,Status='Prepared',Line=line,LogicalAfter=Data.Encode(values[item.documentId])}
  end
 end
 return receipt
end
return Journal
