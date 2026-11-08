-- Continuous sphere/triangle sweep over a static BVH.
-- Force floating point dot products: integer world coordinates otherwise overflow
-- Lua 5.4 integer arithmetic in the quadratic edge tests.
-- Coordinates match the camera framework: centimetres, Z up.
local Collision={}
local function dot(a,b) return 1.0*a[1]*b[1]+1.0*a[2]*b[2]+1.0*a[3]*b[3] end
local function sub(a,b) return {a[1]-b[1],a[2]-b[2],a[3]-b[3]} end
local function add(a,b,t) return {a[1]+b[1]*t,a[2]+b[2]*t,a[3]+b[3]*t} end
local function cross(a,b) return {a[2]*b[3]-a[3]*b[2],a[3]*b[1]-a[1]*b[3],a[1]*b[2]-a[2]*b[1]} end
local function inside(p,a,b,c)
    local v0,v1,v2=sub(b,a),sub(c,a),sub(p,a)
    local d00,d01,d11,d20,d21=dot(v0,v0),dot(v0,v1),dot(v1,v1),dot(v2,v0),dot(v2,v1)
    local den=d00*d11-d01*d01
    if math.abs(den)<1e-12 then return false end
    local u,v=(d11*d20-d01*d21)/den,(d00*d21-d01*d20)/den
    return u>=-1e-9 and v>=-1e-9 and u+v<=1+1e-9
end
local function sweep(p,d,r,t)
    local a,b,c={t[1],t[2],t[3]},{t[4],t[5],t[6]},{t[7],t[8],t[9]}
    local n=cross(sub(b,a),sub(c,a));local nlen=math.sqrt(dot(n,n))
    if nlen<1e-12 then return nil end
    for k=1,3 do n[k]=n[k]/nlen end
    local plane=dot(sub(p,a),n);local nearest
    local function accept(v) if v and v>=-1e-9 and v<=1 and (not nearest or v<nearest) then nearest=math.max(0,v) end end
    if math.abs(plane)<=r and inside(add(p,n,-plane),a,b,c) then return 0 end
    local speed=dot(d,n)
    if math.abs(speed)>1e-12 then for _,sign in ipairs({-1,1}) do
        local hit=(sign*r-plane)/speed
        if hit>=0 and hit<=1 and inside(add(add(p,d,hit),n,-sign*r),a,b,c) then accept(hit) end
    end end
    local dd=dot(d,d)
    for _,edge in ipairs({{a,b},{b,c},{c,a}}) do
        local start,finish=edge[1],edge[2];local ba,oa=sub(finish,start),sub(p,start)
        local bb,bo,bd=dot(ba,ba),dot(ba,oa),dot(ba,d)
        local fraction=bb>0 and math.max(0,math.min(1,bo/bb)) or 0
        local delta=sub(p,add(start,ba,fraction))
        if dot(delta,delta)<=r*r then return 0 end
        local qa,qb,qc=bb*dd-bd*bd,bb*dot(oa,d)-bo*bd,bb*dot(oa,oa)-bo*bo-r*r*bb
        local h=qb*qb-qa*qc
        if qa>1e-12 and h>=0 then local hit=(-qb-math.sqrt(h))/qa;local along=bo+hit*bd;if along>=0 and along<=bb then accept(hit) end end
        if dd>1e-12 then local bq=dot(oa,d);local disc=bq*bq-dd*(dot(oa,oa)-r*r);if disc>=0 then accept((-bq-math.sqrt(disc))/dd) end end
    end
    return nearest
end
local function intersects(b,p,d,r,maximum)
    local lo,hi=0,maximum
    for k=1,3 do
        if math.abs(d[k])<1e-12 then if p[k]<b[k]-r or p[k]>b[k+3]+r then return false end
        else local a,c=(b[k]-r-p[k])/d[k],(b[k+3]+r-p[k])/d[k];if a>c then a,c=c,a end;lo=math.max(lo,a);hi=math.min(hi,c);if lo>hi then return false end end
    end
    return true
end
function Collision.Trace(data,startLocation,endLocation,radius,walkableOnly)
    local p={startLocation.X,startLocation.Y,startLocation.Z};local d={endLocation.X-p[1],endLocation.Y-p[2],endLocation.Z-p[3]}
    local nearest,component;local stack={1}
    while #stack>0 do
        local node=data.nodes[table.remove(stack)]
        if intersects(node.b,p,d,radius,nearest or 1) then
            if node.s then for i=node.s,node.s+node.n-1 do local triangle=data.triangles[i];local eligible=true;if walkableOnly then local normal=cross({triangle[4]-triangle[1],triangle[5]-triangle[2],triangle[6]-triangle[3]},{triangle[7]-triangle[1],triangle[8]-triangle[2],triangle[9]-triangle[3]});eligible=math.abs(normal[3])>=math.sqrt(dot(normal,normal))*.7 end;local hit;if eligible then hit=sweep(p,d,radius,triangle) end;if hit and (not nearest or hit<nearest) then nearest,component=hit,triangle[10] end end
            else stack[#stack+1]=node.l;stack[#stack+1]=node.r end
        end
    end
    if nearest then return nearest*math.sqrt(dot(d,d)),component end
end
return Collision
