-- Read the selected workspace's declarative mapping without creating an Actor.
local function performanceNames(source)
    assert(type(source) == 'string', '缺少 ActorPerformance.lua')
    -- Mask comments and strings while keeping byte offsets for the declaration.
    local mask, index = {}, 1
    local function longEnd(at)
        local equals = source:sub(at):match('^%[(=*)%[')
        if equals == nil then return nil end
        local _, last = source:find(']' .. equals .. ']', at + #equals + 2, true)
        return last or #source
    end
    while index <= #source do
        local start, last = index, nil
        local character = source:sub(index, index)
        if source:sub(index, index + 1) == '--' then
            last = longEnd(index + 2) or ((source:find('\n', index + 2, true) or (#source + 1)) - 1)
        elseif character == '"' or character == "'" then
            index = index + 1
            while index <= #source do
                if source:sub(index,index) == '\\' then index = index + 2
                elseif source:sub(index,index) == character then last = index; break
                else index = index + 1 end
            end
            last = last or #source
        elseif character == '[' then last = longEnd(index) end
        if last then mask[#mask+1] = string.rep(' ', last-start+1); index = last+1
        else mask[#mask+1] = character; index = index+1 end
    end
    local code = table.concat(mask)
    local start = assert(code:match('%f[%w_]local%s+PerformanceTypes%s*=%s*()'), '未找到 PerformanceTypes 类别映射')
    assert(code:sub(start,start) == '{', 'PerformanceTypes 必须是声明式映射表')
    local depth, finish = 0, nil
    for at = start, #code do
        local character = code:sub(at,at)
        if character == '{' then depth = depth+1
        elseif character == '}' then depth = depth-1; if depth == 0 then finish=at; break end end
    end
    assert(finish, 'PerformanceTypes 映射表未闭合')
    local mapping = assert(load('return ' .. source:sub(start,finish), 'PerformanceTypes', 't', {}))()
    local keys = {}
    for key in pairs(mapping) do
        assert(type(key)=='number' and key%1==0, '表现类型映射键必须为整数')
        keys[#keys+1] = key
    end
    table.sort(keys)
    local names, seen = {}, {}
    for _, key in ipairs(keys) do
        local name = mapping[key]
        assert(type(name)=='string' and name:match('^PERFORMANCE_[A-Z0-9_]+$'), '表现类型映射值无效')
        if not seen[name] then names[#names+1]=name; seen[name]=true end
    end
    assert(#names>0, '表现类型映射为空')
    return names
end
return performanceNames
