-- The JSON decoder itself is bootstrapped from the selected framework's source.
-- Node provides UTF-8 sources/data, so Lua's ANSI filesystem APIs never touch project paths.
local function bootstrapJson(text)
    -- bundle.modules contains the JSON decoder source; use a minimal JSON string scanner
    -- only for extracting that source before the framework decoder can parse the bundle.
    local key='"Foundation.Serialization.JsonReader":'
    local p=assert(text:find(key,1,true))+ #key
    assert(text:sub(p,p)=='"'); p=p+1
    local out={}
    while p<=#text do
        local c=text:sub(p,p);p=p+1
        if c=='"' then break end
        if c=='\\' then
            local e=text:sub(p,p);p=p+1
            local escapes={['"']='"',['\\']='\\',['/']='/',n='\n',r='\r',t='\t',b='\b',f='\f'}
            if e=='u' then local code=tonumber(text:sub(p,p+3),16);p=p+4;c=utf8.char(code) else c=assert(escapes[e]) end
        end
        out[#out+1]=c
    end
    return table.concat(out)
end
local Json=assert(load(bootstrapJson(bundleText),'JsonReader'))()
local bundle=Json.Decode(bundleText)
table.insert(package.searchers,1,function(name)
    if package.preload[name] then return package.preload[name] end
    if bundle.modules[name] then return assert(load(bundle.modules[name],name)) end
    return '\n\tModule not supplied: '..name
end)
package.loaded['Foundation.Serialization.JsonReader']=Json

local function quote(value)
 return '"'..tostring(value):gsub('[%z\1-\31\\"]',function(c)
  local escapes={['"']='\\"',['\\']='\\\\',['\n']='\\n',['\r']='\\r',['\t']='\\t'}
  return escapes[c] or string.format('\\u%04x',string.byte(c))
 end)..'"'
end
local checked=0
local ok,message=pcall(function()
 local Workspace=require('CameraFramework.Editor.Workspace')
 local workspace=Workspace.New({Root='__editor__/Assets',ReadText=function(file)return assert(bundle.files[file],'Missing asset: '..file)end})
 -- Check source-only fields before execution configuration drops diagnostic extras.
 local original=workspace.OnSource
 function workspace:OnSource(file,raw)
  original(self,file,raw)
  local Validator=require('Foundation.Validation.ValueValidator')
  local allowed=file:match('%.sensitivity$') and {Type=true,bEnabled=true,EscapeCurve=true,ReturnCurve=true}
   or file:match('%.smooth$') and {Type=true,bEnabled=true,SpeedRange=true,MaxLag=true,ResponseCurve=true}
  if allowed then for name,node in pairs(raw.Channels)do Validator.ValidateAllowedFields(node,allowed,file..'.Channels.'..name)end end
  if file:match('%.effect$')then require('CameraFramework.Editor.GameplayCameraSystem.AssetLoading.Effects.AssetDefinition').ValidateOutputs(raw.Outputs,file..'.Outputs',false,require('CameraFramework.Editor.Validation.EffectContract').ValidateDomain(raw.Source,raw.Domain,file))end
 end
 workspace:Build()
 for _,asset in ipairs(bundle.assets)do
  local key=asset.path:match('^Assets/(.*)$')
  if key and Workspace.IsAsset(key)then assert(workspace.Files[key],'Framework 未覆盖资产：'..key);checked=checked+1 end
 end
end)
io.write('EDITOR_RESULT:{"checked":'..checked..',"issues":['..(ok and '' or '{"path":"","severity":"error","message":'..quote(message)..'}')..']}\n')
