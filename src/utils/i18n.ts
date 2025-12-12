type TranslationValue = string | TranslationObject
interface TranslationObject {
  [key: string]: TranslationValue
}

class I18n {
  currentLanguage: string
  translations: Record<string, TranslationObject>
  fallbackLanguage: string
  loadedLanguages: Set<string>
  externalLanguages: Set<string>
  
  constructor() {
    this.currentLanguage = "zh-CN"
    this.translations = {}
    this.fallbackLanguage = "en-US"
    this.loadedLanguages = new Set()
    this.externalLanguages = new Set()

    // 初始化默认语言
    this.init()
  }

  async init() {
    // 从本地存储获取用户设置的语言
    const savedLanguage = localStorage.getItem("app-language")
    if (savedLanguage) {
      this.currentLanguage = savedLanguage
    } else {
      // 自动检测系统语言
      const systemLanguage = this.detectSystemLanguage()
      this.currentLanguage = systemLanguage
    }

    // 加载外部语言列表
    await this.loadExternalLanguagesList()

    // 尝试加载当前语言
    await this.loadLanguage(this.currentLanguage)

    // 如果当前语言加载失败（比如外部语言文件不存在），回退到默认语言
    if (!this.loadedLanguages.has(this.currentLanguage)) {
      console.warn(`Failed to load saved language: ${this.currentLanguage}, falling back to ${this.fallbackLanguage}`)
      this.currentLanguage = this.fallbackLanguage
      localStorage.setItem("app-language", this.fallbackLanguage)
      await this.loadLanguage(this.currentLanguage)
    }

    // 如果当前语言不是fallback语言，也加载fallback语言
    if (this.currentLanguage !== this.fallbackLanguage) {
      await this.loadLanguage(this.fallbackLanguage)
    }
  }

  detectSystemLanguage() {
    const systemLang = navigator.language
    const supportedLanguages = ["zh-CN", "en-US", "ja-JP", "ko-KR"]

    // 精确匹配
    if (supportedLanguages.includes(systemLang)) {
      return systemLang
    }

    // 语言代码匹配
    const langCode = systemLang.split("-")[0]
    const langMap = {
      zh: "zh-CN",
      en: "en-US",
      ja: "ja-JP",
      ko: "ko-KR",
    }

    return langMap[langCode as keyof typeof langMap] || "en-US"
  }

  async loadExternalLanguagesList() {
    try {
      if (window.electronAPI) {
        const externalLanguages = await window.electronAPI.getExternalLanguages()
        this.externalLanguages = new Set(externalLanguages)
      }
    } catch (error) {
      console.warn("Failed to load external languages list:", error)
    }
  }

  async loadLanguage(language: string) {
    if (this.loadedLanguages.has(language)) {
      return
    }

    // 检查是否为electron环境
    if (window.electronAPI) {
      // 优先尝试从外部语言文件加载
      if (this.externalLanguages.has(language)) {
        try {
          const translations = await window.electronAPI.readExternalLanguage(language)
          if (translations) {
            this.translations[language] = translations as TranslationObject
            this.loadedLanguages.add(language)
            console.log(`Loaded external language file: ${language}`)
            return
          }
        } catch (error) {
          console.warn(`Failed to load external language ${language}:`, error)
        }
      }

      // 尝试从内置语言文件加载
      try {
        const translations = await window.electronAPI.readBuiltinLanguage(language)
        if (translations) {
          this.translations[language] = translations as TranslationObject
          this.loadedLanguages.add(language)
          console.log(`Loaded built-in language file: ${language}`)
          return
        }
      } catch (error) {
        console.warn(`Failed to load built-in language ${language}:`, error)
      }
    } else {
      // 浏览器环境，使用fetch（开发环境）
      try {
        const response = await fetch(`/src/locales/${language}.json`)
        if (response.ok) {
          const translations = await response.json()
          this.translations[language] = translations as TranslationObject
          this.loadedLanguages.add(language)
          console.log(`Loaded language file via fetch: ${language}`)
          return
        }
      } catch (error) {
        console.warn(`Failed to load language via fetch ${language}:`, error)
      }
    }

    console.error(`Failed to load language: ${language}`)
  }

