# CameraFrameworkEditor · 相机框架编辑器 v0.6.0

独立 Windows 桌面应用。工具与项目分开存放；编辑器直接扫描框架内的资产文件，引用使用相对于 `CameraFramework/` 的明确路径。不再需要 `Index.json` 或资产稳定 ID；目录仅用于物理组织。

## 启动

仓库地址：`https://github.com/HanLi788/CameraFrameworkEditor.git`。本地目录可自行命名，构建和运行使用项目相对路径。

从仓库首次拉取后，安装 Node.js 22.12+（含 npm），在项目根目录执行：

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd start
```

已有打包产物时，可运行 `release/win-unpacked/相机框架编辑器.exe`，或使用本机的 **相机框架编辑器.lnk**。快捷方式不纳入 Git；移动或重命名目录后，需要更新其目标路径和起始位置。`node_modules`、`dist`、`release` 同样不纳入 Git，首次拉取后需安装依赖并构建。

启动后选择 `CameraFramework` 或其所在的 `Lua` 目录。完整校验和模拟需要框架旁原有的 `Foundation` 目录；编辑器使用仓库内 `runtime/` 提供的 Lua，无需另行安装 Lua 或 UE 编辑器。

发布目录 `release/win-unpacked` 可整体复制运行，无需另装 Node.js 或 Lua；不要单独复制 exe。

## 生成安装包

双击工具根目录的 **生成安装包.bat**。脚本检查 Node.js 22.12+ 和 npm，缺少构建依赖时按 package-lock.json 自动安装，再显式准备 Electron 运行文件，随后编译并生成 Windows x64 NSIS 安装包。首次下载依赖、Electron 或 NSIS 工具需要联网；构建失败会停下并保留错误信息。

输出为 `release/CameraFrameworkEditor-<版本>-Setup.exe`，安装向导支持选择安装目录、创建桌面快捷方式。安装程序包含应用和 Lua 运行时，使用者无需安装 Node.js；相机框架仍由启动后自行选择。

自动化调用可用 `生成安装包.bat --no-pause`，成功返回 0，失败返回非 0。`npm run package` 保留免安装目录构建；`npm run package:installer` 仅打包当前 dist，需先执行 `npm run build`。

当前 Electron 将二进制下载延迟到首次运行；仅执行 `npm ci` 可能尚未生成 `node_modules/electron/dist`。批处理及两个 npm 打包命令均先执行 `npm run electron:install`，通过已安装 Electron 包的安装器下载并校验对应版本，已有匹配运行文件时直接复用。缺少运行文件不再触发重复安装全部依赖。若下载失败，可检查网络后重试该命令；不要手工创建空的 dist 目录。机制见 [Electron 安装说明](https://www.electronjs.org/docs/latest/tutorial/installation)。

GitHub 下载较慢时，可在单次 PowerShell 会话中设置 Electron 文档列出的镜像后运行脚本，安装器仍使用包内校验和验证下载文件：

```powershell
$env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'
.\生成安装包.bat --no-pause
```

## 工作区

- 主窗口中央保留场景预览；右侧只显示装置详情，顶部选择相机空间和装置。空间来自装置管线的 `SpaceType`。
- 左侧目录树从 Assets 开始，显示文件夹和资产；单击文件夹切换浏览目录，双击树中的资产只在内容浏览器中定位，不打开编辑窗口。浏览目录不会切换装置。
- 底部内容浏览器同时显示文件夹和文件，文件夹在前；双击文件夹进入，双击文件打开编辑标签。搜索范围为 Assets，支持类型筛选；右键空白处在当前目录新建文件夹，右键文件夹可在其内部新建。新建文件夹不影响现有草稿，重名或非法路径会被拒绝。
- 双击资产或 UTF-8 文本文件在同一个独立编辑窗口中打开标签页；重复打开同一文件切换到已有标签。编辑窗口没有原生菜单栏，工具栏和快捷键仍可使用。切换标签保留各自的草稿、撤销记录、编辑模式及滚动位置。
- 主进程集中管理草稿、撤销、重做及保存状态。多个窗口修改不同字段可以合并，过期的同字段写入会被拒绝。
- 关闭标签或编辑窗口可保留草稿或丢弃修改。保存只处理当前文档，全部保存处理所有草稿（包含已关闭标签的草稿）。退出应用和切换项目会检查全部草稿。
- 普通详情表单不显示 SchemaVersion；协议字段仍保存在文件中，并参与加载及校验，可在源码模式查看。
- 编辑窗口的表单使用整个可用宽度，内容区填满标签栏和状态栏之间的空间并独立滚动；字段保持自然高度。

## 引用槽与图标

引用槽显示资产图标、名称和路径，支持选择、拖入、打开独立编辑器、定位到内容浏览器及查看引用方。曲线另有直接选择已扫描到的曲线资产的下拉框。

定位操作会激活主窗口，展开目标目录、清除搜索及类型筛选、选中并滚动显示目标文件。详情分组每层缩进 12px，并使用细边线表达层级。

界面使用统一 SVG 图标；图标按钮提供悬停提示和无障碍名称。挂载使用紧凑行：左侧拖拽手柄、资产图标与名称，右侧依次为替换、打开、定位、查看引用和更多操作。完整路径及描述在名称悬停提示中查看，不常驻显示数组下标或资产类型；更多操作提供“移除挂载”。数组标题右侧的加号添加挂载，空数组可点击或从浏览器拖入资产。

按住手柄拖动时卡片跟随鼠标，其他项让出落点；靠近滚动区边缘时自动滚动，松开后提交一次可撤销的排序，Esc 取消。也可聚焦手柄后使用上下方向键调整。目标值候选槽使用相同排序交互，保留业务 ID 和首槽“默认”标记。

数组标签后的问号在悬停或聚焦时解释顺序含义：输入选取首个活跃来源，范围／灵敏度／平滑逐通道选取首个启用配置，效果按顺序求值并累加贡献，过渡按 Phase 区分用途，目标值按业务 ID 选择且首槽作为默认。管线当前恰好一个，遮挡最多一个，生命周期过渡最多 Enter、Exit 各一个；必需的最后一个挂载不能移除。效果权重位于 `.effect` 根部，用户输入每通道权重位于 `.input`，均允许负数。

## 曲线工作流

引用处始终显示只读曲线预览，没有控制点拖动或参数编辑入口。替换引用只修改引用方，不修改曲线定义。

1. 在目录树选择希望存放曲线的位置，例如 `Assets/CameraAssets/ActionCamera/Player/Dash/CurveAssets/`。
2. 点击“新建资产”，选择曲线类型，填写名称和目标文件路径。CurveAssets 目录默认新建曲线。
3. 选择父类型 Bezier 或 CubicHermiteSpline，确认后创建资产，同时打开曲线编辑标签。Gaussian 仍为预留类型。
4. 在曲线标签调整控制点或参数并保存。返回引用方，通过下拉框选择新曲线，再保存引用方。

新建曲线使用父类型模板，不依赖已有模板资产。目标路径可自行指定，但必须位于当前框架内；重名文件会被拒绝。装置文件直接放在场景目录，例如 `Assets/CameraAssets/ActionCamera/Player/Dash/Dash.rig`；创建或复制装置时会预留同级 `EffectAssets/`、`PipelineAssets/`。

曲线编辑标签正常保存当前文件，不另存新资产、不自动改绑引用。窗口列出引用此曲线的资产，保存后所有对应预览刷新，引用方文件不被重写。需要独立变体时，先手动新建或复制曲线，再替换引用。切换父类型会重建控制点，可撤销。

## 目标值与过渡输入

过渡输入版本 4 使用 ValueAssets 候选槽数组 `{Path, Id?}`、内部 Phase 和统一 Duration，不再内嵌通道或 bTargetsById。目标值 .value 版本 2 保存完整十二通道及各自值、类型、参考、采样方式和曲线引用。

在 ValueAssets 目录中新建资产会默认选择目标值类型，从模板复制完整通道；双击在编辑窗口的新标签中编辑。引用槽只允许挂载 Value 类型。数组支持增删、排序；第一槽显示“默认”。业务 ID 可不填写，也可选安全整数或非空字符串。数字 10001 与字符串 "10001" 不相等。

未传入交互 Id 时选择第一槽；传入未知 Id 则校验失败。退出过渡使用自身第一槽。目标槽数组不是镜头播放序列。业务 Id 仅用于目标槽选择，不是资产身份；槽中的 Path 明确引用目标文件。

保存会校验全部目标（包括未选中目标和关闭通道）；共享目标值保存后引用关系保持不变。编辑器按所选框架实时扫描资产，不依赖固定数量或固定目录名。

## 效果来源与输出

效果资产 Source 直接声明 `Object`、`Interface`、`Params`、`bMemberFunction`。对象是从 CameraContext 开始的字段路径（如 `Owner` 或 `Owner.CharacterMovement`），接口是单个方法名；无需预注册来源。表单提供有序参数的增删、排序与数字／字符串／布尔类型选择，不支持 null 或嵌套对象。

引用与来源结构在保存时通过实际 Lua 加载器校验。对象和方法在装置安装时检查，CurrentTarget 可延后至实际求值；运行时第一个返回值必须是有限数字。项目静态校验不会执行任意业务函数，也无法证明真实 UE 对象具有这些方法。

Outputs 保持稀疏配置，表单可按参数名增删输出，框架加载器检查参数名和映射；曲线仍为只读引用。整体 Weight 在效果资产内设置，挂载列表不再保存权重或总开关。

预览使用自身的 Owner、CurrentTarget 等模拟对象。若项目旁存在 `Actor/Player/MovementValues.lua`，宿主加载其中的函数供预览角色使用，因此现有速度效果沿用项目业务实现。其他业务对象或方法需要在预览适配中提供；缺失时明确报错，不替换为零，也不连接或关闭 UE 编辑器进程。实际 UE 业务接口仍需在引擎中验证。

## 保存、校验与恢复

- 表单与 Monaco 源码编辑共享文档状态；支持 Lua、JSON、Markdown 等 UTF-8 文本。
- 保存前调用所选框架的真实 Lua 加载器，校验曲线及其使用方。全部保存会联合校验相关草稿；F7 可校验项目及文本草稿。
- 外部文件变化时，干净文档自动刷新，有草稿的文档显示冲突，保存不会直接覆盖外部版本。重新载入可通过撤销恢复先前草稿。
- 新文件自动被扫描识别，无需登记。移动资产会同步更新框架内资产文件的引用并联合校验，被引用资产不能删除。创建或复制可与其他文档草稿并存；移动、删除前需处理草稿。业务 Lua 脚本和框架外的路径不自动重写，移动装置或脚本直接加载的资产后需要同步调用处。
- 文件操作不进入编辑撤销栈，写入前创建恢复副本，可捕获的多文件写入错误会回滚。

用户数据位于 `%APPDATA%/CameraFrameworkEditor`。`settings.json` 保存最近目录及布局；`recovery/<时间戳-随机标识>/manifest.json` 记录修改前文件及原路径。通过“文件 / 查看恢复副本”定位，恢复副本目前手动还原。

## 模拟预览

播放使用所选项目的真实 Lua 相机管理器、资产加载器和处理管线。每次播放先校验并读取当前资产草稿，创建独立运行实例；运行中修改资产，需要重新播放才生效，模拟本身不写入资产。

- 初始十二通道取自闲置装置，随后激活右侧选中的装置。进入完成后停留 2 秒，再触发退出；退出后继续运行闲置装置。选择闲置空间时直接持续运行该闲置装置。
- 暂停冻结模拟时间，继续从原状态推进；停止回到本次运行的初始状态；重新播放重新读取当前配置。模拟固定以 60 Hz 推进，窗口接收 30 Hz 的输出。
- 交互装置可选择目标业务 ID；不指定时采用第一槽。速度参数供预览角色及效果来源读取，角色位置保持固定；当前预览用户输入为零。
- “12 通道”显示真实 TargetFrameState、RenderFrameState 和最终输出。相机画面使用最终位置、旋转、FOV、宽高比和正交参数；自由观察可查看相机及视锥。

预览宿主提供角色、目标、输入映射接口及球体对盒子的遮挡碰撞，并显示遮挡材质透明度。它不替代 UE 世界、输入设备或渲染器；UE 后处理、复杂场景碰撞及真实交互仍需在引擎中确认。观察和模拟参数不会写入资产。

## 开发与验证

在编辑器根目录执行，先显式指定要验证的相机框架路径：

```powershell
$env:CAMERA_FRAMEWORK_TEST_ROOT = 'D:/MyWorks/Lua/CameraFramework'
npm.cmd ci
npm.cmd run build
npm.cmd start
npm.cmd test
npm.cmd run test:ui
npm.cmd run package
npm.cmd run test:packaged
```

测试从 `CAMERA_FRAMEWORK_TEST_ROOT` 指定的框架建立临时副本，不修改原项目。上述 D 盘路径为当前工作区示例；测试脚本未设置环境变量时仍回退到 `F:/MyWorks/Lua/CameraFramework`，其他机器需按实际位置设置。

`npm.cmd test` 运行资产操作、文档状态、目标值和真实 Lua 模拟测试；`test:ui` 另行运行 Electron 窗口、标签页、引用槽、曲线编辑与 SVG 控件交互，截图位于 `test-results`；`test:packaged` 对免安装构建运行相同的 UI 冒烟测试。

2026-11-06 使用 `D:/MyWorks/Lua/CameraFramework` 核对：构建及类型检查通过，37 项非 UI 测试全部通过，207 个资产通过真实 Lua 校验；开发版与打包版本 UI 冒烟测试均通过，Windows x64 安装包已生成。UI 覆盖 Assets 文件夹创建与目录树定位、满宽表单、紧凑挂载的添加／移除／顺序提示、拖拽与键盘排序、撤销重做、Esc 取消和最窄侧栏布局。207 是当前测试夹具的数量断言；资产增删后需同步该断言，编辑器扫描逻辑本身不限制资产数量。

编辑器预览的输入映射返回零，不能覆盖玩家真实输入订阅链路。同次框架回归为 492/493 通过，剩余失败是 LuaPlayer 仅订阅 ActionCamera.ResetCamera，导致 Idle 下中键回正未生效；应在框架侧单独修复和验证。

## 模块与框架同步

| 位置 | 职责 |
| --- | --- |
| src/App.tsx、DirectoryTree.tsx、ContentBrowser.tsx | 主工作区、Rig 选择、Assets 目录树、文件夹与资产浏览 |
| src/AssetDocument.tsx、TextEditor.tsx、CurveEditor.tsx | 多标签资产表单、Monaco 源码与曲线编辑 |
| src/Fields.tsx、MountSlots.tsx、ValueSlots.tsx、AssetSlot.tsx | 字段、路径挂载、目标候选槽和引用交互 |
| src/ArrayGroup.tsx、SortableList.tsx、AssetPicker.tsx | 顺序提示、拖拽与键盘排序、共享资产选择器 |
| src/Preview.tsx | Three.js 场景、相机画面和十二通道监视 |
| electron/main.cjs、preload.cjs | 窗口生命周期、限定 IPC、文件监听和菜单 |
| electron/documents.cjs | 共享草稿、撤销重做、字段合并和文档冲突 |
| electron/project.cjs | 扫描、版本与引用检查、资产操作和恢复备份 |
| electron/validation.cjs、validator.lua | 打包 UTF-8 模块与草稿，调用框架真实加载器校验 |
| electron/simulation.cjs、preview-*.lua | Lua 子进程通信、独立模拟实例和宿主适配 |

框架资产协议变化时，同步检查 `electron/project.cjs` 的版本与引用规则、`src/types.ts` 的引用解析、相关表单组件和测试夹具。加载器或运行接口变化时，还需核对 `validator.lua`、`preview-runtime.lua` 与 `preview-adapters.lua`。文件协议与内部运行配置以所选框架的 `Assets/README.md` 和 `Docs/Assets/` 为准。

技术构成：Electron 沙箱窗口与限定 IPC、React/TypeScript、Three.js、Monaco、随应用发布的 Lua 5.4。Node 将 UTF-8 模块与资产传给 Lua，支持中文项目路径。校验会加载用户选择的本地框架代码，应打开可信目录。

协议：Rig 14 / Range 5 / Effect 6 / Occlusion 4 / Curve 3 / Smooth 2 / Sensitivity 2 / Pipeline 2 / UserInput 3 / Transition 4 / Value 2。旧资产会报版本错误，不会自动改版本号或转换旧结构。


## 2026-11-07 输入配置与界面调整

挂载卡片、曲线选择框和资产选择器统一显示含后缀的文件名，不再优先展示内部 Name。过渡输入的阶段标签替换为只读时长（如 `0.3 s`、`0 s`），即时反映共享草稿；悬停提示实际阶段与编辑入口。阶段和时长仍只在输入资产内配置。

- 装置输入处理器仅显示输入资产和灵敏度资产两个列表；输入列表逐通道取最靠前的启用、活跃来源。Enter、Exit 各最多一份，时长来自过渡资产；未挂载阶段立即完成。
- UserInput 固定十二通道，显式编辑 bEnabled、Mapping、Weight；过渡输入直接使用选中值资产的十二通道。旧 Rig 13 / UserInput 2 不能只修改版本号。
- 主窗口菜单“语言 / Language”切换中文或 English，保存设置并同步所有打开的窗口。仅翻译编辑器界面文案；源码、文件名、资产 Name、枚举和类型值保持原样。字段不再上下重复显示中英两行，悬停仍可查看字段路径。
- 目录使用黄色文件夹图标，内容浏览器采用紧凑单名称卡片，不再显示第二行类型及重复名称。
- 非装置、非曲线资产以所属场景和用途命名，例如 Dash_Enter.input、Dash_Default.occlusion；共享资产保留所属场景前缀。引用与业务 Lua 中的既有路径已同步迁移。
- 详情图标按钮统一取消多余内边距和冲突的 SVG 尺寸，测试同时检查按钮和 SVG 的真实中心位置。


2026-11-07 核对：TypeScript 与生产构建通过，39 项非 UI 测试通过，207 个资产通过真实 Lua 加载器校验；开发版及打包版 UI 测试覆盖统一输入列表、十二通道、图标中心位置、中英文跨窗口同步、语言持久化与草稿不变。框架原生回归为 496 项中 495 项通过，剩余为已记录的 Idle 中键回正接线问题。

发布统一覆盖原有 `release/` 目录，不另建按日期命名的发布目录。运行 `npm run package:installer` 或 `生成安装包.bat`，安装包生成于 `release/CameraFrameworkEditor-0.6.0-Setup.exe`。如果文件被运行中的编辑器占用，先正常关闭该编辑器再重试，避免丢失未保存的草稿。默认使用 `npm run test:packaged` 验证 `release/win-unpacked` 中的程序。
