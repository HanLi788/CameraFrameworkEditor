# CameraFrameworkEditor · 相机框架编辑器 v0.9.3

独立 Windows 桌面编辑器，直接编辑所选 Lua 工作区中的相机资产。当前接入 `GameplayCameraSystem`、`PostProcessingSystem` 与 `Shared` 三份 Framework 入口，资产协议统一为版本 1。

## 启动

首次运行，在工具根目录执行：

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd start
```

已有发布包时，运行 `release/win-unpacked/相机框架编辑器.exe`。免安装目录应整体复制；安装包位于 `release/CameraFrameworkEditor-0.9.3-Setup.exe`。发布包包含 Lua 与 Electron，使用者无需安装 Node.js 或 UE。

启动后选择包含 `CameraFramework`、`Foundation`、`DatabaseSystem`、`InputSystem` 的 Lua 目录，也可直接选择其中的 `CameraFramework`。目录位置由用户选择，不依赖工具所在盘符。

进入或切换工作区时显示石墨灰加载界面，初始化完成后自动进入编辑界面。加载期间暂停编辑及重复打开操作；失败时保留原工作区和标签，取消目录选择则继续停留在当前界面。

## 资产与路径

内容浏览器中的文件路径相对于 `CameraFramework/`。`Assets/Documents.index.json` 将稳定的文档身份映射到磁盘文件；源资产中的挂载与选择均使用完整文档引用：

```json
{"$ref":{"DocumentId":"Camera/ActionCamera/Dash/Dash.rig","Pointer":""}}
```

对应索引登记为：

```json
{"DocumentId":"Camera/ActionCamera/Dash/Dash.rig","Path":"GameplayCameraSystem/CameraAssets/ActionCamera/Dash/Dash.rig"}
```

共享和后处理身份分别使用 `Shared/`、`PostProcessingSystem/` 命名空间，相机身份使用 `Camera/`。移动或重命名只更新索引的 Path，保留 DocumentId 和引用内容；复制分配新身份，复制目录内的互相引用同步指向副本。禁止旧路径字符串挂载及非空 Pointer。

| 用途 | 文件后缀 |
|---|---|
| 框架入口 | `.share`、`.camera`、`.postProcessing` |
| 装置与管线 | `.rig`、`.pipeline` |
| 用户输入、聚焦与解除聚焦输入 | `.userInput`、`.transitionInput` |
| 输入混合 | `.inputBlend` |
| 聚焦与解除聚焦目标值 | `.transitionValue` |
| 相机参数 | `.range`、`.sensitivity`、`.smooth`、`.occlusion`、`.effect`、`.curve` |
| 后处理环境、数值效果、布尔效果、滤镜 | `.virtualInput`、`.numEffect`、`.boolEffect`、`.filter` |

三个入口分别为 `Assets/Shared/Framework.share`、`Assets/GameplayCameraSystem/Framework.camera`、`Assets/PostProcessingSystem/Framework.postProcessing`。全部资产必须登记到文档索引；共享资产还需登记到共享入口。其他资产按所属系统放置，装置和后处理挂载由各自入口维护。

## 编辑与保存

- 全应用默认采用石墨灰工业主题：中性灰背景、轻微渐变和内凹控件、小圆角、清晰细网格及低饱和蓝色选中态。主界面、启动页、弹窗、资产选择器与曲线编辑共用 `src/theme.css` 色板，原生窗口使用深色模式。
- 所有表体统一为 `#2B2E31`，普通单元格、固定通道列及管线阶段行使用同一底色。表头统一轻微渐变，输入框保留更深的内凹底色。
- 下拉框与弹出列表通过 Chromium 的可定制选择器统一为石墨灰配色，保留键盘选择、禁用选项和原有表单行为。
- 文件标签标识当前资产，悬停查看完整路径。界面不再提供源码编辑、文档阅读预览、重复资产标题栏或常驻路径描述；目录树与面包屑继续用于目录导航。
- 右侧分为三个独立控件：装置选择、公共配置、处理器资产。公共配置提供“范围资产”和“管线资产”入口；装置选择标题旁的相机按钮返回“装置总览”。
- 选择公共配置或处理器时，在同一个 `.rig` 标签内切换到独立页面，例如 `Dash.rig // 输入`，只显示该部分的完整挂载。每个装置记住自己的页面，打开挂载资产再返回时保留页面；各页面共用同一份草稿、保存与撤销记录。装置总览仍展示全部挂载。
- 输入挂载分为真实用户输入源、虚拟过渡输入源、输入源混合三个独立表格，表格相隔 20px。所有表格绘制行列边框；资产卡片采用固定尺寸，操作按钮位于卡片内部。
- 详情中的非通道配置尽量单行排列。启用过渡使用复选框，`bEnabled` 必须是布尔值；新建值资产默认 true，复制保留原值。false 跳过目标过渡，时长为 0 则立即应用目标。
- 标签宽度随文字内容确定，与控件保持 8px 间距。详情控件采用固定 CSS 像素尺寸：普通文本 200px、数值 100px、普通下拉框 180px；向量、参考系与资产卡片按各自结构单独定宽，不随窗口扩张。
- 表格以固定像素列宽容纳对应控件，通道正常行高约 28px。基础表现类型、代号、时长和过渡启用状态优先单行排列，空间不足时换行；表格保持完整列宽，通过详情区横向滚动浏览。固定 CSS 尺寸支持整体缩放，本版未增加缩放入口。
- 后处理的直接数值表按“通道、调节、值、是否写入”排列。240px 滑块与右侧数值框共用本地草稿，拖动实时预览，松开后只提交一次修改；支持键盘调节、精确输入、保存前提交与 Escape 撤回。建议滑块范围来自 Lua 的 Min／Max，合法的手输值可扩展此范围；Minimum／Maximum／Positive 继续作为硬边界。未勾选写入时禁用数值和滑块。NumEffect 保留增量值域表达式与映射曲线。
- 通道的数值、向量、宽高比、参考系与固定选项在单元格内编辑：向量按 X、Y、Z 展开，向量范围按 Min／Max 分为两行，宽高比分为分子和分母，参考系展开来源、插槽和旋转策略，自定义参考系直接显示基准参数。
- 复合数值在组内编辑时保留本地草稿，离开整组、按 Enter 或保存时整体校验并提交，Escape 撤回尚未提交的整组修改。数字框支持步进按钮、上下方向键，Shift 为十倍步长，Alt 为十分之一步长。所有修改共用保存、撤销与 Lua 校验链路。
- 任意长文本继续按实际显示宽度提供“查看详情”；弹窗确认写入当前草稿，取消不改变原值。固定结构的通道配置保持内联显示。
- 曲线目录使用独立的只读缩略图，不渲染完整编辑器的工具栏、读数或操作状态。曲线资产页保留节点、切线和曲线参数编辑。
- 曲线参数区中的每个节点使用独立面板，X 与 Y 在同一行，样条切线另占一行；面板选择与曲线中的节点选择保持同步。
- 普通装置的 Enter、Change、Exit 均通过 ValueAssets 挂载精确 PerformanceType 目标，不使用 DefaultValueAsset。Sequence 按正整数 SequenceId 匹配 Enter／Exit 目标，与其他空间共用十三通道及 Actor／插槽参考。
- `.inputBlend` 页面只展示权重表：公共十三通道作为行，输入资产作为列，列头保留资产卡片操作；不显示名称、同步来源装置及手动同步入口。显示转置不改变底层 `Rows[index].Weights[channel]` 协议；0、负数和大于 1 的倍率均允许，不限制列和、不归一化，保存时继续校验输入资产与引用装置一致。
- 资产卡片支持打开、替换、定位、查看引用和移除。文件标签的右键菜单提供查看引用、定位、还原草稿及关闭操作。
- 内容浏览器支持搜索、新建、复制、移动与删除。文档身份由索引维护，移动文件保持身份；保存通过所选工作区的真实 Lua 校验，冲突与写入失败会保留草稿。

