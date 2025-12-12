import { app, BrowserWindow, ipcMain, session, shell, net, dialog, screen } from "electron"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { download } from "electron-dl"
import fs from "node:fs"

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, "..")

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"]
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron")
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist")

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST

let win: BrowserWindow | null
let updateWin: BrowserWindow | null
let customDownloadPath: string | null = null

// 初始化下载路径设置
function initDownloadPath() {
  try {
    const configPath = path.join(require("os").homedir(), ".adofai-tools-config.json")
    if (fs.existsSync(configPath)) {
      const config: any = JSON.parse(fs.readFileSync(configPath, "utf8"))
      if (config.downloadPath) {
        customDownloadPath = config.downloadPath
      }
    }
  } catch (error) {
    console.error("Failed to load download path config:", error)
  }
}

// 保存下载路径设置
function saveDownloadPath(downloadPath: string) {
  try {
    const configPath = path.join(require("os").homedir(), ".adofai-tools-config.json")
    let config: any = {}
    
    // 读取现有配置
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, "utf8"))
    }
    
    // 更新下载路径
    config.downloadPath = downloadPath
    
    // 保存配置
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8")
    customDownloadPath = downloadPath
    
    return true
  } catch (error) {
    console.error("Failed to save download path config:", error)
    return false
  }
}

// 创建更新检查窗口
function createUpdateWindow() {
  console.log("Creating update window...");
  const updateWindowOptions: any = {
    width: 400,
    height: 500,
    resizable: false,
    frame: false,
    alwaysOnTop: true,
    center: true,
    show: false,
    icon: path.join(process.env.APP_ROOT, "./electron/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      nodeIntegration: true,
      contextIsolation: true, // 确保上下文隔离
    },
  }

  // macOS 特殊配置
  if (process.platform === 'darwin') {
    updateWindowOptions.titleBarStyle = 'hiddenInset'
    updateWindowOptions.trafficLightPosition = { x: -100, y: -100 } // 将红绿灯按钮移到窗口外
  } else {
    updateWindowOptions.titleBarStyle = 'hidden'
  }

  updateWin = new BrowserWindow(updateWindowOptions)

  if (VITE_DEV_SERVER_URL) {
    console.log("Loading update page from dev server:", VITE_DEV_SERVER_URL + "/#/update");
    updateWin.loadURL(VITE_DEV_SERVER_URL + "/#/update")
  } else {
    const updatePath = path.join(RENDERER_DIST, "index.html");
    console.log("Loading update page from file:", updatePath);
    updateWin.loadFile(updatePath, { hash: "/update" })
  }

  updateWin.once('ready-to-show', () => {
    console.log("Update window ready to show");
    updateWin?.show()
  })

  updateWin.on('closed', () => {
    console.log("Update window closed");
    updateWin = null
  })
  
  // 添加调试信息
  updateWin.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error("Update window failed to load:", errorCode, errorDescription);
  });
}

// 创建主应用窗口
function createWindow() {
  const windowOptions: any = {
    width: 1920,
    height: 1080,
    icon: path.join(process.env.APP_ROOT, "./electron/icon.png"),
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      nodeIntegration: true,
    },
  }

  // macOS 特殊配置
  if (process.platform === 'darwin') {
    windowOptions.titleBarStyle = 'hiddenInset'
    windowOptions.trafficLightPosition = { x: -100, y: -100 } // 将红绿灯按钮移到窗口外
  } else {
    windowOptions.titleBarStyle = 'hidden'
  }

  win = new BrowserWindow(windowOptions)

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"))
  }
}

// 存储下载任务和相关信息
const downloadTasks = new Map()
const downloadStartTimes = new Map() // 存储下载开始时间
const downloadLastUpdate = new Map() // 存储上次更新时间和字节数

// 获取下载目录
function getDownloadPath() {
  // 尝试从本地存储获取自定义路径
  const customPath = customDownloadPath
  if (customPath && fs.existsSync(path.dirname(customPath))) {
    return customPath
  }
  // 默认路径
  const defaultPath = path.join(require("os").homedir(), "Downloads", "ADOFAI-Tools")
  
  // 确保默认路径存在
  try {
    if (!fs.existsSync(defaultPath)) {
      fs.mkdirSync(defaultPath, { recursive: true })
    }
  } catch (error) {
    console.error("Failed to create default download directory:", error)
  }
  
  return defaultPath
}
function getFileExtensionFromUrl(url: string): string {
  try {
    // 移除查询参数和片段
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    
    // 提取扩展名
    const lastDotIndex = pathname.lastIndexOf('.')
    if (lastDotIndex !== -1 && lastDotIndex < pathname.length - 1) {
      const extension = pathname.substring(lastDotIndex + 1).toLowerCase()
      
      // 验证是否为有效的文件扩展名（不包含特殊字符）
      if (/^[a-z0-9]+$/i.test(extension)) {
        return extension
      }
    }
  } catch (error) {
    console.warn("Failed to extract extension from URL:", url, error)
  }
  
  // 默认返回zip
  return "zip"
}

