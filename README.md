# CameraFrameworkEditor · 相机框架编辑器 v0.6.0

独立 Windows 桌面编辑器，直接编辑所选 Lua 工作区中的相机资产。当前接入 `GameplayCameraSystem`、`PostProcessingSystem` 与 `Shared` 三份 Framework 入口，资产协议统一为版本 1。

## 启动

首次运行，在工具根目录执行：

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd start
```

已有发布包时，运行 `release/win-unpacked/相机框架编辑器.exe`。免安装目录应整体复制；安装包位于 `release/CameraFrameworkEditor-0.6.0-Setup.exe`。发布包包含 Lua 与 Electron，使用者无需安装 Node.js 或 UE。

启动后选择包含 `CameraFramework`、`Foundation`、`InputSystem` 的 Lua 目录，也可直接选择其中的 `CameraFramework`。目录位置由用户选择，不依赖工具所在盘符。

## 资产与路径

内容浏览器中的文件路径相对于 `CameraFramework/`，JSON 内的资产引用相对于 `CameraFramework/Assets/`：

```text
文件：Assets/Shared/CurveAssets/Bezier/Linear.curve
引用：Shared/CurveAssets/Bezier/Linear.curve
```

| 用途 | 文件后缀 |
|---|---|
| 框架入口 | `.share`、`.camera`、`.postProcessing` |
| 装置与管线 | `.rig`、`.pipeline` |
| 用户输入、聚焦与解除聚焦输入 | `.userInput`、`.transitionInput` |
| 聚焦与解除聚焦目标值 | `.transitionValue` |
| 相机参数 | `.range`、`.sensitivity`、`.smooth`、`.occlusion`、`.effect`、`.curve` |
| 后处理环境、数值效果、布尔效果、滤镜 | `.virtualInput`、`.numEffect`、`.boolEffect`、`.filter` |

三个入口分别为 `Assets/Shared/Framework.share`、`Assets/GameplayCameraSystem/Framework.camera`、`Assets/PostProcessingSystem/Framework.postProcessing`。所有交付资产必须从入口可达。共享资产位于 `Shared/`；其他资产按所属系统放置。

## 编辑与保存

- 左侧仅显示文件夹，默认收起，用于选择内容目录；文件操作集中在底部内容浏览器。目录导航不提供右键操作。
- 内容浏览器用紧凑图标展示文件夹与资产，支持全局搜索、当前目录类型筛选、图标大小、面板高度调整和“当前处理器挂载”筛选。双击或 Enter 打开；右键新建、复制、粘贴、重命名、移动、删除和查看引用。拖拽资产可替换挂载，拖到浏览器中的文件夹可移动文件。
- 上方先选择空间，再从该空间选择装置；从内容浏览器或文件标签打开装置时同步两个下拉框。装置列表显示名称，悬停可查看完整路径。按所挂载 `.pipeline` 的 `Flow` 显示真实执行顺序，禁用阶段单独显示。点击处理器编辑 `.rig.Processors` 中对应部分；“装置设置”编辑公共范围和管线挂载。
- 中间为文件标签页。点击挂载资产的名称或图标，在当前窗口打开对应文件；同一路径重复打开会聚焦已有标签。切换到挂载资产时，当前装置和处理器保持不变。替换与移除挂载使用独立操作。
- 详情支持表单与源码切换、撤销、重做。同一文件的处理器表单和源码共享一份草稿；源码始终展示完整文件。共享标记显示受影响的装置，引用操作可查看上下游依赖。磁盘冲突保留草稿并提示重新载入。
- 相机表单包含 15 个直接字段：`AnchorOffsetX/Y/Z`、`RotationPitch/Yaw/Roll`、`Distance`、`FOV`、`AspectRatio`、`OrthoWidth`、`OffCenterOffsetX/Y`、`PerspectiveNearClipPlane`、`OrthoNearClipPlane`、`OrthoFarClipPlane`。关闭通道也需要完整配置。
- 装置输入仅挂载 `Assets`（用户输入）、`Focus` 和 `Unfocus`。Focus/Unfocus 均引用 `.transitionInput`；旧 Enter/Exit/SwitchViewpoint 配置和切换输入、切换值后缀已移除。
- Focus 的 `ValueAssets` 挂载至少一个专用 `.transitionValue`，禁止默认目标；Unfocus 必须通过 `DefaultValueAsset` 挂载不声明表现类型的默认值，专用 `ValueAssets` 可以为空。表单按用途筛选候选，点击名称打开文件标签，替换与移除独立操作。
- 专用目标使用 `PerformanceType = {BaseName, CodeName?}`。BaseName 格式为 `PERFORMANCE_[A-Z0-9_]+`，CodeName 可省略，提供时必须为非空字符串。匹配与重复检查比较完整二元组合；`10001` 和 `010001` 是不同代码，省略代码不表示通配。表现标识按字面量保存，即使代码形似资产路径，也不会参与引用扫描或移动重写。
- 过渡时长、通道和曲线保存在目标值文件中，输入文件仅选择候选目标。基础表现类别使用下拉框，选项来自当前工作区 `GameplayCameraSystem/Adaptation/ActorPerformance.lua` 的 `PerformanceTypes` 映射；显示易读名称与原始标识，已有自定义类别保留并标注。映射随源码变更刷新，也可点击刷新按钮重新读取。配置代码仍以文本编辑，默认目标禁止声明表现类型。
- 效果对象、接口、参数声明和后处理通道目录从所选工作区读取。基本相机效果与后处理数值效果分别使用自己的接口注册表。
- 后处理环境、布尔效果和滤镜编辑固定通道值；数值效果编辑来源、定义域、平滑时间和稀疏映射。框架容器通过普通详情编辑挂载、上下文和滤镜选择。事件绑定由 Lua 导演完成。
- Ctrl+W 关闭当前标签，Ctrl+B 显示或隐藏目录，Ctrl+J 显示或隐藏内容浏览器。Ctrl+S 保存当前文件，“全部保存”提交全部草稿。保存先通过当前框架的 `Editor.Workspace` 检查源协议、引用、三入口覆盖及展开结果，成功后写入。后处理不再生成独立执行计划。
- 新建或复制资产时，选择对应所有权目录；编辑器在同一事务中补充入口登记。移动、重命名会同步引用与入口；被其他资产使用的文件不能直接删除。Lua 业务代码中的字符串路径仍需自行同步。
- 修改前保留恢复副本；写入失败会恢复已写文件。外部文件变化会阻止覆盖。关闭未保存的标签时可选择保留或丢弃草稿，切换项目或退出应用会检查未保存内容。

保存资产后，重新启动 UE PIE 加载参数。

## 在 UE 中验证效果

编辑器专注资产编辑，保留曲线预览、管线可视化与引用检查。完成保存和 Lua 校验后，在 UE 编辑器重新启动 PIE，查看真实相机、碰撞和后处理效果。

## 验证

```powershell
$env:CAMERA_FRAMEWORK_TEST_ROOT = 'F:/cslua3/ue5cs/cslua/Content/Lua/CameraFramework'
npm.cmd test
npm.cmd run build
node tests/current-protocol-ui.cjs
node tests/current-protocol-ui.cjs --packaged
```

测试在临时工作区副本中运行，不修改原项目。UI 回归覆盖文件夹导航、15 通道表单、类型化引用、真实保存、后处理编辑、处理器管线、挂载资产标签页、内容浏览器事务与项目校验。

## 用户数据

`%APPDATA%/CameraFrameworkEditor/settings.json` 保存最近项目与布局；`recovery/` 保存修改前副本。已有用户数据中的旧游戏存档不再被编辑器读取。

## 构建编辑器

双击工具根目录的 **构建编辑器.bat**。批处理调用随仓库提供的 `scripts/build-editor.ps1`，检查 Node.js 22.12+ 和 npm，缺少构建依赖时按 package-lock.json 自动安装，再显式准备 Electron 运行文件，随后编译并生成可直接运行的编辑器目录（release/win-unpacked/）和 Windows x64 NSIS 安装包。首次下载依赖、Electron 或 NSIS 工具需要联网；成功提示同时显示程序与安装包路径。

失败时保留原始工具输出，并用中文说明失败步骤、原因和建议；下载超时、证书校验、文件占用、磁盘不足、文件完整性和编译错误分别处理。Electron 下载超时时提示当前 PowerShell 会话的镜像设置方法，不自动切换下载源。详细日志写入 `logs/build-editor.log`，每次构建覆盖；日志不会随临时文件清理。

每次构建为工具的 TEMP/TMP 分配独立临时目录。按 Enter 退出时立即清理；直接关闭构建窗口时，由隐藏清理进程等待构建进程结束并重试清理。仅删除具有本次会话标记的专属目录，不遍历目录链接，不清理全局 TEMP。保留 node_modules、Electron/npm/打包工具的可复用下载缓存、dist 与 release；失败后原有发布文件可能仍在，因此以本次“构建成功”提示判断结果。同一项目目录同时只允许一个构建进程。

输出为 `release/CameraFrameworkEditor-<版本>-Setup.exe`，安装向导支持选择安装目录、创建桌面快捷方式。安装程序包含应用和 Lua 运行时，使用者无需安装 Node.js；Lua 工作区仍由启动后自行选择。

自动化调用可用 `构建编辑器.bat --no-pause`，成功返回 0，失败返回非 0。`npm run package` 保留免安装目录构建；`npm run package:installer` 仅打包当前 dist，需先执行 `npm run build`。

当前 Electron 将二进制下载延迟到首次运行；仅执行 `npm ci` 可能尚未生成 `node_modules/electron/dist`。批处理及两个 npm 打包命令均先执行 `npm run electron:install`，通过已安装 Electron 包的安装器下载并校验对应版本，已有匹配运行文件时直接复用。缺少运行文件不再触发重复安装全部依赖。若下载失败，可检查网络后重试该命令；不要手工创建空的 dist 目录。机制见 [Electron 安装说明](https://www.electronjs.org/docs/latest/tutorial/installation)。

GitHub 下载较慢时，可在单次 PowerShell 会话中设置 Electron 文档列出的镜像后运行脚本，安装器仍使用包内校验和验证下载文件：

```powershell
$env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
.\构建编辑器.bat --no-pause
```