## 编辑与保存

打开工作区时初始化常驻 Lua 校验进程，复用工作区自己的数据库读取视图和相机校验规则。字段编辑立即更新草稿；停止连续修改约 180ms 后，只传入变化文档，校验该文档及受影响的引用方。草稿解析和引用图也按内容复用。

保存仅提交所选的未保存文档。校验结果绑定完整候选内容、索引与模块版本，保存当前文件和全部保存分别匹配各自候选；版本吻合时直接复用后台结果，尚未完成时等待同一任务。保存前检查目标文件和依赖版本，保留恢复副本、原子替换与失败回滚。

保存仍直接写入 JSON，同时向当前游戏会话的 `Assets/Editor.wal` 追加修改命令；`Documents.wal` 由游戏数据库管理。命令与校验和通过所选工程的 `Journal/EditorWAL.lua`、`Core/Data.lua` 和 JSON Patch 实现生成。修改前的逻辑文档包含正式 WAL 和待导入队列；只提交本次实际变化的字段，保留其他游戏修改。同长度数组按元素比较，数组结构变化整体替换。

JSON 保存成功后，界面显示“待游戏导入”；游戏按 Ctrl+R 接受命令后，文件监听更新为“游戏已导入”。日志追加失败时保留已保存 JSON，显示“JSON 已保存，日志待重试”，标签警告图标提供错误详情。再次保存当前文件或全部保存可重试，无需重新修改字段。请求 ID、原始命令和逻辑基线保存在用户数据的 `editor-queue/`；重启编辑器后仍可恢复。已追加但回执不确定的请求先确认队列和正式记录，避免重复追加；只补齐能够确认属于本编辑器的未完成尾部。