// 获取工具专用下载目录（在基础路径下创建以toolId命名的子文件夹）
function getToolDownloadPath(toolId: string): string {
  const basePath = getDownloadPath()
  const toolPath = path.join(basePath, toolId)
  
  // 创建工具专用文件夹
  try {
    if (!fs.existsSync(toolPath)) {
      fs.mkdirSync(toolPath, { recursive: true })
    }
  } catch (error) {
    console.error("Failed to create tool directory:", toolPath, error)
    // 如果创建失败，回退到基础路径
    return basePath
  }
  
  return toolPath
}

// 添加fetch处理器
ipcMain.handle("fetch", async (_event, ...args: [string, RequestInit?]) => {
  const resp = await net.fetch(...args);
  return resp.text();
});

// 版本比较函数
function compareVersions(version1: string, version2: string): number {
  const v1 = version1.split('.').map(Number);
  const v2 = version2.split('.').map(Number);
  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const num1 = v1[i] || 0;
    const num2 = v2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

// 工具版本信息接口
interface ToolVersionInfo {
  toolId: string;
  version: string;
  downloadDate: string;
  toolName: string;
  apiVersion: string;
}

// 生成工具版本信息文件
function createToolVersionInfo(toolId: string, toolName: string, version: string): boolean {
  try {
    const toolPath = getToolDownloadPath(toolId);
    const infoPath = path.join(toolPath, 'info.json');
    
    const versionInfo: ToolVersionInfo = {
      toolId: toolId,
      version: version,
      downloadDate: new Date().toISOString(),
      toolName: toolName,
      apiVersion: version
    };
    
    fs.writeFileSync(infoPath, JSON.stringify(versionInfo, null, 2), 'utf8');
    console.log('Tool version info created:', infoPath);
    return true;
  } catch (error) {
    console.error('Failed to create tool version info:', error);
    return false;
  }
}

// 读取工具版本信息
function readToolVersionInfo(toolId: string): ToolVersionInfo | null {
  try {
    const toolPath = getToolDownloadPath(toolId);
    const infoPath = path.join(toolPath, 'info.json');
    
    if (!fs.existsSync(infoPath)) {
      return null;
    }
    
    const content = fs.readFileSync(infoPath, 'utf8');
    const versionInfo: ToolVersionInfo = JSON.parse(content);
    return versionInfo;
  } catch (error) {
    console.error('Failed to read tool version info:', error);
    return null;
  }
}

// 更新工具版本信息
function updateToolVersionInfo(toolId: string, newVersion: string, toolName: string): boolean {
  try {
    const existingInfo = readToolVersionInfo(toolId);
    const toolPath = getToolDownloadPath(toolId);
    const infoPath = path.join(toolPath, 'info.json');
    
    const versionInfo: ToolVersionInfo = {
      toolId: toolId,
      version: newVersion,
      downloadDate: new Date().toISOString(),
      toolName: toolName,
      apiVersion: newVersion,
      ...existingInfo // 保留其他可能的字段
    };
    
    fs.writeFileSync(infoPath, JSON.stringify(versionInfo, null, 2), 'utf8');
    console.log('Tool version info updated:', infoPath);
    return true;
  } catch (error) {
    console.error('Failed to update tool version info:', error);
    return false;
  }
}

// 获取所有工具的版本信息
function getAllToolVersions(): Record<string, ToolVersionInfo> {
  try {
    const basePath = getDownloadPath();
    const toolVersions: Record<string, ToolVersionInfo> = {};
    
    if (!fs.existsSync(basePath)) {
      return toolVersions;
    }
    
    const entries = fs.readdirSync(basePath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const toolId = entry.name;
        const versionInfo = readToolVersionInfo(toolId);
        if (versionInfo) {
          toolVersions[toolId] = versionInfo;
        }
      }
    }
    
    return toolVersions;
  } catch (error) {
    console.error('Failed to get all tool versions:', error);
    return {};
  }
}

