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
    if bundle.modules[name] then return assert(load(bundle.modules[name],name)) end
    return '\n\tModule not supplied: '..name
end)
package.loaded['Foundation.Serialization.JsonReader']=Json
package.loaded['Foundation.Adaptation.UETool']={ReadText=function(p) return bundle.files[p]~=nil,bundle.files[p] end}
package.loaded['Foundation.Adaptation.UEMath']={GetForwardVector=function(r)
    local p,y=math.rad(r.Pitch),math.rad(r.Yaw)
    return require('Foundation.Math.Vector3D').New(math.cos(p)*math.cos(y),math.cos(p)*math.sin(y),math.sin(p))
end}
package.loaded['Foundation.Adaptation.SluaAPI']={}
package.loaded['CameraFramework.Adaptation.UECamera']={}
package.loaded['CameraFramework.AssetLoading.AssetPaths']={GetRootDirectory=function() return '__editor__/Assets' end}
local function quote(s)
    return '"'..tostring(s):gsub('[%z\1-\31\\"]',function(c)
        local m={['"']='\\"',['\\']='\\\\',['\n']='\\n',['\r']='\\r',['\t']='\\t'}
        return m[c] or string.format('\\u%04x',string.byte(c))
    end)..'"'
end
local issues={};local checked=0
local ok,err=pcall(function()
    local catalog=require('CameraFramework.AssetLoading.AssetCatalog').GetDefault()
    local map={Value='Values',Range='Ranges',Smooth='Smoothing',Sensitivity='Sensitivity',Input='Inputs',Effect='Effects',Occlusion='Occlusion',Pipeline='Pipeline'}
    local ids={};for id in pairs(catalog.Entries) do ids[#ids+1]=id end;table.sort(ids)
    for _,id in ipairs(ids) do
        local entry=catalog.Entries[id]
        local valid,message=pcall(function()
            if entry.Type=='Curve' then require('CameraFramework.Curves.CurveLibrary').GetDefault():Resolve(id)
            elseif entry.Type=='Rig' then
                local raw=Json.Decode(bundle.files['__editor__/Assets/'..entry.Path])
                local pipeline=require('CameraFramework.Pipeline.AssetLibrary').GetDefault():Get(raw.PipelineAssetId)
                local space=assert(({Action='ActionCamera',Idle='IdleCamera',Battle='BattleCamera',Interactive='InteractiveCamera'})[pipeline.SpaceType],'Unknown space type')
                local prefix='CameraFramework.CameraSpaces.'..space
                local validator=require(prefix..(space=='IdleCamera' and '.Definition.Validator' or '.Rig.Definition.Validator'))
                require('CameraFramework.AssetLoading.DefinitionLoader').Load('__editor__/Assets/'..entry.Path,validator.Validate,require(prefix..'.PipelineRules').Environment(),id)
            else require('CameraFramework.'..assert(map[entry.Type])..'.AssetLibrary').GetDefault():Get(id) end
        end)
        if valid then checked=checked+1 else issues[#issues+1]='{"path":'..quote('Assets/'..entry.Path)..',"severity":"error","message":'..quote(message)..'}' end
    end
end)
if not ok then issues[#issues+1]='{"path":"Assets/Index.json","severity":"error","message":'..quote(err)..'}' end
io.write('EDITOR_RESULT:{"checked":'..checked..',"issues":['..table.concat(issues,',')..']}\n')
