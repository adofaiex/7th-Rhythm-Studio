type Theme = "light" | "dark" | "system"

class ThemeManager {
  private currentTheme: Theme
  private systemTheme: Exclude<Theme, "system">
  private actualTheme: Exclude<Theme, "system">

  constructor() {
    this.currentTheme = "system"
    this.systemTheme = "light"
    this.actualTheme = "light"

    // 初始化主题
    this.init()
  }

  init() {
    // 从本地存储获取用户设置的主题
    const savedTheme = localStorage.getItem("app-theme")
    if (savedTheme) {
      this.currentTheme = savedTheme as Theme
    }

    // 监听系统主题变化
    this.setupSystemThemeListener()

    // 应用主题
    this.applyTheme()
  }

  setupSystemThemeListener() {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    this.systemTheme = mediaQuery.matches ? "dark" : "light"

    mediaQuery.addEventListener("change", (e) => {
      this.systemTheme = e.matches ? "dark" : "light"
      if (this.currentTheme === "system") {
        this.applyTheme()
      }
    })
  }

  setTheme(theme: Theme) {
    this.currentTheme = theme
    localStorage.setItem("app-theme", theme)
    this.applyTheme()

    // 触发主题变更事件
    window.dispatchEvent(
      new CustomEvent("themeChanged", {
        detail: { theme: this.actualTheme },
      }),
    )
  }

  applyTheme() {
    let themeToApply: Theme | Exclude<Theme, "system"> = this.currentTheme

    if (this.currentTheme === "system") {
      themeToApply = this.systemTheme
    }

    this.actualTheme = (themeToApply === "system" ? this.systemTheme : themeToApply)

    // 移除现有主题类
    document.documentElement.classList.remove("theme-light", "theme-dark")

    // 添加新主题类
    document.documentElement.classList.add(`theme-${themeToApply === "system" ? this.systemTheme : themeToApply}`)

    // 设置CSS变量
    this.setCSSVariables(themeToApply === "system" ? this.systemTheme : themeToApply)
  }

  setCSSVariables(theme: Exclude<Theme, "system">) {
    const root = document.documentElement

    if (theme === "dark") {
      // 深色主题变量
      root.style.setProperty("--bg-primary", "linear-gradient(135deg, #2c3e50 0%, #34495e 100%)")
      root.style.setProperty("--bg-secondary", "rgba(255, 255, 255, 0.05)")
      root.style.setProperty("--bg-tertiary", "rgba(255, 255, 255, 0.1)")
      root.style.setProperty("--bg-quaternary", "rgba(255, 255, 255, 0.15)")
      root.style.setProperty("--text-primary", "#ffffff")
      root.style.setProperty("--text-secondary", "rgba(255, 255, 255, 0.8)")
      root.style.setProperty("--text-tertiary", "rgba(255, 255, 255, 0.6)")
      root.style.setProperty("--border-color", "rgba(255, 255, 255, 0.1)")
      root.style.setProperty("--border-color-hover", "rgba(255, 255, 255, 0.2)")
      root.style.setProperty("--shadow-color", "rgba(0, 0, 0, 0.3)")
      root.style.setProperty("--accent-color", "#667eea")
      root.style.setProperty("--success-color", "#4caf50")
      root.style.setProperty("--error-color", "#f44336")
      root.style.setProperty("--warning-color", "#ff9800")

      // 表单控件专用颜色
      root.style.setProperty("--input-bg", "#2a2a2a")
      root.style.setProperty("--input-text", "#ffffff")
      root.style.setProperty("--input-border", "rgba(255, 255, 255, 0.2)")
      root.style.setProperty("--option-bg", "#2a2a2a")
      root.style.setProperty("--option-text", "#ffffff")
      root.style.setProperty("--option-hover-bg", "#3a3a3a")
    } else {
      // 浅色主题变量
      root.style.setProperty("--bg-primary", "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)")
      root.style.setProperty("--bg-secondary", "rgba(255, 255, 255, 0.8)")
      root.style.setProperty("--bg-tertiary", "rgba(255, 255, 255, 0.9)")
      root.style.setProperty("--bg-quaternary", "rgba(255, 255, 255, 0.95)")
      root.style.setProperty("--text-primary", "#333333")
      root.style.setProperty("--text-secondary", "rgba(0, 0, 0, 0.8)")
      root.style.setProperty("--text-tertiary", "rgba(0, 0, 0, 0.6)")
      root.style.setProperty("--border-color", "rgba(0, 0, 0, 0.1)")
      root.style.setProperty("--border-color-hover", "rgba(0, 0, 0, 0.2)")
      root.style.setProperty("--shadow-color", "rgba(0, 0, 0, 0.1)")
      root.style.setProperty("--accent-color", "#667eea")
      root.style.setProperty("--success-color", "#4caf50")
      root.style.setProperty("--error-color", "#f44336")
      root.style.setProperty("--warning-color", "#ff9800")

      // 表单控件专用颜色
      root.style.setProperty("--input-bg", "#ffffff")
      root.style.setProperty("--input-text", "#333333")
      root.style.setProperty("--input-border", "rgba(0, 0, 0, 0.2)")
      root.style.setProperty("--option-bg", "#ffffff")
      root.style.setProperty("--option-text", "#333333")
      root.style.setProperty("--option-hover-bg", "#f5f5f5")
    }
  }

  getCurrentTheme() {
    return this.currentTheme
  }

  getActualTheme() {
    return this.actualTheme
  }

  getThemeOptions() {
    return [
      { value: "light", label: "settings.themeLight" },
      { value: "dark", label: "settings.themeDark" },
      { value: "system", label: "settings.themeSystem" },
    ]
  }
}

// 创建全局实例
const themeManager = new ThemeManager()

// 导出实例和便捷函数
export default themeManager
export const setTheme = (theme: Theme) => themeManager.setTheme(theme)
export const getCurrentTheme = () => themeManager.getCurrentTheme()
export const getActualTheme = () => themeManager.getActualTheme()
export const getThemeOptions = () => themeManager.getThemeOptions()
