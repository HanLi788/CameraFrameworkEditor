-- A small event-driven host. Camera decisions stay inside the project's framework.
local Vector = require('Foundation.Math.Vector3D')
local Rotator = require('Foundation.Math.Rotator')
local Dispatcher = require('Foundation.Event.Dispatcher.EventDispatcher')
local PlayerEvents = require('Actor.Player.PlayerEvents')
local Runtime = require('CameraFramework.Runtime')
local Channels = require('CameraFramework.CameraSystem.Core.InputChannels')
local options, preset = bundle.options, bundle.options.preset
local movementMultiplier=options.movementMultiplier or 1
local frameRate=options.frameRate or 60
local frameRates={[30]=true,[60]=true,[90]=true,[120]=true}
assert(frameRates[frameRate], '无效模拟帧率')
local function point(v) return Vector.New(v[1],v[2],v[3]) end
local dispatcher = Dispatcher.New()
for _, group in pairs(PlayerEvents) do for _, event in pairs(group) do dispatcher:AddEvent(event) end end
local inputRuntime = require('InputSystem.InputManager').New()
local handle = inputRuntime:GetInputHandle()
local numberType = require('InputSystem.Common.InputValue').VALUE_TYPES.NUMBER
handle:ActivateIMCList({'System','Character'})
local held, pendingActions = {}, {}
for _,name in ipairs({'MoveForward','MoveRight','Jump','Dash'}) do
    assert(handle:HasMapping('Character',name),'Character/'..name..' mapping is required')
