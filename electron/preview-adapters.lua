local Rotator  = require("Foundation.Math.Rotator")
local Vector3D = require("Foundation.Math.Vector3D")

-- 桌面预览的宿主边界：数学、Actor、碰撞与输出适配，不替换框架处理器。

-- 将角度转换为弧度。
local function degreesToRadians(value)
    return value * math.pi / 180
end

-- 计算旋转对应的三个正交基向量。
local function getAxes(rotation)
    local pitch    = degreesToRadians(rotation.Pitch)
    local yaw      = degreesToRadians(rotation.Yaw)
    local roll     = degreesToRadians(rotation.Roll)
    local sinPitch = math.sin(pitch)
    local cosPitch = math.cos(pitch)
    local sinYaw   = math.sin(yaw)
    local cosYaw   = math.cos(yaw)
    local sinRoll  = math.sin(roll)
    local cosRoll  = math.cos(roll)
    return {
        Forward = Vector3D.New(cosPitch * cosYaw, cosPitch * sinYaw, sinPitch),
        Right = Vector3D.New(
            sinRoll * sinPitch * cosYaw - cosRoll * sinYaw,
            sinRoll * sinPitch * sinYaw + cosRoll * cosYaw,
            -sinRoll * cosPitch
        ),
        Up = Vector3D.New(
            -(cosRoll * sinPitch * cosYaw + sinRoll * sinYaw),
            cosYaw * sinRoll - cosRoll * sinPitch * sinYaw,
            cosRoll * cosPitch
        ),
    }
end

-- 计算预览插值使用的归一化步长。
local function interpAlpha(dt, speed)
    return (speed or 0) <= 0 and 1 or math.max(0, math.min((dt or 0) * speed, 1))
end

local UEMath = {}

-- 模拟向量插值，并限制剩余距离。
function UEMath.VInterpTo(current, target, dt, speed, maximumDistance)
    local result    = current + (target - current) * interpAlpha(dt, speed)
    local remaining = target - result
    if maximumDistance ~= nil and remaining:Length() > maximumDistance then
        result = target - remaining:Normalize() * maximumDistance
    end
    return result
end

-- 模拟按最短角度差进行的旋转插值。
function UEMath.RInterpTo(current, target, dt, speed)
    local alpha = interpAlpha(dt, speed)
    return Rotator.New(
        current.Pitch + Rotator.NormalizeAngle(target.Pitch - current.Pitch) * alpha,
        current.Yaw + Rotator.NormalizeAngle(target.Yaw - current.Yaw) * alpha,
        current.Roll + Rotator.NormalizeAngle(target.Roll - current.Roll) * alpha
    ):Normalize()
end

-- 模拟标量插值，并限制剩余差值。
function UEMath.FInterpTo(current, target, dt, speed, maximumOffset)
    local result    = current + (target - current) * interpAlpha(dt, speed)
    local remaining = target - result
    if maximumOffset ~= nil and math.abs(remaining) > maximumOffset then
        result = target - (remaining > 0 and maximumOffset or -maximumOffset)
    end
    return result
end

-- 将外部三维向量转换为 Lua 向量。
function UEMath.ToVector(value)
    return Vector3D.New(value.X, value.Y, value.Z)
end

-- 将外部旋转转换为 Lua 旋转。
function UEMath.ToRotator(value)
    return Rotator.New(value.Pitch, value.Yaw, value.Roll)
end

-- 取得旋转对应的前向向量。
function UEMath.GetForwardVector(rotation)
    return getAxes(rotation).Forward
end

-- 取得旋转对应的右向向量。
function UEMath.GetRightVector(rotation)
    return getAxes(rotation).Right
end

-- 取得旋转对应的上向向量。
function UEMath.GetUpVector(rotation)
    return getAxes(rotation).Up
end

-- 计算两点连线的朝向。
function UEMath.GetRotationByDir(startLocation, endLocation)
    local direction  = endLocation - startLocation
    local horizontal = math.sqrt(direction.X * direction.X + direction.Y * direction.Y)
    return Rotator.New(
        math.deg(math.atan(direction.Z, horizontal)),
        math.deg(math.atan(direction.Y, direction.X)),
        0
    )
end

-- 将局部位置按缩放和旋转转换到世界空间。
function UEMath.SubSpaceLocToWorldLoc(localLocation, rotation, origin, scale)
    local value = localLocation
    if scale ~= nil then
        value = Vector3D.New(
            localLocation.X * scale.X,
            localLocation.Y * scale.Y,
            localLocation.Z * scale.Z
        )
    end
    local axes   = getAxes(rotation)
    local result = axes.Forward * value.X + axes.Right * value.Y + axes.Up * value.Z
    return origin ~= nil and result + origin or result