  async setLanguage(language: string) {
    if (language === this.currentLanguage) {
      return
    }

    await this.loadLanguage(language)
    this.currentLanguage = language
    localStorage.setItem("app-language", language)

    // 触发语言变更事件
    window.dispatchEvent(
      new CustomEvent("languageChanged", {
        detail: { language },
      }),
    )
  }

  t(key: string, params: Record<string, string | number> = {}) {
    const keys = key.split(".")
    let value: TranslationValue | null = this.translations[this.currentLanguage]

    // 尝试从当前语言获取翻译
    for (const k of keys) {
      if (value && typeof value === "object" && k in (value as TranslationObject)) {
        value = (value as TranslationObject)[k]
      } else {
        value = null
        break
      }
    }

    // 如果当前语言没有找到，尝试从fallback语言获取
    if (value === null && this.currentLanguage !== this.fallbackLanguage) {
      value = this.translations[this.fallbackLanguage]
      for (const k of keys) {
        if (value && typeof value === "object" && k in (value as TranslationObject)) {
          value = (value as TranslationObject)[k]
        } else {
          value = null
          break
        }
      }
    }

    // 如果还是没找到，返回key本身
    if (value === null) {
      console.warn(`Translation not found for key: ${key}`)
      return key
    }

    // 参数替换
    if (typeof value === "string" && Object.keys(params).length > 0) {
      return (value as string).replace(/\{\{(\w+)\}\}/g, (_match, param: string) => {
        const p = params[param]
        return p !== undefined ? String(p) : `{{${param}}}`
      })
    }

    return value as string
  }

  getCurrentLanguage() {
    return this.currentLanguage
  }

  getSupportedLanguages() {
    const builtinLanguages = [
      { code: "zh-CN", name: "简体中文", type: "builtin" },
      { code: "en-US", name: "English", type: "builtin" },
      { code: "ja-JP", name: "日本語", type: "builtin" },
      { code: "ko-KR", name: "한국어", type: "builtin" },
    ]

    // 添加外部语言
    const externalLanguages = Array.from(this.externalLanguages).map(code => ({
      code,
      name: this.getLanguageDisplayName(code),
      type: "external"
    }))

    return [...builtinLanguages, ...externalLanguages]
  }

  getLanguageDisplayName(code: string) {
    // 尝试从已加载的翻译中获取语言名称
    const langData = this.translations[code]
    if (langData && typeof langData === "object") {
      const appSection = (langData as TranslationObject)["app"]
      if (appSection && typeof appSection === "object") {
        const name = (appSection as TranslationObject)["languageName"]
        if (typeof name === "string") {
          return name
        }
      }
    }

    // 默认显示名称映射
    const defaultNames: Record<string, string> = {
      "zh-CN": "简体中文",
      "en-US": "English", 
      "ja-JP": "日本語",
      "ko-KR": "한국어",
      "zh-TW": "繁體中文",
      "fr-FR": "Français",
      "de-DE": "Deutsch",
      "es-ES": "Español",
      "ru-RU": "Русский",
      "pt-BR": "Português (Brasil)",
      "it-IT": "Italiano",
      "nl-NL": "Nederlands",
      "sv-SE": "Svenska",
      "da-DK": "Dansk",
      "no-NO": "Norsk",
      "fi-FI": "Suomi",
      "pl-PL": "Polski",
      "cs-CZ": "Čeština",
      "hu-HU": "Magyar",
      "tr-TR": "Türkçe",
      "ar-SA": "العربية",
      "he-IL": "עברית",
      "th-TH": "ไทย",
      "vi-VN": "Tiếng Việt",
      "id-ID": "Bahasa Indonesia",
      "ms-MY": "Bahasa Melayu",
      "hi-IN": "हिन्दी",
      "bn-BD": "বাংলা",
      "ur-PK": "اردو"
    }

    return defaultNames[code] || code
  }

