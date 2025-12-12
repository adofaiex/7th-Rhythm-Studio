"use client"

import { useState, useEffect } from "react"
import TitleBar from "./components/TitleBar"
import Sidebar from "./components/Sidebar"
import HomePage from "./pages/HomePage"
import ToolsPage from "./pages/ToolsPage"
import SettingsPage from "./pages/SettingsPage"
import CommunityPage from "./pages/CommunityPage"
import OnlineToolsPage from "./pages/OnlineToolsPage"
import DevPage from "./pages/Dev"
import UpdatePage from "./pages/UpdatePage"
import DownloadPanel from "./components/DownloadPanel"
import { navigateIFrame } from "./components/IFrame"
import i18n, { t } from "./utils/i18n"
import GetAppIcon from "@material-ui/icons/GetApp"
import VersionManager from './utils/VersionManager'

import "./App.css"

type Author = {
  name: string
  avatar?: string
  link?: string
}

type Tool = {
  id: number | string
  name: string
  description?: string
  version: string
  downloads: number
  releaseDate: string
  icon?: string
  downloadUrl?: string
  documentation?: string
  changelog?: string
  author: Author
}

type DownloadStatus = "downloading" | "paused" | "completed" | "error"

type AppDownloadItem = {
  id: string
  tool: Tool
  status: DownloadStatus
  progress?: number
  speed: number
  downloaded: number
  total: number
  error: string | null
}

function App() {
  const [currentTime, setCurrentTime] = useState<Date>(new Date())
  const [activeTab, setActiveTab] = useState<string>("home")
  const [downloads, setDownloads] = useState<AppDownloadItem[]>([])
  const [showDownloads, setShowDownloads] = useState<boolean>(false)
  const [language, setLanguage] = useState<string>(i18n.getCurrentLanguage())
  const [currentRoute, setCurrentRoute] = useState<string>(window.location.hash.replace('#', '') || 'main')

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentRoute(window.location.hash.replace('#', '') || 'main')
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  useEffect(() => {
    const handleLanguageChange = (event: any) => {
      setLanguage(event.detail.language)
    }
    window.addEventListener("languageChanged", handleLanguageChange as EventListener)
    return () => {
      window.removeEventListener("languageChanged", handleLanguageChange as EventListener)
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (date: Date) => {
    return date.toLocaleString(language, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
  }

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    console.log("切换到标签页:", tabId)
  }

  const handleNavigate = (action: string) => {
    const success = navigateIFrame(action)
    if (success) {
      console.log(`导航操作 ${action} 执行成功`)
    } else {
      console.log(`导航操作 ${action} 执行失败`)
    }
  }

  const startDownload = (tool: Tool & { toolName: string; toolVersion: string }) => {
    const downloadId = Date.now().toString()
    if (!tool.downloadUrl) {
      console.error("无效的下载链接")
      return downloadId
    }
    const newDownload: AppDownloadItem = {
      id: downloadId,
      tool,
      progress: 0,
      status: "downloading",
      speed: 0,
      downloaded: 0,
      total: 0,
      error: null,
    }
    setDownloads((prev) => [...prev, newDownload])
    performDownload(downloadId, tool)
    return downloadId
  }

  const pauseDownload = (downloadId: string) => {
    if (window.electronAPI) {
      window.electronAPI.pauseDownload(downloadId)
    }
  }

  const resumeDownload = (downloadId: string) => {
    if (window.electronAPI) {
      window.electronAPI.resumeDownload(downloadId)
    }
  }

  const cancelDownload = (downloadId: string) => {
    setDownloads((prev) => prev.filter((download) => download.id !== downloadId))
    if (window.electronAPI) {
      window.electronAPI.cancelDownload(downloadId)
    }
  }

  const performDownload = async (downloadId: string, tool: Tool & { toolName: string; toolVersion: string }) => {
    try {
      if (!window.electronAPI) {
        throw new Error("Electron API 不可用")
      }
      window.electronAPI.removeAllListeners("download-progress")
      window.electronAPI.removeAllListeners("download-complete")
      window.electronAPI.removeAllListeners("download-error")
      window.electronAPI.removeAllListeners("download-paused")
      window.electronAPI.removeAllListeners("download-resumed")

      window.electronAPI.onDownloadProgress((data: any) => {
        if (data.downloadId === downloadId) {
          setDownloads((prev) =>
            prev.map((download) =>
              download.id === downloadId
                ? {
                    ...download,
                    progress: data.progress,
                    speed: data.speed,
                    downloaded: data.downloaded,
                    total: data.total,
                  }
                : download,
            ),
          )
        }
      })

      window.electronAPI.onDownloadComplete((data: any) => {
        if (data.downloadId === downloadId) {
          setDownloads((prev) =>
            prev.map((download) =>
              download.id === downloadId ? { ...download, status: "completed", progress: 100 } : download,
            ),
          )
          console.log(`下载完成: ${data.filename || tool.name}`)
        }
      })

      window.electronAPI.onDownloadError((data: any) => {
        if (data.downloadId === downloadId) {
          console.error("下载错误:", data.error)
          setDownloads((prev) =>
            prev.map((download) =>
              download.id === downloadId ? { ...download, status: "error", error: data.error } : download,
            ),
          )
        }
      })

      window.electronAPI.onDownloadPaused((data: any) => {
        if (data.downloadId === downloadId) {
          setDownloads((prev) =>
            prev.map((download) =>
              download.id === downloadId ? { ...download, status: "paused" } : download,
            ),
          )
        }
      })

      window.electronAPI.onDownloadResumed((data: any) => {
        if (data.downloadId === downloadId) {
          setDownloads((prev) =>
            prev.map((download) =>
              download.id === downloadId ? { ...download, status: "downloading" } : download,
            ),
          )
        }
      })

      const result = await window.electronAPI.startDownload({
        downloadId,
        url: tool.downloadUrl!,
        toolId: tool.id.toString(),
        toolName: tool.toolName || tool.name,
        toolVersion: tool.toolVersion || tool.version,
      })

      if (!result) {
        throw new Error("下载启动失败")
      }
    } catch (error: any) {
      console.error("下载失败:", error)
      setDownloads((prev) =>
        prev.map((download) =>
          download.id === downloadId ? { ...download, status: "error", error: error.message } : download,
        ),
      )
    }
  }

  const renderMainContent = () => {
    switch (activeTab) {
      case "home":
        return <HomePage onNavigate={handleTabChange} />
      case "tools":
        return <ToolsPage onStartDownload={startDownload} downloads={downloads} />
      case "community":
        return <CommunityPage />
      case "online_tools":
        return <OnlineToolsPage />
      case "developer":
        return <DevPage />
      case "settings":
        return <SettingsPage />
      default:
        return <HomePage onNavigate={handleTabChange} />
    }
  }

  if (currentRoute === '/update' || currentRoute === 'update') {
    return <UpdatePage />
  }

  return (
    <div className="App">
      <TitleBar onNavigate={handleNavigate} />
      <div className="app-body">
        <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
        <div className="main-content">{renderMainContent()}</div>
      </div>
      {showDownloads && (
        <DownloadPanel
          downloads={downloads}
          onPause={pauseDownload}
          onResume={resumeDownload}
          onCancel={cancelDownload}
          onClose={() => setShowDownloads(false)}
        />
      )}
      {downloads.length > 0 && (
        <button
          className="download-toggle-btn"
          onClick={() => setShowDownloads(!showDownloads)}
          title={t("download.downloadManager")}
        >
          <span className="download-count">{downloads.length}</span>
          <GetAppIcon />
        </button>
      )}
    </div>
  )
}

export default App
