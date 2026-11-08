local Vector=require('Foundation.Math.Vector3D')
local Rotator=require('Foundation.Math.Rotator')
local Event=require('Foundation.Event.Dispatcher.DispatcherEvent')
local Rule=require('Foundation.Event.Dispatcher.DispatchRule')
local Dispatcher=require('Foundation.Event.Dispatcher.EventDispatcher')
local Runtime=require('CameraFramework.Runtime')
local Channels=require('CameraFramework.CameraSystem.Core.InputChannels')
local options=bundle.options
local preset=options.preset
local function point(v) return Vector.New(v[1],v[2],v[3]) end
local pipeline=require('CameraFramework.CameraSystem.Pipeline.AssetLibrary').GetDefault():Get(options.pipelinePath)
local space=pipeline.SpaceType
local dispatcher=Dispatcher.New()
local started,ended=Event.New('Preview.Start',Rule.BROADCAST),Event.New('Preview.End',Rule.BROADCAST)
dispatcher:AddEvent(started);dispatcher:AddEvent(ended)
local handle={Active={}}
function handle:HasMapping(imc,name) return true end
function handle:GetMappingValue(imc,name) return 0 end
function handle:ActivateIMC(name) self.Active[name]=true end
function handle:DeactivateIMC(name) self.Active[name]=false end
function handle:IsIMCActive(name) return self.Active[name]==true end
local controller={Rotation=Rotator.Zero()}
function controller:GetInputHandle() return handle end
local world={PlayerController=controller,ViewportSize={X=1600,Y=900},Obstacles={}}
world.MeshCollision=options.mapCollision~=false and previewCollision or nil
world.MeshComponents={}
if world.MeshCollision then for i,name in ipairs(world.MeshCollision.meshes) do world.MeshComponents[i]={Name=name,Materials={}} end end
local owner=Adapters.UETool.SpawnActor(world,nil,point(preset.spawn))
owner.Velocity=Vector.New(options.speed or 0,0,0)
owner.Controller=controller
owner.Capsule={Location=owner.Location,Radius=34,HalfHeight=88}
function owner:GetController() return self.Controller end
function owner:GetVelocity() return self.Velocity end
function owner:SubscribeEvent(...) return dispatcher:Subscribe(...) end
function owner:UnsubscribeEvent(token) return dispatcher:Unsubscribe(token) end
local target=Adapters.UETool.SpawnActor(world,nil,point(preset.target))
target.Capsule={Location=target.Location,Radius=34,HalfHeight=88}
world.Obstacles[1]={Enabled=options.obstacle==true,Location=Vector.New(-180,0,100),HalfSize=Vector.New(35,80,100),Materials={}}

-- 预览角色可提供项目业务侧的只读移动查询；不在框架内登记效果来源。
if bundle.modules['Actor.Player.MovementValues'] then
    local values=require('Actor.Player.MovementValues')
    for name,fn in pairs(values) do if type(fn)=='function' then owner[name]=fn end end
end
-- 闲置没有注册装置入口，按选中的文件替换本次模拟的闲置加载入口。
if space=='Idle' then
    local loader=require('CameraFramework.CameraSystem.CameraSpaces.IdleCamera.Definition.Loader')
    loader.Load=function(environment)
        return require('CameraFramework.CameraSystem.AssetLoading.DefinitionLoader').Load(
            require('CameraFramework.Shared.AssetLoading.PathLibrary').Resolve('Rig',options.rigPath),
            require('CameraFramework.CameraSystem.CameraSpaces.IdleCamera.Definition.Validator').Validate,environment,options.rigPath)
    end