end
for name,actionName in pairs({Jump='jump',Dash='dash'}) do
    handle:SubscribeMappingEvent('Character',name,'SourceStarted',held,function()
        pendingActions[#pendingActions+1]=actionName;return false
    end)
end
local function rawInput(signals)
    for _,event in ipairs(signals or {}) do
        if event.kind=='clear' then
            for name in pairs(held) do inputRuntime:OnReleased(name,0,numberType) end
            held={};pendingActions={}
        elseif event.kind=='pressed' then
            if not held[event.name] then inputRuntime:OnPressed(event.name,1,numberType);held[event.name]=true end
        elseif event.kind=='released' then
            inputRuntime:OnReleased(event.name,0,numberType);held[event.name]=nil
        elseif event.kind=='changed' then inputRuntime:OnChanged(event.name,event.value,numberType)
        end
    end
end
local controller = {Rotation=Rotator.Zero()}
function controller:GetInputHandle() return handle end
local world = {PlayerController=controller,ViewportSize={X=1600,Y=900},Obstacles={},MeshComponents={}}
world.MeshCollision=options.mapCollision~=false and previewCollision or nil
if previewCollision then for i,name in ipairs(previewCollision.meshes) do world.MeshComponents[i]={Name=name,Materials={}} end end
local owner=Adapters.UETool.SpawnActor(world,nil,point(preset.spawn))
owner.Controller=controller;owner.Velocity=Vector.Zero()
owner.Capsule={Location=owner.Location,Radius=34,HalfHeight=88}
function owner:GetController() return self.Controller end
function owner:GetVelocity() return self.Velocity end
function owner:SubscribeEvent(...) return dispatcher:Subscribe(...) end
function owner:UnsubscribeEvent(token) return dispatcher:Unsubscribe(token) end
if bundle.modules['Actor.Player.MovementValues'] then
    for name,fn in pairs(require('Actor.Player.MovementValues')) do owner[name]=fn end
end
local npcPosition=point(preset.target);if not preset.procedural and options.environment~='basic' then npcPosition.Y=npcPosition.Y+160 end
local npcs={}
local definitions=options.npcs
if not definitions then definitions=options.environment~='explore' and {{id='guide',name='NPC 9999',position={npcPosition.X,npcPosition.Y,npcPosition.Z},heading=180,dialogueId=9999}} or {} end
for _,definition in ipairs(definitions) do
    local actor=Adapters.UETool.SpawnActor(world,nil,point(definition.position))
    actor.Id=definition.dialogueId;actor.ActorId=definition.id;actor.Name=definition.name;actor.Rotation.Yaw=definition.heading
    actor.Capsule={Location=actor.Location,Radius=32,HalfHeight=88};npcs[#npcs+1]=actor
end
local npc=npcs[1]
local bindings={
    Walk={PlayerEvents.Player.WalkStarted,PlayerEvents.Player.WalkEnded},
    Jog={PlayerEvents.Player.JogStarted,PlayerEvents.Player.JogEnded},
    Run={PlayerEvents.MoveAbilityComp.RunStarted,PlayerEvents.MoveAbilityComp.RunEnded},
    Jump={PlayerEvents.Player.JumpStarted,PlayerEvents.Player.JumpEnded},
    Dash={PlayerEvents.DashAbilityComp.DashStarted,PlayerEvents.DashAbilityComp.DashEnded},
}
local paths={Default='Assets/CameraAssets/IdleCamera/Player/Default/Default.rig',Dialogue='Assets/CameraAssets/InteractiveCamera/Player/Dialogue/Dialogue.rig'}
local rigs={}
local runtime=Runtime.New():Setup(owner,function(m)
    for _,name in ipairs({'Walk','Jog','Run','Jump','Dash'}) do
        paths[name]='Assets/CameraAssets/ActionCamera/Player/'..name..'/'..name..'.rig'
        rigs[name]=m:AddActionRig(paths[name],name,{bindings[name][1]},{bindings[name][2]})
    end
    if npc then rigs.Dialogue=m:AddInteractiveRig(paths.Dialogue,'Dialogue',{PlayerEvents.Interactive.DialogueStarted},{PlayerEvents.Interactive.DialogueEnded}) end
end)
local manager=runtime.CameraSystem
-- Observe actual pipeline contributions at the host boundary; never evaluate mappings in JS.

-- Fail before play if this project has not mounted the preview NPC's configuration.
for _,actor in ipairs(npcs) do require('CameraFramework.CameraSystem.CameraSpaces.InteractiveCamera.Rig.Definition.TargetValues').RequireId(rigs.Dialogue.Config,actor.Id) end
local time, events, action = 0, {}, nil
local dialogue, dialogueStarted, dialogueClosing = false,false,false
local grounded, verticalSpeed, dashTime, cooldown = true,0,0,0
local dashDirection=Vector.New(1,0,0)
local function publish(event,payload,label)
    dispatcher:Publish(event,payload or {})
    events[#events+1]={event=label,time=time,id=payload and payload.Id}
    if #events>32 then table.remove(events,1) end
end
local function setAction(name)
    if name==action then return end
    if action then publish(bindings[action][2],{Reason='StateChanged'},action..'Ended') end
    action=name
    if action then publish(bindings[action][1],{Player=owner},action..'Started') end
end
local function ground(x,y,top,bottom)
    if not previewCollision then return top>=0 and bottom<=0 and 0 or nil end
    local hit=Collision.Trace(previewCollision,Vector.New(x,y,top),Vector.New(x,y,bottom),0,true)
    return hit and top-hit or nil
end
if options.pose and options.environment=='explore' then
    local p=options.pose.position
    if p and type(p.X)=='number' and type(p.Y)=='number' and type(p.Z)=='number' and math.abs(p.X)<=6400 and math.abs(p.Y)<=6400 then
        local height=ground(p.X,p.Y,p.Z+100,p.Z-300)
        if height then owner.Location=Vector.New(p.X,p.Y,height+88);owner.Capsule.Location=owner.Location;owner.Rotation.Yaw=options.pose.heading or 0 end
    end
end
local allActors={owner};for _,actor in ipairs(npcs) do allActors[#allActors+1]=actor end
for _,actor in ipairs(allActors) do
    local p=actor.Location;local height=ground(p.X,p.Y,p.Z+100,p.Z-250)
    if height then p.Z=height+88 end
end
local function canTalk()
    if not grounded or dashTime>0 or dialogue or dialogueClosing then return false end
    local nearest,distance=nil,360
    for _,candidate in ipairs(npcs) do
        local length=(candidate.Location-owner.Location):Length()
        if length<=distance then
            local visible=true
            if previewCollision then
                local a,b=owner.Location+Vector.New(0,0,45),candidate.Location+Vector.New(0,0,45)
                local hit=Collision.Trace(previewCollision,a,b,0);visible=not hit or hit>=(b-a):Length()-5
            end
            if visible then nearest=candidate;distance=length end
        end
    end
    npc=nearest or npcs[1];return nearest~=nil
end
-- Sweep three body spheres through static triangles; slide by trying each axis.
local function moveHorizontal(dx,dy)
    local origin=owner.Location
    local function allowed(x,y,z)
        local length=math.sqrt(x*x+y*y);local fraction=1
        if previewCollision and length>0 then
            for _,height in ipairs({-52,0,52}) do
                local a=origin+Vector.New(0,0,height+z)
                local hit=Collision.Trace(previewCollision,a,a+Vector.New(x,y,0),32)
                if hit then fraction=math.min(fraction,math.max(0,(hit-.5)/length)) end
            end
        end
        -- The NPC is an actual static collision body, independent of camera fading.
        for _,actor in ipairs(npcs) do
            local a=Vector.New(origin.X-actor.Location.X,origin.Y-actor.Location.Y,0)
            local n=x*x+y*y
            if n>0 and math.abs(origin.Z-actor.Location.Z)<160 then
                local b=a.X*x+a.Y*y;local c=a.X*a.X+a.Y*a.Y-68*68;local disc=b*b-n*c
                if disc>=0 then local f=(-b-math.sqrt(disc))/n;if f>=0 and f<=1 then fraction=math.min(fraction,math.max(0,f-.01)) end end
            end
        end
        return fraction
    end
    local f=allowed(dx,dy,0)
    if f<1 and grounded then
        local raised=allowed(dx,dy,22)
        local floor=ground(origin.X+dx,origin.Y+dy,origin.Z-88+24,origin.Z-88-8)
        if raised==1 and floor then origin.Z=floor+88;f=1 end
    end
    if f==1 then origin.X=origin.X+dx;origin.Y=origin.Y+dy
    else
        local fx=allowed(dx,0,0);origin.X=origin.X+dx*fx
        local fy=allowed(0,dy,0);origin.Y=origin.Y+dy*fy
    end
end
runtime:Update(0)
local function closeDialogue()
    if not dialogue then return end
    dialogue=false;dialogueClosing=true
    if dialogueStarted then publish(PlayerEvents.Interactive.DialogueEnded,{Reason='Closed'},'DialogueEnded') end
end
local function step(dt,signals,commands)
    time=time+dt;cooldown=math.max(0,cooldown-dt)
    Adapters.UETool.InputTime=time
    rawInput(signals)
    inputRuntime:Update()
    for _,name in ipairs(pendingActions) do commands[#commands+1]=name end
    pendingActions={}
    for _,command in ipairs(commands) do
        if command=='dialogue' and canTalk() then
            dialogue=true;dialogueStarted=false;dashTime=0;setAction(nil)
        elseif command=='close-dialogue' and dialogue then
            closeDialogue()
        elseif command=='jump' and grounded and not dialogue and not dialogueClosing and dashTime<=0 then
            grounded=false;verticalSpeed=500
        elseif command=='dash' and cooldown<=0 and grounded and not dialogue and not dialogueClosing then
            dashTime=.3;cooldown=.9;dashDirection=Vector.New(math.cos(math.rad(owner.Rotation.Yaw)),math.sin(math.rad(owner.Rotation.Yaw)),0)
        end
    end
    local locked=dialogue or dialogueClosing
    local x=handle:GetMappingValue('Character','MoveForward')
    local y=handle:GetMappingValue('Character','MoveRight')
    local input={}
    -- The sample assigns sprint/walk to ability slots; dedicated mappings take precedence.
    for name,slot in pairs({Run='AbilitySlot06',Walk='AbilitySlot09'}) do
        local mapping=handle:HasMapping('Character',name) and name or slot
        input[name:lower()]=handle:HasMapping('Character',mapping) and handle:GetMappingValue('Character',mapping)>0
    end
    local length=math.sqrt(x*x+y*y)
    local speed=locked and 0 or (input.run and 500 or input.walk and 150 or 280)*movementMultiplier
    local yaw=math.rad(manager.Output.FinalState.CameraRot.Yaw)
    local normalizer=math.max(1,length)
    local direction=Vector.New((x*math.cos(yaw)-y*math.sin(yaw))/normalizer,(x*math.sin(yaw)+y*math.cos(yaw))/normalizer,0)
    if dashTime>0 then direction=dashDirection;speed=1000;dashTime=math.max(0,dashTime-dt) end
    if locked then direction=Vector.Zero() end
    local previous=owner.Location:Clone()
    moveHorizontal(direction.X*speed*dt,direction.Y*speed*dt)
    if direction:Length()>0 then owner.Rotation.Yaw=math.deg(math.atan(direction.Y,direction.X)) end
    local p=owner.Location;local feet=p.Z-88
    local floor=ground(p.X,p.Y,feet+24,feet-30)
    if grounded and not floor then grounded=false end
    if grounded then p.Z=floor+88;verticalSpeed=0
    else
        verticalSpeed=verticalSpeed-980*dt
        local nextZ=p.Z+verticalSpeed*dt
        if verticalSpeed>0 and previewCollision then
            local hit=Collision.Trace(previewCollision,p+Vector.New(0,0,52),Vector.New(p.X,p.Y,nextZ+52),32)
            if hit then nextZ=p.Z+math.max(0,hit-.5);verticalSpeed=0 end
        end
        local landing=verticalSpeed<=0 and ground(p.X,p.Y,p.Z-88+1,nextZ-88-2) or nil
        if landing then p.Z=landing+88;grounded=true;verticalSpeed=0 else p.Z=nextZ end
    end
    if p.Z < preset.spawn[3]-2000 then
        owner.Location=point(preset.spawn);p=owner.Location;previous=p:Clone();verticalSpeed=0;grounded=true;dashTime=0;setAction(nil)
        events[#events+1]={event='Respawn',time=time}
    end
    owner.Capsule.Location=p;owner.Velocity=(p-previous)*(1/dt)
    local moving=math.sqrt(owner.Velocity.X^2+owner.Velocity.Y^2)>1
    if locked then setAction(nil) else setAction(dashTime>0 and 'Dash' or not grounded and 'Jump' or moving and (input.run and 'Run' or input.walk and 'Walk' or 'Jog') or nil) end
    -- The framework arbitrates camera-space ownership. Wait for Action to release it.
    if dialogue and not dialogueStarted and not manager.CurrentRig and not manager.RequestedRig then
        publish(PlayerEvents.Interactive.DialogueStarted,{Id=npc.Id,Target=npc,ActorId=npc.ActorId},'DialogueStarted');dialogueStarted=true
    end
    runtime:Update(dt)
    if dialogueClosing and not manager.CurrentRig and not manager.RequestedRig then dialogueClosing=false;dialogueStarted=false end
end
local function values(state)
    local result={};for _,d in ipairs(Channels.GetDefinitions()) do result[d.Name]=Channels.Read(state,d) end;return result
end
local function vector(v) return {X=v.X,Y=v.Y,Z=v.Z} end
local function sample()
    local available=canTalk();local actorFrames={}
    for _,actor in ipairs(npcs) do actorFrames[#actorFrames+1]={id=actor.ActorId,name=actor.Name,dialogueId=actor.Id,position={actor.Location.X,actor.Location.Y,actor.Location.Z},heading=actor.Rotation.Yaw} end
    local current=manager.ActiveCameraSpace or manager:GetCameraSpace('Idle')
    local request=manager.CurrentRig;local rig=request and rigs[request.Name]
    local phase=not request and 'Idle' or manager.bRigExiting and 'Exiting' or rig:IsEnterTransitioning() and 'Entering' or 'Holding'
    local output=manager.Output.FinalState;local opacity={}
    for i,c in ipairs(world.MeshComponents) do local m=c.Materials[0];if m and m.Parameters and m.Parameters.Opacity then opacity[tostring(i)]=m.Parameters.Opacity end end
    return {npcs=actorFrames,frameRate=frameRate,deltaTime=1/frameRate,postProcessing=runtime.PostProcessing:GetValues(),mode='game',time=time,phase=phase,hold=0,space=request and request.CameraType or 'Idle',rigName=request and request.Name or 'Default',rigPath=paths[request and request.Name or 'Default'],
        environment=options.environment,worldKey=options.worldKey,seed=options.seed,version=options.version,owner=vector(owner.Location),subject=npc and vector(npc.Location) or nil,heading=owner.Rotation.Yaw,subjectHeading=npc and npc.Rotation.Yaw or nil,
        movementMultiplier=movementMultiplier,speed=math.sqrt(owner.Velocity.X^2+owner.Velocity.Y^2),grounded=grounded,ability=action or 'Idle',dialogue=dialogue,dialogueClosing=dialogueClosing,npcId=npc and npc.Id or nil,canTalk=available,
        target=values(current.CameraContext.TargetFrameState),render=values(current.CameraContext.RenderFrameState),output=values(output),
        location=vector(output.CameraLoc),forward=vector(Adapters.UEMath.GetForwardVector(output.CameraRot)),up=vector(Adapters.UEMath.GetUpVector(output.CameraRot)),
        projection=require('CameraFramework.CameraSystem.GlobalConfig').CameraComponent.ProjectionMode,meshOpacity=opacity,events=events,inputRuntime='InputSystem',activeIMCs=handle:GetActiveIMCNames()}
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
            for i=1,command.count do step(1/frameRate,i==1 and command.signals or {},i==1 and command.actions or {}) end
            return {frame=sample()}
        elseif command.kind=='frame-rate' then
            assert(frameRates[command.frameRate], '无效模拟帧率')
            frameRate=command.frameRate
            return {frame=sample()}
        elseif command.kind=='movement-settings' then
            local value=command.movementMultiplier
            assert(type(value)=='number' and value>=0.25 and value<=4,'无效移动倍率')
            movementMultiplier=value;return {frame=sample()}
        elseif command.kind=='clear-input' then
            rawInput({{kind='clear'}});inputRuntime:Update();pendingActions={};return {frame=sample()}
        elseif command.kind=='interaction' then
            assert(command.action=='close-dialogue','未知交互');closeDialogue();return {frame=sample()}
        elseif command.kind=='stop' then runtime:Destroy();inputRuntime:Destroy();return {stopped=true}
        else error('未知预览命令') end
    end,debug.traceback)
    if not ok then reply({error=tostring(result)});break end
    reply(result)
    if result.stopped then break end
end
