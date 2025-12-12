declare global {
  interface Window {
    electronAPI?: {
      fetch: (url: string, init?: RequestInit) => Promise<string>
      getLocalFiles: () => Promise<Array<{ toolId: string; path?: string }>>
      getAllToolVersions: () => Promise<Record<string, { version: string }>>
      deleteLocalFile: (id: string) => Promise<boolean>
      openLocalFile: (id: string) => Promise<boolean>
      openExternal: (url: string) => Promise<boolean>
      checkUpdate: () => Promise<{ version: string; min_version?: string; update: { windows?: string; macos?: string } }>
      handleAppUpdate: (url: string) => Promise<void>
      finishUpdate: () => Promise<void>
      windowControl: (action: string) => void
      selectFolder: () => Promise<{ success: boolean; path?: string }>
      setDownloadPath: (path: string) => Promise<{ success: boolean; path?: string; error?: string }>
      getDownloadPath: () => Promise<string>
      readBuiltinLanguage: (language: string) => Promise<Record<string, any>>
      readExternalLanguage: (language: string) => Promise<Record<string, any> | null>
      getExternalLanguages: () => Promise<string[]>
      importLanguageFile: (filePath: string, languageCode: string) => Promise<boolean>
      deleteExternalLanguage: (language: string) => Promise<boolean>
      selectLanguageFile: () => Promise<string | null>
      startDownload: (data: { downloadId: string; url: string; toolId: string; toolName?: string; toolVersion?: string }) => Promise<boolean>
      pauseDownload: (downloadId: string) => Promise<boolean>
      resumeDownload: (downloadId: string) => Promise<boolean>
      cancelDownload: (downloadId: string) => Promise<boolean>
      onDownloadProgress: (callback: (data: unknown) => void) => void
      onDownloadComplete: (callback: (data: unknown) => void) => void
      onDownloadError: (callback: (data: unknown) => void) => void
      onDownloadPaused: (callback: (data: unknown) => void) => void
      onDownloadResumed: (callback: (data: unknown) => void) => void
      removeAllListeners: (channel: string) => void
    }
    ipcRenderer?: {
      on: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => void
    }
  }
}

export {}