end

-- 模拟向量绕指定轴旋转。
function UEMath.RotateAngleAxis(value, angleDegrees, axis)
    local radians        = degreesToRadians(angleDegrees)
    local normalizedAxis = axis:Normalize()
    return value * math.cos(radians) +
        Vector3D.Cross(normalizedAxis, value) * math.sin(radians) +
        normalizedAxis * Vector3D.Dot(normalizedAxis, value) * (1 - math.cos(radians))
end

-- 通用对象操作与文件接口使用 Foundation 对象，相机专属操作使用独立对象。
local UETool = {ReadText=function(path) return bundle.files[path]~=nil,bundle.files[path] end}
-- Fixed simulation time and bundled files are the only engine boundary for InputSystem.
UETool.InputTime = 0
function UETool.GetTime() return UETool.InputTime end
function UETool.GetProjectDirectory(kind) assert(kind=='Content');return '__content__' end
function UETool.ListDirectory(directory,pattern,files,folders,recursive)
    assert(directory=='__content__/Lua/InputSystem/MyIMC/Definition/Definitions' and files and not folders and not recursive)
    local names={}
    for file in pairs(bundle.files) do
        local name=file:sub(#directory+2)
        if file:sub(1,#directory+1)==directory..'/' and name:match('^[^/]+%.json$') then names[#names+1]=name end
    end
    table.sort(names);return true,names
end

-- 仿真真实 Actor 的速度查询能力，接口缺失仍报告不可用。
function UETool.CanGetActorVelocity(actor) return actor ~= nil and type(actor.GetVelocity) == "function" end

-- 返回独立速度向量。
function UETool.GetActorVelocity(actor)
    local velocity = actor:GetVelocity()
    return Vector3D.New(velocity.X, velocity.Y, velocity.Z)
end
local UECamera = {}
UETool.TraceHitDistance = nil

-- 从查询对象实时取得世界。
function UETool.GetWorld(worldContext)
    return worldContext:GetWorld()
end

-- 模拟按世界查询默认玩家控制器。
function UETool.GetPlayerController(world, playerIndex)
    return world.PlayerController
end

-- 模拟 Owner 当前控制器查询，支持临时失去控制器。
function UETool.GetOwnerPlayerController(owner)
    if type(owner.GetController) == "function" then
        return owner:GetController()
    end
    return UETool.GetPlayerController(UETool.GetWorld(owner))
end

-- 读取预览 Actor 的位置副本。
function UETool.GetActorLocation(actor)
    return actor.Location:Clone()
end

-- 读取预览 Actor 的旋转副本。
function UETool.GetActorRotation(actor)
    return actor.Rotation:Clone()
end

-- 读取预览胶囊体的位置。
function UETool.GetCapsuleLoc(capsule)
    return (capsule.Location or Vector3D.Zero()):Clone()
end

-- 读取预览胶囊体的半径。
function UETool.GetCapsuleRadius(capsule)
    return capsule.Radius or 34
end

-- 读取预览胶囊体的半高。
function UETool.GetCapsuleHalfHeight(capsule)
    return capsule.HalfHeight or 88
end

-- 按预览视口宽高比换算垂直视场角。
function UECamera.GetCameraVFOV(camera, horizontalFOV)
    local aspectRatio = camera and camera.AspectRatio or 16 / 9
    return math.deg(2 * math.atan(math.tan(math.rad(horizontalFOV) * 0.5) / aspectRatio))
end

-- 模拟构图使用的实际取景比例。
function UECamera.GetCameraAspectRatio(camera, owner)
    return camera and camera.AspectRatio or 16 / 9
end

-- 从本帧状态模拟有效画幅，不读取上一帧提交给组件的参数。
function UECamera.GetFrameAspectRatio(state, owner, componentConfig)
    if componentConfig.bConstrainAspectRatio then return state.Projection.AspectRatio, true end
    local viewport = owner.World and owner.World.ViewportSize
    if viewport and viewport.X > 0 and viewport.Y > 0 then return viewport.X / viewport.Y, false end
    return state.Projection.AspectRatio, true
end

-- 安装时恢复该组件最近提交的镜头设置；首次安装沿用共享状态默认值。
function UECamera.ReadCameraSettings(actor, state)
    local settings = actor.Camera.FrameState
    if settings then
        local snapshot = state:BuildSnapshot()
        snapshot.Projection = settings.Projection
        state:ReadSnapshot(snapshot)
    end
    return state
end

-- 记录统一组件策略，运行时帧状态不包含后处理接管标记。
function UECamera.ConfigureCameraComponent(actor, config)
    local camera = actor.Camera
    camera.PostProcessBlendWeight = config.PostProcessBlendWeight
    camera.ProjectionMode = config.ProjectionMode
    camera.bConstrainAspectRatio = config.bConstrainAspectRatio
    if not camera.PostProcessSettings then
        camera.PostProcessSettings = {}
        for _, field in ipairs(require("CameraFramework.PostProcessing.Adaptation.PostProcessFields").GetFields()) do
            camera.PostProcessSettings[field.Native] = require("CameraFramework.Shared.AssetLoading.Copy")(field.Default)
            camera.PostProcessSettings[field.OverrideName] = false
        end
    end
    camera.bOverrideAspectRatioAxisConstraint = config.bOverrideAspectRatioAxisConstraint
    camera.AspectRatioAxisConstraint = config.AspectRatioAxisConstraint
    camera.bAutoCalculateOrthoPlanes = config.bAutoCalculateOrthoPlanes
    camera.bUpdateOrthoPlanes = config.bUpdateOrthoPlanes

end

-- 在适配边界记录完整输出，生产相机仍调用同一个正式提交入口。
function UECamera.ApplyFrameState(actor, state, changes)
    if not changes or changes.CameraLoc then UETool.SetActorLocation(actor, state.CameraLoc) end
    if not changes or changes.CameraRot then UETool.SetActorRotation(actor, state.CameraRot) end
    if not changes or changes.CameraFOV then UECamera.SetCameraFOV(actor, state.CameraFOV) end
    actor.Camera.FrameState = state:BuildSnapshot()
    actor.Camera.AspectRatio = state.Projection.AspectRatio
    return true
end

-- 模拟借用 Actor 的有效性，不要求真实 UE 对象。
function UETool.IsActorValid(actor)
    return actor ~= nil and actor.bDestroyed ~= true
end

-- 构图预览使用与生产适配一致的本地胶囊快照。
function UECamera.GetCameraCompositionBody(actor)
    if actor.GetCameraCompositionBody then return actor:GetCameraCompositionBody() end
    local capsule = actor.GetCapsuleComponent and actor:GetCapsuleComponent() or actor.Capsule
    return {
        Center = capsule and UETool.GetCapsuleLoc(capsule) or UETool.GetActorLocation(actor),
        Axis = capsule and UEMath.GetUpVector(capsule.Rotation or Rotator.Zero()) or Vector3D.New(0, 0, 1),
        Radius = capsule and UETool.GetCapsuleRadius(capsule) or 0,
        HalfHeight = capsule and UETool.GetCapsuleHalfHeight(capsule) or 0,
    }
end

-- 创建支持宿主 Add 协议的预览 Actor 数组。
function UETool.CreateActorArr()
    local result = {ValueList = {}}
    -- 向预览数组追加一个 Actor。
    function result:Add(actor)
        table.insert(self.ValueList, actor)
    end
    return result
end

-- 创建可写入命中信息的预览结果。
function UETool.CreateHitResult()
    return {Distance = 0, Component = nil}
end

-- 记录查询世界并返回预设的遮挡命中结果。
-- 球心到 AABB 的距离是凸函数；先求最近点，再二分首次接触，包含圆角。
function UETool.SphereTraceSingle(world, startLocation, endLocation, radius, channel, bComplex, ignoreActors, debugMode, hitResult)
    local direction=endLocation-startLocation
    local length=direction:Length()
    local nearest,component
    for _,box in ipairs(world.Obstacles or {}) do
        if box.Enabled then
            local function distance(t)
                local p=startLocation+direction*t
                local sum=0
                for _,axis in ipairs({"X","Y","Z"}) do
                    local d=math.max(math.abs(p[axis]-box.Location[axis])-box.HalfSize[axis],0)
                    sum=sum+d*d
                end
                return sum
            end
            local lo,hi=0,1
            for _=1,48 do
                local a,b=(2*lo+hi)/3,(lo+2*hi)/3
                if distance(a)<distance(b) then hi=b else lo=a end
            end
            local middle=(lo+hi)/2
            if distance(middle)<=radius*radius+1e-8 then
                lo,hi=0,middle
                if distance(0)>radius*radius then
                    for _=1,48 do local m=(lo+hi)/2 if distance(m)<=radius*radius then hi=m else lo=m end end
                else hi=0 end
                if not nearest or hi<nearest then nearest,component=hi,box end
            end
        end
    end
    if world.MeshCollision then
        local distance,index=Collision.Trace(world.MeshCollision,startLocation,endLocation,radius)
        if distance and (not nearest or distance<nearest*length) then
            hitResult.Distance=distance;hitResult.Component=world.MeshComponents[index];return true
        end
    end
    if not nearest then return false end
    hitResult.Distance=nearest*length;hitResult.Component=component
    return true
end

-- 创建记录资源路径的材质对象。
function UETool.LoadMaterial(path)
    return {Path = path}
end

-- 创建独立的动态材质对象。
function UETool.CreateDynamicMaterialInstance(parentMaterial)
    return {ParentMaterial = parentMaterial, Parameters = {}}
end

-- 读取有效预览组件的指定材质槽。
function UETool.GetComponentMaterial(component, materialSlot)
    assert(not component.bDestroyed, "不能读取失效组件的材质")
    return component.Materials and component.Materials[materialSlot] or nil
end

-- 修改有效预览组件的指定材质槽。
function UETool.SetComponentMaterial(component, materialSlot, material)
    assert(not component.bDestroyed, "不能修改失效组件的材质")
    component.Materials               = component.Materials or {}
    component.Materials[materialSlot] = material
end

-- 记录动态材质的标量参数。
function UETool.SetDynamicMaterialScalarParameter(material, name, value)
    material.Parameters[name] = value
end

-- 在指定预览世界中创建 Actor 对象，并保存生成时的位置和旋转。
function UETool.SpawnActor(world, blueprintPath, location, rotation)
    UETool.SpawnCount = (UETool.SpawnCount or 0) + 1
    local actor = {
        Camera = {},
        World = world,
        BlueprintPath = blueprintPath,
        Location = (location or Vector3D.Zero()):Clone(),
        Rotation = (rotation or Rotator.Zero()):Clone(),
    }
    -- 提供相机跨世界复用检查所需的接口。
    function actor:GetWorld()
        return self.World
    end
    return actor
end

-- 标记预览 Actor 已销毁。
function UETool.DestroyActor(actor)
    if actor ~= nil then
        actor.DestroyCount = (actor.DestroyCount or 0) + 1
        actor.bDestroyed = true
    end
end

-- 记录提交到预览 Actor 的位置副本。
function UETool.SetActorLocation(actor, location)
    actor.Location = location:Clone()
end

-- 记录提交到预览 Actor 的旋转副本。
function UETool.SetActorRotation(actor, rotation)
    actor.Rotation = rotation:Clone()
end

-- 记录提交到相机对象的视场角。
function UECamera.SetCameraFOV(actor, fov)
    actor.Camera.FOV = fov
end

-- 记录提交到控制器对象的旋转。
function UETool.SetPlayerControllerRotation(controller, rotation)
    controller.Rotation = rotation:Clone()
end

-- 记录视图提交所使用的实时控制器。
function UECamera.SetViewTargetWithBlend(controller, actor, blendTime, blendFunction, blendExp, bLockOutgoing)
    controller.ViewTarget = actor
    controller.BlendTime = blendTime
    controller.bLockOutgoing = bLockOutgoing
    controller.ViewTargetCallCount = (controller.ViewTargetCallCount or 0) + 1
end

function UECamera.ResolveViewBlendFunction(value)
    if value == nil then return "EaseInOut" end
    for index, name in ipairs({"Linear", "Cubic", "EaseIn", "EaseOut", "EaseInOut", "PreBlended"}) do
        if value == name or value == index - 1 then return name end
    end
    error("不支持的相机混合曲线：" .. tostring(value))
end

local SluaAPI = {}
-- 判断预览对象是否仍然有效。
function SluaAPI.IsValid(value)
    return value ~= nil and not (type(value) == "table" and (value.bLuaWrapper == true or value.bDestroyed == true))
end

-- 取得预览 Lua 包装对象背后的宿主对象。
function SluaAPI.GetUObject(value)
    if type(value) == "table" and value.bLuaWrapper == true then
        return value.Object
    end
    return value
end

-- 检查预览包装对象背后的宿主对象是否有效。
function SluaAPI.IsUObjectValid(value)
    local object = SluaAPI.GetUObject(value)
    return object ~= nil and SluaAPI.IsValid(object)
end

package.loaded["Foundation.Adaptation.UEMath"]=UEMath
package.loaded["Foundation.Adaptation.UETool"]=UETool
package.loaded["Foundation.Adaptation.SluaAPI"]=SluaAPI
package.loaded["CameraFramework.CameraSystem.Adaptation.UECamera"]=UECamera
return {UETool=UETool,UEMath=UEMath,UECamera=UECamera,SluaAPI=SluaAPI}
