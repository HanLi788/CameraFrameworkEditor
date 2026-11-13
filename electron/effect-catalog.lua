table.insert(package.searchers,1,function(name)
    if package.preload[name] then return package.preload[name] end
    if bundle.modules[name] then return assert(load(bundle.modules[name],name)) end
    return '\n\tModule not supplied: '..name
end)
package.loaded['Foundation.Serialization.JsonReader']=Json
package.loaded['Foundation.Adaptation.UEMath']={}
package.loaded['Foundation.Adaptation.UETool']={}

local function quote(value)
    return '"'..tostring(value):gsub('[%z\1-\31\\"]',function(c)
        local escapes={['"']='\\"',['\\']='\\\\',['\n']='\\n',['\r']='\\r',['\t']='\\t'}
        return escapes[c] or string.format('\\u%04x',string.byte(c))
    end)..'"'
end
local function encode(value,key)
    if type(value)=='string' then return quote(value) end
    if type(value)~='table' then return tostring(value) end
    local array=key=='performanceTypes' or key=='postObjects' or key=='Bindings' or key=='postProcessing' or key=='channels' or key=='objects' or key=='interfaces' or key=='Params' or key=='Enum'
    local parts={}
    if array then for _,v in ipairs(value) do parts[#parts+1]=encode(v) end
    else for k,v in pairs(value) do parts[#parts+1]=quote(k)..':'..encode(v,k) end end
    return (array and '[' or '{')..table.concat(parts,',')..(array and ']' or '}')
end
local objects,channels,postProcessing,postObjects={},{},{},{}
local ok,message=pcall(function()
    for _,definition in ipairs(require('CameraFramework.GameplayCameraSystem.States.FrameStateDefinition').GetChannels()) do channels[#channels+1]=definition.Name end
    for _,channel in ipairs(require('CameraFramework.PostProcessingSystem.Adaptation.PostProcessFields').GetChannels()) do
        postProcessing[#postProcessing+1]={name=channel.Name,group=channel.Field.Group,field=channel.Field.Field,native=channel.Field.Native,component=channel.Component,default=channel.Default,min=channel.Min,max=channel.Max,minimum=channel.Field.Minimum,maximum=channel.Field.Maximum,positive=channel.Field.Positive}
    end
    local function catalogue(registry,output,contexts)
        local names={};for name in pairs(registry) do names[#names+1]=name end;table.sort(names)
        for _,name in ipairs(names) do
            local interfaces={};local methods={};for method in pairs(registry[name].Interfaces or registry[name]) do methods[#methods+1]=method end;table.sort(methods)
            for _,method in ipairs(methods) do interfaces[#interfaces+1]={name=method,definition=(registry[name].Interfaces or registry[name])[method]} end
            output[#output+1]={name=name,interfaces=interfaces,provider=contexts and contexts[name].Provider}
        end
    end
    catalogue(require('CameraFramework.Editor.Validation.EffectContract').ValidateRegistry(),objects)
    local registry=require('CameraFramework.InterfaceRegistry.PostProcessingSystem.InterfaceRegistry')
    require('CameraFramework.Editor.Validation.PostProcessSource').Contract(registry)
    catalogue(registry.Interfaces,postObjects,registry.Contexts)

end)
local performanceOk,performanceTypes=pcall(readPerformanceNames,bundle.modules['CameraFramework.GameplayCameraSystem.Adaptation.ActorPerformance'])
local performanceTypeIssue=performanceOk and '' or tostring(performanceTypes)
if not performanceOk then performanceTypes={} end
local issue=ok and '' or '{"path":"InterfaceRegistry/GameplayCameraSystem/InterfaceRegistry.lua","severity":"error","message":'..quote(message)..'}'
io.write('EFFECT_CATALOG:{"objects":'..encode(ok and objects or {},'objects')..',"channels":'..encode(channels,'channels')..',"postProcessing":'..encode(postProcessing,'postProcessing')..',"postObjects":'..encode(postObjects,'postObjects')..',"performanceTypes":'..encode(performanceTypes,'performanceTypes')..',"performanceTypeIssue":'..quote(performanceTypeIssue)..',"issues":['..issue..']}\n')