end
local rig
local runtime=Runtime.New():Setup(owner,function(m)
    if space=='Action' then rig=m:AddActionRig(options.rigPath,'Preview',{started},{ended})
    elseif space=='Interactive' then rig=m:AddInteractiveRig(options.rigPath,'Preview',{started},{ended})
    elseif space=='Battle' then rig=m:AddBattleRig(options.rigPath,'Preview',{started},{},{ended}) end
end)
local manager=runtime.CameraSystem
if space=='Interactive' then require('CameraFramework.CameraSystem.CameraSpaces.InteractiveCamera.Rig.Definition.TargetValues').RequireId(rig.Config,options.id) end
local phase,time,hold='Idle',0,0
local events={}
local function change(nextPhase)
    phase=nextPhase;events[#events+1]={phase=phase,time=time}
end
if rig and rig.SubscriptionEnterTransitionEvent then
    rig:SubscriptionEnterTransitionEvent(require('CameraFramework.CameraSystem.Events.Rig.TransitionEvents').ENTER_COMPLETED,nil,function()
        hold=0;change('Holding')
    end)
end
runtime:Update(0)
local function channelValues(state)
    local values={}
    for _,d in ipairs(Channels.GetDefinitions()) do values[d.Name]=Channels.Read(state,d) end
    return values
end
local function vector(v) return {X=v.X,Y=v.Y,Z=v.Z} end
local function sample()
    local current=manager.ActiveCameraSpace or manager:GetCameraSpace('Idle')
    local output=manager.Output.FinalState
    local rot=output.CameraRot
    local opacity={}
    for i,component in ipairs(world.MeshComponents) do local m=component.Materials[0];if m and m.Parameters and m.Parameters.Opacity then opacity[tostring(i)]=m.Parameters.Opacity end end
    return {postProcessing=runtime.PostProcessing:GetValues(),phase=phase,time=time,hold=hold,rigPath=options.rigPath,space=space,environment=options.environment,motion=options.motion or 'idle',meshOpacity=opacity,heading=owner.Rotation.Yaw,speed=owner.Velocity:Length(),
        target=channelValues(current.CameraContext.TargetFrameState),render=channelValues(current.CameraContext.RenderFrameState),
        output=channelValues(output),location=vector(output.CameraLoc),
        forward=vector(Adapters.UEMath.GetForwardVector(rot)),up=vector(Adapters.UEMath.GetUpVector(rot)),
        projection=require('CameraFramework.CameraSystem.GlobalConfig').CameraComponent.ProjectionMode,
        owner=vector(owner.Location),subject=vector(target.Location),obstacle=world.Obstacles[1].Enabled,
        obstacleOpacity=world.Obstacles[1].Materials[0] and world.Obstacles[1].Materials[0].Parameters and world.Obstacles[1].Materials[0].Parameters.Opacity or 1,events=events}
end
local activated=false
local function step(dt)
    assert(dt>0 and dt<=0.1,'无效模拟步长')
    if not activated and rig then
        activated=true;change('Entering')
        dispatcher:Publish(started,{Id=options.id,Target=target})
    end
    time=time+dt
    if options.motion=='patrol' and math.abs(options.speed or 0)>0 then
        local a,b=point(preset.route[1]),point(preset.route[2]);local delta=b-a;local distance=delta:Length()
        local offset=point(preset.spawn)-a;local initial=(offset.X*delta.X+offset.Y*delta.Y+offset.Z*delta.Z)/distance
        local travel=(initial+time*math.abs(options.speed))%(distance*2);local forward=travel<=distance
        local fraction=(forward and travel or distance*2-travel)/distance
        owner.Location=a+delta*fraction;owner.Capsule.Location=owner.Location
        owner.Velocity=delta:Normalize()*math.abs(options.speed)*(forward and 1 or -1)
        owner.Rotation.Yaw=math.deg(math.atan(owner.Velocity.Y,owner.Velocity.X))
        target.Location=owner.Location+(point(preset.target)-point(preset.spawn));target.Capsule.Location=target.Location
    end
    local wasHolding=phase=='Holding'
    if wasHolding then
        hold=hold+dt
        if hold>=2-1e-9 then change('Exiting');dispatcher:Publish(ended,{}) end
    end
    runtime:Update(dt)
    if space=='Battle' and phase=='Entering' and manager.CurrentRig then hold=0;change('Holding') end
    if phase=='Exiting' and manager.SelectedCameraSpaceType=='Idle' and not manager.CurrentRig then change('Idle') end
end
local function encode(value)
    if type(value)=='string' then return '"'..value:gsub('[%z\1-\31\\"]',function(c)
        local escapes={['"']='\\"',['\\']='\\\\',['\n']='\\n',['\r']='\\r',['\t']='\\t'}
        return escapes[c] or string.format('\\u%04x',string.byte(c)) end)..'"' end
    if type(value)=='number' then assert(value==value and math.abs(value)<math.huge,'非有限输出');return string.format('%.17g',value) end
    if type(value)=='boolean' then return tostring(value) end
    if value==nil then return 'null' end
    local parts={}
    if #value>0 or value==events then for i,v in ipairs(value) do parts[i]=encode(v) end return '['..table.concat(parts,',')..']' end
    for k,v in pairs(value) do parts[#parts+1]=encode(tostring(k))..':'..encode(v) end
    return '{'..table.concat(parts,',')..'}'
end
local function reply(value) io.write('PREVIEW:'..encode(value)..'\n');io.flush() end
reply({ready=true,frame=sample()})
for line in io.lines() do
    local ok,result=xpcall(function()
        local command=Json.Decode(line)
        if command.kind=='step' then
            assert(type(command.count)=='number' and command.count%1==0 and command.count>=1 and command.count<=120,'无效帧数')
            for _=1,command.count do step(1/60) end
            return {frame=sample()}
        elseif command.kind=='stop' then runtime:Destroy();return {stopped=true}
        else error('未知预览命令') end
    end,debug.traceback)
    if not ok then reply({error=tostring(result)});break end
    reply(result)
    if result.stopped then break end
end
