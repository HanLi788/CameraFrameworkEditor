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
package.loaded['CameraFramework.AssetLoading.AssetPaths']={GetRootDirectory=function() return '__editor__' end}
