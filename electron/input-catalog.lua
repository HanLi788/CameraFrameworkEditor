-- Read actual workspace modules through their engine filesystem boundary.
table.insert(package.searchers, 1, function(name)
    if bundle.modules[name] then return assert(load(bundle.modules[name], name)) end
    return '\n\tModule not supplied: ' .. name
end)
package.loaded['Foundation.Serialization.JsonReader'] = Json
local directory = '__content__/Lua/InputSystem/MyIMC/Definition/Definitions'
package.loaded['Foundation.Adaptation.UETool'] = {
    GetProjectDirectory = function(kind) assert(kind == 'Content') return '__content__' end,
    ListDirectory = function(path, pattern, files, folders, recursive)
        assert(path == directory and files and not folders and not recursive)
        local names = {}
        for name in pairs(bundle.files) do names[#names + 1] = name end
        return true, names
    end,
    ReadText = function(path)
        local name = path:sub(#directory + 2)
        assert(path:sub(1, #directory + 1) == directory .. '/')
        return bundle.files[name] ~= nil, bundle.files[name]
    end,
}
local function quote(value)
    return '"' .. tostring(value):gsub('[%z\1-\31\\"]', function(c)
        local escapes = {['"']='\\"', ['\\']='\\\\', ['\n']='\\n', ['\r']='\\r', ['\t']='\\t'}
        return escapes[c] or string.format('\\u%04x', string.byte(c))
    end) .. '"'
end
local contexts = {}
local issues = {}
local function issue(path, message)
    issues[#issues + 1] = '{"path":' .. quote(path) .. ',"severity":"error","message":' .. quote(message) .. '}'
end
local ok, message = pcall(function()
    local Registry = require('InputSystem.MyIMC.Config.FileRegistry')
    local Reader = require('InputSystem.MyIMC.Config.Reader')
    local registry = Registry.Scan()
    for index, name in ipairs(registry.IMCNameList) do
        local file = registry.FileNameMap[name]
        local valid, definition = pcall(Reader.Read, Registry.GetFilePath(file))
        local mappings = {}
        if valid then
            local names = {}
            for mappingName in pairs(definition.Mappings) do names[#names + 1] = mappingName end
            table.sort(names)
            for mappingIndex, mappingName in ipairs(names) do mappings[#mappings + 1] = quote(mappingName) end
        else issue('InputSystem/MyIMC/Definition/Definitions/' .. file, definition) end
        contexts[#contexts + 1] = '{"name":' .. quote(name) .. ',"mappings":[' .. table.concat(mappings, ',') .. ']' .. (valid and '' or ',"error":' .. quote(definition)) .. '}'
    end
end)
if not ok then issue('InputSystem/MyIMC/Definition/Definitions', message) end
io.write('INPUT_CATALOG:{"contexts":[' .. table.concat(contexts, ',') .. '],"issues":[' .. table.concat(issues, ',') .. ']}\n')