// 检查更新
ipcMain.handle("check-update", async () => {
  try {
    console.log("Starting update check...");
    const response = await net.fetch("https://7th.rhythmdoctor.top/api/check_update.php");
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const responseText = await response.text();
    console.log("Update API response:", responseText);
    
    const data = JSON.parse(responseText);
    
    if (!data.success) {
      throw new Error(data.message || "获取更新信息失败");
    }
    
    console.log("Update check successful:", data.data);
    return data.data;
  } catch (error: any) {
    console.error("Check update error:", error);
    throw error;
  }
});

// 处理软件更新（打开浏览器）
ipcMain.handle("handle-app-update", async (event, updateUrl) => {
  try {
    await shell.openExternal(updateUrl);
    // 打开浏览器后退出应用
    setTimeout(() => {
      app.quit();
    }, 1000);
    return true;
  } catch (error) {
    console.error("Handle app update error:", error);
    return false;
  }
});

// 完成更新，启动主应用
ipcMain.handle("finish-update", async () => {
  try {
    // 关闭更新窗口
    if (updateWin) {
      updateWin.close();
      updateWin = null;
    }
    
    // 创建主应用窗口
    createWindow();
    
    return true;
  } catch (error) {
    console.error("Finish update error:", error);
    return false;
  }
});

ipcMain.handle("open-external", async (event, url) => {
  try {
    await shell.openExternal(url)
    return true
  } catch (error) {
    console.error("Open external URL error:", error)
    return false
  }
})

// 检查文件是否存在
ipcMain.handle("check-file-exists", async (event, toolId, extension) => {
  try {
    const toolPath = getToolDownloadPath(toolId)
    
    // 如果没有指定扩展名，查找该文件夹下的任何文件
    if (!extension) {
      if (!fs.existsSync(toolPath)) {
        return false
      }
      const files = fs.readdirSync(toolPath)
      return files.some(file => file.startsWith(toolId + '.'))
    }
    const filename = `${toolId}.${extension}`
    const filePath = path.join(toolPath, filename)
    return fs.existsSync(filePath)
  } catch (error) {
    console.error("Check file exists error:", error)
    return false
  }
})

// 打开工具文件夹
ipcMain.handle("open-local-file", async (event, toolId, extension) => {
  try {
    const toolPath = getToolDownloadPath(toolId)
    
   // 检查工具文件夹是否存在
   if (!fs.existsSync(toolPath)) {
    return false
  }
  
  // 验证文件夹中确实有工具文件
  const files = fs.readdirSync(toolPath)
  const hasToolFile = files.some(file => file.startsWith(toolId + '.'))
  
  if (hasToolFile) {
    // 打开工具文件夹而不是具体文件
    await shell.openPath(toolPath)
      return true
    } else {
      return false
    }
  } catch (error) {
    console.error("Open tool folder error:", error)
    return false
  }
})

// 删除本地文件
ipcMain.handle("delete-local-file", async (event, toolId, extension) => {
  try {
    const toolPath = getToolDownloadPath(toolId)
    
    // 如果没有指定扩展名，删除整个工具文件夹
    if (!extension) {
      if (fs.existsSync(toolPath)) {
        fs.rmSync(toolPath, { recursive: true, force: true })
        return true
      }
      return false
    }
    const filename = `${toolId}.${extension}`
    const filePath = path.join(toolPath, filename)

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      // 如果文件夹为空，删除文件夹
      try {
        const files = fs.readdirSync(toolPath)
        if (files.length === 0) {
          fs.rmdirSync(toolPath)
        }
      } catch (error) {
        // 忽略删除空文件夹的错误
      }
      return true
    } else {
      return false
    }
  } catch (error) {
    console.error("Delete local file error:", error)
    return false
  }
})

// 获取所有本地文件
ipcMain.handle("get-local-files", async () => {
  try {
    const basePath = getDownloadPath()

    if (!fs.existsSync(basePath)) {
      return []
    }

    const localFiles: Array<{filename: string, toolId: string, extension: string}> = []
    const entries = fs.readdirSync(basePath, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // 这是一个工具文件夹
        const toolId = entry.name
        const toolPath = path.join(basePath, toolId)
        
        try {
          const files = fs.readdirSync(toolPath)
          for (const file of files) {
            if (file.includes(".") && file.startsWith(toolId + '.')) {
              const parts = file.split(".")
              const extension = parts.pop()
              localFiles.push({
                filename: file,
                toolId: toolId,
                extension: extension || "",
              })
            }
          }
        } catch (error) {
          console.warn("Failed to read tool directory:", toolPath, error)
        }
      } else if (entry.isFile() && entry.name.includes(".")) {
        // 兼容旧的文件结构（直接在根目录的文件）
        const file = entry.name
        const parts = file.split(".")
        const extension = parts.pop()
        const toolId = parts.join(".")
        localFiles.push({
          filename: file,
          toolId: toolId,
          extension: extension || "",
        })
      }
    }
    return localFiles
  } catch (error) {
    console.error("Get local files error:", error)
    return []
  }
})

