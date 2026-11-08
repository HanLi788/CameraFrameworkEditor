// Display metadata only. Runtime channel names always come from the workspace Lua catalogue.
export const postGroups={
 DepthOfField:['景深','Depth of Field','post-focus'],Exposure:['曝光','Exposure','post-sun'],Bloom:['泛光','Bloom','post-bloom'],
 Vignette:['暗角','Vignette','post-vignette'],ColorGrading:['调色','Color Grading','post-palette'],Film:['胶片','Film','post-film'],
 ChromaticAberration:['色差','Chromatic Aberration','post-prism'],GlobalIllumination:['全局光照','Global Illumination','post-globe'],
 Lumen:['Lumen 光照','Lumen','post-lumen'],ScreenSpaceReflection:['屏幕空间反射','Screen Space Reflection','post-reflection'],
 AmbientCubemap:['环境立方体贴图','Ambient Cubemap','post-cube'],Camera:['相机','Camera','camera'],
 LocalExposure:['局部曝光','Local Exposure','post-local'],LensFlare:['镜头光晕','Lens Flare','post-flare'],
 ImageEffects:['图像效果','Image Effects','post-image'],FilmGrain:['胶片颗粒','Film Grain','post-grain'],
 AmbientOcclusion:['环境遮蔽','Ambient Occlusion','post-ao'],RayTracingAO:['光线追踪环境遮蔽','Ray Tracing AO','post-rayao'],
 MotionBlur:['运动模糊','Motion Blur','post-motion'],RayTracingTranslucency:['光线追踪半透明','Ray Tracing Translucency','post-glass'],
 PathTracing:['路径追踪','Path Tracing','post-path'],
};
export const postFields={
 FocusDistance:'对焦距离',FStop:'光圈值',ExposureCompensation:'曝光补偿',
 BloomIntensity:'泛光强度',BloomGaussianIntensity:'高斯泛光强度',BloomThreshold:'泛光阈值',BloomSizeScale:'泛光尺寸倍率',
 BloomConvolutionIntensity:'卷积泛光强度',BloomConvolutionScatterDispersion:'卷积散射扩散',BloomConvolutionSize:'卷积尺寸',BloomConvolutionCenterUV:'卷积中心 UV',
 BloomConvolutionPreFilterMin:'卷积预过滤最小值',BloomConvolutionPreFilterMax:'卷积预过滤最大值',BloomConvolutionPreFilterMult:'卷积预过滤倍率',BloomConvolutionBufferScale:'卷积缓冲区倍率',BloomDirtMaskIntensity:'污渍遮罩强度',BloomDirtMaskTint:'污渍遮罩色调',
 VignetteIntensity:'暗角强度',VignetteCenter:'暗角中心',VignetteColor:'暗角颜色',VignetteSize:'暗角尺寸',VignetteSoftness:'暗角柔和度',
 WhiteTemperature:'白平衡色温',WhiteTint:'白平衡色调',ColorCorrectionHighlightsMin:'高光校正下限',ColorCorrectionHighlightsMax:'高光校正上限',ColorCorrectionShadowsMax:'阴影校正上限',
 BlueCorrection:'蓝色校正',ExpandGamut:'色域扩展',ToneCurveAmount:'色调曲线强度',SceneColorTint:'场景颜色色调',ColorGradingIntensity:'调色强度',
 FilmSlope:'胶片斜率',FilmToe:'胶片趾部',FilmShoulder:'胶片肩部',FilmBlackClip:'黑色裁剪',FilmWhiteClip:'白色裁剪',
 ChromaticAberrationIntensity:'色差强度',ChromaticAberrationStartOffset:'色差起始偏移',IndirectLightingColor:'间接光照颜色',IndirectLightingIntensity:'间接光照强度',
 LumenSceneLightingQuality:'Lumen 场景光照质量',LumenSceneDetail:'Lumen 场景细节',LumenSceneViewDistance:'Lumen 场景视距',LumenSceneLightingUpdateSpeed:'Lumen 场景光照更新速度',
 LumenFinalGatherQuality:'Lumen 最终聚集质量',LumenFinalGatherLightingUpdateSpeed:'Lumen 最终聚集光照更新速度',LumenMaxTraceDistance:'Lumen 最大追踪距离',LumenDiffuseColorBoost:'Lumen 漫反射颜色增强',
 LumenAmbientOcclusionIntensity:'Lumen 环境遮蔽强度',LumenSkylightLeaking:'Lumen 天光泄漏',LumenSkylightLeakingTint:'Lumen 天光泄漏色调',LumenFullSkylightLeakingDistance:'Lumen 完全天光泄漏距离',LumenReflectionQuality:'Lumen 反射质量',LumenMaxRoughnessToTraceReflections:'Lumen 反射追踪最大粗糙度',
 ScreenSpaceReflectionIntensity:'屏幕空间反射强度',ScreenSpaceReflectionQuality:'屏幕空间反射质量',ScreenSpaceReflectionMaxRoughness:'屏幕空间反射最大粗糙度',
 AmbientCubemapTint:'环境立方体贴图色调',AmbientCubemapIntensity:'环境立方体贴图强度',CameraShutterSpeed:'快门速度',CameraISO:'感光度 ISO',
 AutoExposureLowPercent:'自动曝光低百分位',AutoExposureHighPercent:'自动曝光高百分位',AutoExposureMinBrightness:'自动曝光最小亮度',AutoExposureMaxBrightness:'自动曝光最大亮度',AutoExposureSpeedUp:'自动曝光提亮速度',AutoExposureSpeedDown:'自动曝光压暗速度',HistogramLogMin:'直方图对数下限',HistogramLogMax:'直方图对数上限',
 LocalExposureHighlightContrastScale:'局部曝光高光对比度倍率',LocalExposureShadowContrastScale:'局部曝光阴影对比度倍率',LocalExposureHighlightThreshold:'局部曝光高光阈值',LocalExposureShadowThreshold:'局部曝光阴影阈值',LocalExposureDetailStrength:'局部曝光细节强度',LocalExposureBlurredLuminanceBlend:'局部曝光模糊亮度混合',LocalExposureBlurredLuminanceKernelSizePercent:'局部曝光模糊亮度核尺寸百分比',LocalExposureHighlightThresholdStrength:'局部曝光高光阈值强度',LocalExposureShadowThresholdStrength:'局部曝光阴影阈值强度',LocalExposureMiddleGreyBias:'局部曝光中灰偏移',
 LensFlareIntensity:'镜头光晕强度',LensFlareTint:'镜头光晕色调',LensFlareBokehSize:'镜头光晕散景尺寸',LensFlareThreshold:'镜头光晕阈值',Sharpen:'锐化',
 FilmGrainIntensity:'胶片颗粒强度',FilmGrainIntensityShadows:'阴影颗粒强度',FilmGrainIntensityMidtones:'中间调颗粒强度',FilmGrainIntensityHighlights:'高光颗粒强度',FilmGrainShadowsMax:'颗粒阴影上限',FilmGrainHighlightsMin:'颗粒高光下限',FilmGrainHighlightsMax:'颗粒高光上限',FilmGrainScale:'颗粒尺寸倍率',
 AmbientOcclusionIntensity:'环境遮蔽强度',AmbientOcclusionStaticFraction:'环境遮蔽静态比例',AmbientOcclusionRadius:'环境遮蔽半径',AmbientOcclusionFadeDistance:'环境遮蔽淡出距离',AmbientOcclusionFadeRadius:'环境遮蔽淡出半径',AmbientOcclusionPower:'环境遮蔽幂次',AmbientOcclusionBias:'环境遮蔽偏移',AmbientOcclusionQuality:'环境遮蔽质量',AmbientOcclusionMipBlend:'环境遮蔽 Mip 混合',AmbientOcclusionMipScale:'环境遮蔽 Mip 倍率',AmbientOcclusionMipThreshold:'环境遮蔽 Mip 阈值',AmbientOcclusionTemporalBlendWeight:'环境遮蔽时域混合权重',
 RayTracingAOIntensity:'光线追踪环境遮蔽强度',RayTracingAORadius:'光线追踪环境遮蔽半径',
 DepthOfFieldMinFstop:'最小光圈值',DepthOfFieldSensorWidth:'传感器宽度',DepthOfFieldSqueezeFactor:'挤压系数',DepthOfFieldDepthBlurAmount:'深度模糊强度',DepthOfFieldDepthBlurRadius:'深度模糊半径',DepthOfFieldPetzvalBokeh:'Petzval 散景',DepthOfFieldPetzvalBokehFalloff:'Petzval 散景衰减',DepthOfFieldPetzvalExclusionBoxExtents:'Petzval 排除框半尺寸',DepthOfFieldPetzvalExclusionBoxRadius:'Petzval 排除框半径',DepthOfFieldAspectRatioScalar:'景深宽高比倍率',DepthOfFieldBarrelRadius:'镜筒半径',DepthOfFieldBarrelLength:'镜筒长度',DepthOfFieldFocalRegion:'对焦区域',DepthOfFieldNearTransitionRegion:'近处过渡区域',DepthOfFieldFarTransitionRegion:'远处过渡区域',DepthOfFieldScale:'景深倍率',DepthOfFieldNearBlurSize:'近处模糊尺寸',DepthOfFieldFarBlurSize:'远处模糊尺寸',DepthOfFieldOcclusion:'景深遮蔽',DepthOfFieldSkyFocusDistance:'天空对焦距离',DepthOfFieldVignetteSize:'景深暗角尺寸',
 MotionBlurAmount:'运动模糊强度',MotionBlurMax:'运动模糊最大值',MotionBlurPerObjectSize:'运动模糊逐对象尺寸',RayTracingTranslucencyMaxRoughness:'光线追踪半透明最大粗糙度',PathTracingMaxPathIntensity:'路径追踪最大路径强度',
};
for(const [key,label] of Object.entries({Saturation:'饱和度',Contrast:'对比度',Gamma:'伽马',Gain:'增益',Offset:'偏移'})){
 postFields[key]=label;
 for(const [suffix,prefix] of Object.entries({Shadows:'阴影',Midtones:'中间调',Highlights:'高光'}))postFields[key+suffix]=prefix+label;
}
for(let i=1;i<=6;i++){postFields[`Bloom${i}Size`]=`第 ${i} 层泛光尺寸`;postFields[`Bloom${i}Tint`]=`第 ${i} 层泛光色调`;}
const words=name=>name.replace(/([A-Z]+)([A-Z][a-z])/g,'$1 $2').replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/([a-z])([0-9])/g,'$1 $2').replace(/Fstop/g,'F-stop').replace(/^FStop$/,'F-stop');
export function postGroupLabel(group,language){const entry=postGroups[group];return entry?entry[language==='en'?1:0]:words(group);}
export function postGroupIcon(group){return postGroups[group]?.[2]||'sliders';}
export function postChannelLabel(channel,language){
 const component=channel.component,base=component?channel.name.slice(0,-component.length):channel.name;
 const label=language==='en'?words(base):postFields[base]||words(base);
 return label+(component?' · '+component:'');
}
export function matchesPostChannel(channel,query){
 const q=query.trim().toLowerCase();return !q||[channel.name,channel.native,postChannelLabel(channel,'zh'),postChannelLabel(channel,'en'),postGroupLabel(channel.group,'zh'),postGroupLabel(channel.group,'en')].join(' ').toLowerCase().includes(q);
}