没有 `Editor.wal` 会话文件时仍可离线保存 JSON，编辑器不创建游戏会话。游戏更换 SessionId 后丢弃旧会话请求。游戏正式接受的修改具有最终决定权：检查点沿用工程现有覆盖方式，尚未导入的编辑器修改允许被覆盖或清理。新增、移动、删除等结构操作仍直接写源资产及索引；运行中的数据库不通过参数队列接收新登记，结构修改后需要重新进入游戏，宜在游戏结束并完成检查点后执行。

编辑器进程内的保存、追加和回执处理串行执行。追加前复查日志基线与文件身份，完成后读回确认；跨进程追加和宿主清理仍遵循工程的写入协调约定，这些检查不替代操作系统级锁。编辑器不修改 Lua 宿主的检查点或文件适配实现。

普通保存不会重新扫描整棵目录，也不会重发全部资产。文件监听按变化文件更新缓存及打开的文档，自己的临时写入和目录通知不触发全量刷新。源码、输入定义、索引和文件结构变化会失效相应缓存；F7 始终重新读取磁盘并执行完整校验。首次打开、结构操作和大量共享依赖的变更耗时会高于普通字段编辑。

本机 318 个资产的临时工程副本实测：原保存链路约 7.1 秒；0.9.0 发布版修改一个混合权重，编辑提交约 5ms，含 180ms 防抖的后台校验约 250ms，复用校验结果的界面保存约 85ms，输入框尚未失焦时 Ctrl+S 约 162ms，两份草稿立即全部保存约 219ms。三次保存期间目录全量扫描为 0 次，Lua 校验进程只启动 1 次。上述为单机回归数据，不含首次初始化。

0.9.2 同机同规模回归：编辑提交约 5ms，含防抖的后台校验约 304ms；包含 JSON 写入与队列追加的完整保存约 323ms，立即 Ctrl+S 约 337ms，两份草稿全部保存约 441ms。保存期间仍为 0 次目录全量扫描、1 个常驻 Lua 进程。以上为单次本机回归数据。

## 验证

```powershell
npm.cmd run build
node --test tests/workbench.test.cjs tests/documents.test.cjs tests/document-edits.test.cjs tests/structured-numbers.test.cjs tests/rig-graph.test.cjs tests/channel-tables.test.cjs
npm.cmd run test:ui
npm.cmd run test:packaged
node tests/fast-save-ui.cjs --packaged
node tests/workspace-loading-ui.cjs --packaged
node tests/editor-journal-ui.cjs --packaged
node tests/detail-geometry-ui.cjs --packaged
node tests/controls-ui.cjs --packaged
node tests/layout-refinements-ui.cjs --packaged
```

完整后台回归仍可执行 `npm.cmd test`。界面回归在临时 Lua 工作区副本中运行，覆盖全局主题与原生深色模式、紧凑表格、固定尺寸／窗口缩放／横向滚动、滑块与数值共用草稿／单次拖动撤销、内联复合控件、成组校验、步进／Escape、曲线缩略图、固定卡片、装置子页、20px 表格间距、长文本弹窗、实际 Lua 保存、撤销重做与文件事务，不修改真实工程。

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