ipcMain.handle("start-download", async (event, { downloadId, url, toolId, extension, toolName, toolVersion }) => {
  try {
    if (!win) return false

    // 获取工具专用下载目录
    const downloadPath = getToolDownloadPath(toolId)

    // 自动提取文件扩展名，如果没有提供extension参数
    const fileExtension = extension || getFileExtensionFromUrl(url)

    // 使用工具ID作为文件名
    const filename = `${toolId}.${fileExtension}`

    // 记录下载开始时间
    const startTime = Date.now()
    downloadStartTimes.set(downloadId, startTime)
    downloadLastUpdate.set(downloadId, { time: startTime, bytes: 0 })

    // 使用electron-dl进行下载，添加更多配置选项
    const dl = await download(win, url, {
      directory: downloadPath,
      filename: filename,
      saveAs: false, // 不显示保存对话框
      openFolderWhenDone: false, // 下载完成后不打开文件夹
      showBadge: false, // 不显示徽章
      onStarted: (downloadItem) => {
        console.log("Download started:", downloadItem.getFilename())
        // 存储下载项以便后续控制
        downloadTasks.set(downloadId, downloadItem)
      },
      onProgress: (progress) => {
        const currentTime = Date.now()
        const startTime = downloadStartTimes.get(downloadId) || currentTime
        const lastUpdate = downloadLastUpdate.get(downloadId) || { time: startTime, bytes: 0 }

        // 计算总体平均速度
        const totalElapsed = (currentTime - startTime) / 1000 // 秒
        const totalSpeed = totalElapsed > 0 ? progress.transferredBytes / totalElapsed : 0

        // 计算瞬时速度（最近1秒的速度）
        const timeDiff = (currentTime - lastUpdate.time) / 1000
        const bytesDiff = progress.transferredBytes - lastUpdate.bytes
        const instantSpeed = timeDiff > 0 ? bytesDiff / timeDiff : 0

        // 使用瞬时速度，但如果时间差太小则使用总体速度
        const speed = timeDiff >= 0.5 ? instantSpeed : totalSpeed

        // 更新最后记录
        downloadLastUpdate.set(downloadId, {
          time: currentTime,
          bytes: progress.transferredBytes,
        })

        // 发送进度更新
        const progressPercent = Math.round(progress.percent * 100)

        win?.webContents.send("download-progress", {
          downloadId,
          progress: progressPercent,
          speed: Math.max(0, speed), // 确保速度不为负数
          downloaded: progress.transferredBytes,
          total: progress.totalBytes,
        })
      },
    })

    // 下载完成后生成版本信息文件
    if (toolName && toolVersion) {
      const versionCreated = createToolVersionInfo(toolId, toolName, toolVersion)
      if (versionCreated) {
        console.log(`Version info created for tool ${toolName} (${toolVersion})`)
      } else {
        console.warn(`Failed to create version info for tool ${toolName}`)
      }
    }

    // 下载完成
    win?.webContents.send("download-complete", { downloadId, filename })

    // 清理记录
    downloadTasks.delete(downloadId)
    downloadStartTimes.delete(downloadId)
    downloadLastUpdate.delete(downloadId)

    return true
  } catch (error: any) {
    console.error("Download error:", error)
    win?.webContents.send("download-error", { downloadId, error: error.message })

    // 清理记录
    downloadTasks.delete(downloadId)
    downloadStartTimes.delete(downloadId)
    downloadLastUpdate.delete(downloadId)

    return false
  }
})

ipcMain.handle("pause-download", async (event, downloadId) => {
  try {
    const downloadItem = downloadTasks.get(downloadId)
    if (downloadItem && !downloadItem.isDestroyed()) {
      downloadItem.pause()
      
      // 发送暂停状态更新到前端
      win?.webContents.send("download-paused", { downloadId })
      
      return true
    }
    return false
  } catch (error) {
    console.error("Pause download error:", error)
    return false
  }
})