  async selectAndImportLanguageFile(): Promise<string | null> {
    try {
      if (!window.electronAPI) {
        throw new Error("This feature is only available in the desktop app")
      }

      // 选择文件
      const filePath = await window.electronAPI.selectLanguageFile()
      if (!filePath) {
        return null // 用户取消选择
      }

      // 从文件名推断语言代码
      const fileName = filePath.split(/[/\\]/).pop()!.replace(".json", "")
      const language = fileName.includes("-") ? fileName : `${fileName}-CUSTOM`

      // 导入文件（复制到用户数据目录）
      await window.electronAPI.importLanguageFile(filePath, language)

      // 重新加载外部语言列表
      await this.loadExternalLanguagesList()

      // 加载新导入的语言
      await this.loadLanguage(language)

      console.log(`Language file imported successfully: ${language}`)
      return language
    } catch (error) {
      console.error("Failed to import language file:", error)
      throw error
    }
  }

  async deleteExternalLanguage(language: string): Promise<boolean> {
    try {
      if (!window.electronAPI) {
        throw new Error("This feature is only available in the desktop app")
      }

      const success = await window.electronAPI.deleteExternalLanguage(language)
      if (success) {
        // 从内存中移除
        delete this.translations[language]
        this.loadedLanguages.delete(language)
        this.externalLanguages.delete(language)

        // 如果当前语言被删除，切换到默认语言
        if (this.currentLanguage === language) {
          await this.setLanguage(this.fallbackLanguage)
        }

        console.log(`External language deleted: ${language}`)
        return true
      }
      return false
    } catch (error) {
      console.error("Failed to delete external language:", error)
      throw error
    }
  }

  async refreshExternalLanguages(): Promise<void> {
    try {
      await this.loadExternalLanguagesList()
      
      // 重新加载当前语言（如果是外部语言）
      if (this.externalLanguages.has(this.currentLanguage)) {
        this.loadedLanguages.delete(this.currentLanguage)
        await this.loadLanguage(this.currentLanguage)
      }
    } catch (error) {
      console.error("Failed to refresh external languages:", error)
    }
  }

  // 保留原有的importLanguageFile方法用于向后兼容（浏览器环境）
  async importLanguageFile(file: File): Promise<string> {
    try {
      const text = await file.text()
      const translations = JSON.parse(text)

      // 验证文件格式
      if (!this.validateLanguageFile(translations)) {
        throw new Error("Invalid language file format")
      }

      // 从文件名推断语言代码
      const fileName = file.name.replace(".json", "")
      const language = fileName.includes("-") ? fileName : `${fileName}-CUSTOM`

      this.translations[language] = translations as TranslationObject
      this.loadedLanguages.add(language)

      console.log(`Imported language file (temporary): ${language}`)
      return language
    } catch (error) {
      console.error("Failed to import language file:", error)
      throw error
    }
  }

  validateLanguageFile(translations: any): boolean {
    // 基本结构验证
    const requiredKeys = ["common", "app", "tools"]
    return requiredKeys.every((key) => key in translations)
  }

  exportLanguageFile(language: string = this.currentLanguage): void {
    const translations = this.translations[language]
    if (!translations) {
      throw new Error(`Language ${language} not found`)
    }

    const blob = new Blob([JSON.stringify(translations, null, 2)], {
      type: "application/json",
    })

    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${language}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}

// 创建全局实例
const i18n = new I18n()

// 导出实例和便捷函数
export default i18n
export const t = (key: string, params?: Record<string, string | number>) => i18n.t(key, params ?? {})
export const setLanguage = (language: string) => i18n.setLanguage(language)
export const getCurrentLanguage = () => i18n.getCurrentLanguage()
export const getSupportedLanguages = () => i18n.getSupportedLanguages()
export const selectAndImportLanguageFile = () => i18n.selectAndImportLanguageFile()
export const deleteExternalLanguage = (language: string) => i18n.deleteExternalLanguage(language)
export const refreshExternalLanguages = () => i18n.refreshExternalLanguages()
export const exportLanguageFile = (language?: string) => i18n.exportLanguageFile(language ?? i18n.getCurrentLanguage())
export const importLanguageFile = (file: File) => i18n.importLanguageFile(file)
