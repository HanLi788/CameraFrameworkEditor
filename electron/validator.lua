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
package.loaded['CameraFramework.AssetLoading.AssetPaths']={GetRootDirectory=function() return '__editor__' end}
local function quote(s)
    return '"'..tostring(s):gsub('[%z\1-\31\\"]',function(c)
        local m={['"']='\\"',['\\']='\\\\',['\n']='\\n',['\r']='\\r',['\t']='\\t'}
        return m[c] or string.format('\\u%04x',string.byte(c))
    end)..'"'
end
local issues={};local checked=0
local ok,err=pcall(function()
    local map={Value='Values',Range='Ranges',Smooth='Smoothing',Sensitivity='Sensitivity',Input='Inputs',Effect='Effects',Occlusion='Occlusion',Pipeline='Pipeline'}
    for _,entry in ipairs(bundle.assets) do
        local file=entry.path
        local valid,message=pcall(function()
            if entry.type=='Curve' then require('CameraFramework.Curves.CurveLibrary').GetDefault():Resolve(file)
            elseif entry.type=='Rig' then
                local raw=Json.Decode(bundle.files['__editor__/'..file])
                local pipeline=require('CameraFramework.Pipeline.AssetLibrary').GetDefault():Get(assert(raw.Pipelines[1],'装置缺少管线'))
                local space=assert(({Action='ActionCamera',Idle='IdleCamera',Battle='BattleCamera',Interactive='InteractiveCamera'})[pipeline.SpaceType],'Unknown space type')
                local prefix='CameraFramework.CameraSpaces.'..space
                local validator=require(prefix..(space=='IdleCamera' and '.Definition.Validator' or '.Rig.Definition.Validator'))
                require('CameraFramework.AssetLoading.DefinitionLoader').Load('__editor__/'..file,validator.Validate,require(prefix..'.PipelineRules').Environment(),file)
            else require('CameraFramework.'..assert(map[entry.type])..'.AssetLibrary').GetDefault():Get(file) end
        end)
        if valid then checked=checked+1 else issues[#issues+1]='{"path":'..quote(file)..',"severity":"error","message":'..quote(message)..'}' end
    end
end)
if not ok then issues[#issues+1]='{"path":"","severity":"error","message":'..quote(err)..'}' end
io.write('EDITOR_RESULT:{"checked":'..checked..',"issues":['..table.concat(issues,',')..']}\n')