ipcMain.handle("resume-download", async (event, downloadId) => {
  try {
    const downloadItem = downloadTasks.get(downloadId)
    if (downloadItem && !downloadItem.isDestroyed() && downloadItem.canResume()) {
      downloadItem.resume()
      
      // 重置时间记录，避免暂停时间影响速度计算
      const currentTime = Date.now()
      const lastUpdate = downloadLastUpdate.get(downloadId)
      if (lastUpdate) {
        downloadLastUpdate.set(downloadId, {
          time: currentTime,
          bytes: lastUpdate.bytes,
        })
      }
      
      // 发送恢复状态更新到前端
      win?.webContents.send("download-resumed", { downloadId })
      
      return true
    }
    return false
  } catch (error) {
    console.error("Resume download error:", error)
    return false
  }
})

ipcMain.handle("cancel-download", async (event, downloadId) => {
  try {
    const downloadItem = downloadTasks.get(downloadId)
    if (downloadItem && !downloadItem.isDestroyed()) {
      downloadItem.cancel()
    }

    // 清理所有相关记录
    downloadTasks.delete(downloadId)
    downloadStartTimes.delete(downloadId)
    downloadLastUpdate.delete(downloadId)

    return true
  } catch (error) {
    console.error("Cancel download error:", error)

    // 即使出错也要清理记录
    downloadTasks.delete(downloadId)
    downloadStartTimes.delete(downloadId)
    downloadLastUpdate.delete(downloadId)

    return false
  }
})

ipcMain.handle("window-control", async (event, action) => {
  if (!win) return false

  try {
    switch (action) {
      case "minimize":
        win.minimize()
        return true
      case "maximize":
        if (win.isMaximized()) {
          win.unmaximize()
        } else {
          win.maximize()
        }
        return win.isMaximized()
      case "close":
        win.close()
        return true
      case "isMaximized":
        return win.isMaximized()
      default:
        return false
    }
  } catch (error) {
    console.error("Window control error:", error)
    return false
  }
})

ipcMain.handle("clear-cache", async () => {
  try {
    if (win) {
      await session.defaultSession.clearCache()
      console.log("Cache cleared")
      return true
    }
    return false
  } catch (error) {
    console.error("Clear cache error:", error)
    return false
  }
})

ipcMain.handle("get-download-path", async () => {
  return getDownloadPath()
})

// 设置下载路径
ipcMain.handle("set-download-path", async (event, newPath) => {
  try {
    let targetPath = newPath
    
    // 如果传递空字符串或null，重置为默认路径
    if (!newPath || newPath.trim() === "") {
      targetPath = path.join(require("os").homedir(), "Downloads", "ADOFAI-Tools")
      // 清除自定义路径设置
      customDownloadPath = null
      const configPath = path.join(require("os").homedir(), ".adofai-tools-config.json")
      try {
        if (fs.existsSync(configPath)) {
          const config: any = JSON.parse(fs.readFileSync(configPath, "utf8"))
          delete config.downloadPath
          fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8")
        }
      } catch (configError: any) {
        console.warn("Failed to update config for reset:", configError)
      }
    } else {
      // 验证路径是否存在，如果不存在则尝试创建
      if (!fs.existsSync(targetPath)) {
        fs.mkdirSync(targetPath, { recursive: true })
      }
      
      // 保存新路径
      const success = saveDownloadPath(targetPath)
      if (!success) {
        return { success: false, error: "Failed to save path" }
      }
    }
    
    console.log("Download path updated:", targetPath)
    return { success: true, path: targetPath }
  } catch (error: any) {
    console.error("Set download path error:", error)
    return { success: false, error: error.message }
  }
})

// 选择文件夹
ipcMain.handle("select-folder", async () => {
  try {
    if (!win) return { success: false, error: "Window not available" }
    const result = await dialog.showOpenDialog(win, {
      properties: ["openDirectory", "createDirectory"],
      title: "选择下载文件夹",
      defaultPath: getDownloadPath()
    })
    
    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, path: result.filePaths[0] }
    } else {
      return { success: false, error: "User cancelled" }
    }
  } catch (error: any) {
    console.error("Select folder error:", error)
    return { success: false, error: error.message }
  }
})

