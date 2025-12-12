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
    }
    ipcRenderer?: {
      on: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => void
    }
  }
}

export {}
