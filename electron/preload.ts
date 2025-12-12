import { ipcRenderer, contextBridge } from "electron"
import { createRequire } from "node:module"
import path from "node:path"

const require = createRequire(path.join(process.env.APP_ROOT, import.meta.url))

// --------- Expose some API to the Renderer process ---------

contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
})

contextBridge.exposeInMainWorld("require", require)

contextBridge.exposeInMainWorld("process", process)

contextBridge.exposeInMainWorld("electronAPI", {
  windowControl: (action: string) => ipcRenderer.invoke("window-control", action),

  clearCache: () => ipcRenderer.invoke("clear-cache"),

  onWindowStateChanged: (callback: (state: unknown) => void) => {
    ipcRenderer.on("window-state-changed", (_event, state) => callback(state))
  },

  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel)
  },

  // 网络请求API
  fetch: (...args: [string, RequestInit?]) => ipcRenderer.invoke("fetch", ...args),

  // 下载相关API
  startDownload: (data: unknown) => ipcRenderer.invoke("start-download", data),
  pauseDownload: (downloadId: string) => ipcRenderer.invoke("pause-download", downloadId),
  resumeDownload: (downloadId: string) => ipcRenderer.invoke("resume-download", downloadId),
  cancelDownload: (downloadId: string) => ipcRenderer.invoke("cancel-download", downloadId),

  onDownloadProgress: (callback: (data: unknown) => void) => {
    ipcRenderer.on("download-progress", (_event, data) => callback(data))
  },

  onDownloadComplete: (callback: (data: unknown) => void) => {
    ipcRenderer.on("download-complete", (_event, data) => callback(data))
  },

  onDownloadError: (callback: (data: unknown) => void) => {
    ipcRenderer.on("download-error", (_event, data) => callback(data))
  },

  onDownloadPaused: (callback: (data: unknown) => void) => {
    ipcRenderer.on("download-paused", (_event, data) => callback(data))
  },

  onDownloadResumed: (callback: (data: unknown) => void) => {
    ipcRenderer.on("download-resumed", (_event, data) => callback(data))
  },

  // 本地文件管理API - 更新为使用工具ID
  checkFileExists: (toolId: string, extension?: string) => ipcRenderer.invoke("check-file-exists", toolId, extension),
  openLocalFile: (toolId: string, extension?: string) => ipcRenderer.invoke("open-local-file", toolId, extension),
  deleteLocalFile: (toolId: string, extension?: string) => ipcRenderer.invoke("delete-local-file", toolId, extension),
  getLocalFiles: () => ipcRenderer.invoke("get-local-files"),
  openExternal: (url: string) => ipcRenderer.invoke("open-external", url),
  //下载路径管理API
  getDownloadPath: () => ipcRenderer.invoke("get-download-path"),
  setDownloadPath: (path: string) => ipcRenderer.invoke("set-download-path", path),
  selectFolder: () => ipcRenderer.invoke("select-folder"),

  // 语言文件管理API
  readBuiltinLanguage: (language: string) => ipcRenderer.invoke("read-builtin-language", language),
  readExternalLanguage: (language: string) => ipcRenderer.invoke("read-external-language", language),
  getExternalLanguages: () => ipcRenderer.invoke("get-external-languages"),
  importLanguageFile: (filePath: string, languageCode: string) => ipcRenderer.invoke("import-language-file", filePath, languageCode),
  deleteExternalLanguage: (language: string) => ipcRenderer.invoke("delete-external-language", language),
  selectLanguageFile: () => ipcRenderer.invoke("select-language-file"),

  // 更新相关API
  checkUpdate: () => {
    console.log("Calling checkUpdate API...");
    return ipcRenderer.invoke("check-update");
  },
  handleAppUpdate: (updateUrl: string) => {
    console.log("Calling handleAppUpdate API with URL:", updateUrl);
    return ipcRenderer.invoke("handle-app-update", updateUrl);
  },
  finishUpdate: () => {
    console.log("Calling finishUpdate API...");
    return ipcRenderer.invoke("finish-update");
  },

  // 工具版本信息管理API
  getToolVersionInfo: (toolId: string) => ipcRenderer.invoke("get-tool-version-info", toolId),
  getAllToolVersions: () => ipcRenderer.invoke("get-all-tool-versions"),
  updateToolVersionInfo: (toolId: string, newVersion: string, toolName: string) => 
    ipcRenderer.invoke("update-tool-version-info", toolId, newVersion, toolName),
  compareToolVersions: (version1: string, version2: string) => 
    ipcRenderer.invoke("compare-tool-versions", version1, version2),
})

export default {}