// 语言文件相关API
// 获取语言文件目录
function getLanguagesPath() {
  const userDataPath = app.getPath('userData')
  const languagesPath = path.join(userDataPath, 'languages')
  
  // 确保目录存在
  try {
    if (!fs.existsSync(languagesPath)) {
      fs.mkdirSync(languagesPath, { recursive: true })
    }
  } catch (error) {
    console.error("Failed to create languages directory:", error)
  }
  
  return languagesPath
}

// 读取内置语言文件
ipcMain.handle("read-builtin-language", async (event, language) => {
  try {
    // 开发环境和生产环境的路径不同
    let localesPath: string
    if (VITE_DEV_SERVER_URL) {
      // 开发环境
      localesPath = path.join(process.env.APP_ROOT!, 'src', 'locales')
    } else {
      // 生产环境 - locales文件夹在应用程序根目录下
      localesPath = path.join(process.env.APP_ROOT!, 'locales')
    }
    
    const filePath = path.join(localesPath, `${language}.json`)
    
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8')
      return JSON.parse(content)
    } else {
      throw new Error(`Language file not found: ${language}`)
    }
  } catch (error) {
    console.error("Read builtin language error:", error)
    throw error
  }
})

// 读取外部语言文件
ipcMain.handle("read-external-language", async (event, language) => {
  try {
    const languagesPath = getLanguagesPath()
    const filePath = path.join(languagesPath, `${language}.json`)
    
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8')
      return JSON.parse(content)
    } else {
      throw new Error(`External language file not found: ${language}`)
    }
  } catch (error) {
    console.error("Read external language error:", error)
    throw error
  }
})

// 获取外部语言文件列表
ipcMain.handle("get-external-languages", async () => {
  try {
    const languagesPath = getLanguagesPath()
    
    if (!fs.existsSync(languagesPath)) {
      return []
    }
    
    const files = fs.readdirSync(languagesPath)
    const languages = files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''))
    
    return languages
  } catch (error) {
    console.error("Get external languages error:", error)
    return []
  }
})

// 导入语言文件
ipcMain.handle("import-language-file", async (event, filePath, languageCode) => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error("Source file does not exist")
    }
    
    // 验证文件格式
    const content = fs.readFileSync(filePath, 'utf8')
    const languageData = JSON.parse(content)
    
    // 简单验证：检查是否有必要的键
    if (!languageData.common || !languageData.app) {
      throw new Error("Invalid language file format")
    }
    
    const languagesPath = getLanguagesPath()
    const targetPath = path.join(languagesPath, `${languageCode}.json`)
    
    // 复制文件
    fs.copyFileSync(filePath, targetPath)
    
    return true
  } catch (error) {
    console.error("Import language file error:", error)
    throw error
  }
})

// 删除外部语言文件
ipcMain.handle("delete-external-language", async (event, language) => {
  try {
    const languagesPath = getLanguagesPath()
    const filePath = path.join(languagesPath, `${language}.json`)
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      return true
    } else {
      return false
    }
  } catch (error) {
    console.error("Delete external language error:", error)
    throw error
  }
})

// 选择语言文件
ipcMain.handle("select-language-file", async () => {
  try {
    if (!win) return null
    
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      title: '选择语言文件',
      filters: [
        { name: 'JSON Files', extensions: ['json'] }
      ]
    })
    
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0]
    } else {
      return null
    }
  } catch (error) {
    console.error("Select language file error:", error)
    return null
  }
})

// 工具版本信息管理 API
// 获取单个工具的版本信息
ipcMain.handle("get-tool-version-info", async (event, toolId) => {
  try {
    return readToolVersionInfo(toolId)
  } catch (error) {
    console.error("Get tool version info error:", error)
    return null
  }
})

// 获取所有工具的版本信息
ipcMain.handle("get-all-tool-versions", async () => {
  try {
    return getAllToolVersions()
  } catch (error) {
    console.error("Get all tool versions error:", error)
    return {}
  }
})

// 更新工具版本信息
ipcMain.handle("update-tool-version-info", async (event, toolId, newVersion, toolName) => {
  try {
    return updateToolVersionInfo(toolId, newVersion, toolName)
  } catch (error) {
    console.error("Update tool version info error:", error)
    return false
  }
})

// 比较两个版本号
ipcMain.handle("compare-tool-versions", async (event, version1, version2) => {
  try {
    return compareVersions(version1, version2)
  } catch (error) {
    console.error("Compare tool versions error:", error)
    return 0
  }
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
    win = null
  }
})

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  initDownloadPath()
  // 先创建更新窗口而不是主窗口
  createUpdateWindow()
})
app.commandLine.appendSwitch("enable-features", "WebView")
