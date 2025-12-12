"use client"

import React, { useState, useEffect, useRef } from "react"
import IFrame from "../components/IFrame"
type IFrameControl = {
  reload: () => void
  getCurrentURL: () => string
  getContentWindow: () => Window | null
  getContentDocument: () => Document | null
  iframe: HTMLIFrameElement | null
}
import SearchIcon from "@material-ui/icons/Search"
import ClearIcon from "@material-ui/icons/Clear"
import i18n, { t } from "../utils/i18n"
import { marked } from "marked"
import "./ToolsPage.css"

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

type LocalFileInfo = {
  toolId: string
  path?: string
}

type ToolVersionInfo = {
  version: string
}

type DownloadStatus = "downloading" | "paused" | "completed" | "error"

type DownloadItem = {
  tool: Tool
  status: DownloadStatus
  progress?: number
}

type Props = {
  onStartDownload?: (tool: Tool & { toolName: string; toolVersion: string }) => string
  downloads?: DownloadItem[]
}

const ToolsPage: React.FC<Props> = ({ onStartDownload, downloads }) => {
  const [tools, setTools] = useState<Tool[]>([])
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [localFiles, setLocalFiles] = useState<LocalFileInfo[]>([])
  const [language, setLanguage] = useState<string>(i18n.getCurrentLanguage())
  const [rightPanelContent, setRightPanelContent] = useState<string>("documentation")
  const [filter, setFilter] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [toolVersions, setToolVersions] = useState<Record<string, ToolVersionInfo>>({})
  const iframeRef = useRef<IFrameControl | null>(null)

  useEffect(() => {
    const handleLanguageChange = (event: CustomEvent<{ language: string }>) => {
      setLanguage(event.detail.language)
    }
    window.addEventListener("languageChanged", handleLanguageChange as EventListener)
    return () => {
      window.removeEventListener("languageChanged", handleLanguageChange as EventListener)
    }
  }, [])

  useEffect(() => {
    const fetchTools = async () => {
      try {
        setLoading(true)
        const response = await fetch("https://7th.rhythmdoctor.top/api/tools/get_tools.php")
        if (!response.ok) {
          throw new Error(t("tools.loadFailed"))
        }
        const result = await response.json()
        if (!result.success) {
          throw new Error(result.message || t("tools.loadFailed"))
        }
        const toolsData: Tool[] = result.data?.tools || []
        setTools(toolsData)
        if (toolsData.length > 0) {
          setSelectedTool(toolsData[0])
        }
      } catch (err) {
        const msg = (err as Error).message || t("tools.loadFailed")
        setError(msg)
        console.error("获取工具列表失败:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchTools()
  }, [language])

  useEffect(() => {
    const fetchLocalFiles = async () => {
      if (window.electronAPI) {
        try {
          const files = await window.electronAPI.getLocalFiles()
          setLocalFiles(files as LocalFileInfo[])
        } catch (error) {
          console.error("获取本地文件失败:", error)
        }
      }
    }
    fetchLocalFiles()
  }, [downloads])

  useEffect(() => {
    const fetchToolVersions = async () => {
      if (window.electronAPI) {
        try {
          const versions = await window.electronAPI.getAllToolVersions()
          setToolVersions((versions || {}) as Record<string, ToolVersionInfo>)
        } catch (error) {
          console.error("获取工具版本信息失败:", error)
        }
      }
    }
    fetchToolVersions()
  }, [localFiles])

  const handleToolSelect = (tool: Tool) => {
    setSelectedTool(tool)
    setRightPanelContent("documentation")
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(language)
  }

  const isToolDownloaded = (tool: Tool) => {
    return localFiles.some((file) => file.toolId === tool.id.toString())
  }

  const isToolNeedUpdate = (tool: Tool) => {
    const toolId = tool.id.toString()
    const localVersionInfo = toolVersions[toolId]
    if (!localVersionInfo || !isToolDownloaded(tool)) {
      return false
    }
    try {
      const remoteVersion = tool.version
      const localVersion = localVersionInfo.version
      return compareVersions(remoteVersion, localVersion) > 0
    } catch (error) {
      console.error("版本比较失败:", error)
      return false
    }
  }

  const compareVersions = (version1: string, version2: string) => {
    const v1 = version1.split('.').map(Number)
    const v2 = version2.split('.').map(Number)
    for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
      const num1 = v1[i] || 0
      const num2 = v2[i] || 0
      if (num1 > num2) return 1
      if (num1 < num2) return -1
    }
    return 0
  }

  const getToolStatus = (tool: Tool) => {
    if (!isToolDownloaded(tool)) {
      return 'not-downloaded'
    } else if (isToolNeedUpdate(tool)) {
      return 'need-update'
    } else {
      return 'downloaded'
    }
  }

  const getFilteredTools = (): Tool[] => {
    let filteredTools: Tool[] = tools
    if (filter === "downloaded") {
      filteredTools = filteredTools.filter((tool) => isToolDownloaded(tool))
    } else if (filter === "not-downloaded") {
      filteredTools = filteredTools.filter((tool) => !isToolDownloaded(tool))
    }
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase()
      filteredTools = filteredTools.filter(
        (tool) =>
          tool.name.toLowerCase().includes(searchLower) ||
          (tool.description ?? "").toLowerCase().includes(searchLower) ||
          tool.author.name.toLowerCase().includes(searchLower),
      )
    }
    return filteredTools
  }

  const clearSearch = () => {
    setSearchTerm("")
  }

  const renderMarkdown = (text: string) => {
    return marked.parse(text)
  }

  const handleRightPanelContent = (contentType: string) => {
    setRightPanelContent(contentType)
  }

  const updateDownloadCount = async (toolId: number | string) => {
    try {
      const response = await fetch("https://7th.rhythmdoctor.top/api/tools/update_downloadsnum.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tool_id: toolId.toString()
        })
      })
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const result = await response.json()
      if (result.success) {
        setTools(prevTools =>
          prevTools.map(tool =>
            tool.id === toolId
              ? { ...tool, downloads: result.data.current_downloads }
              : tool
          )
        )
        if (selectedTool && selectedTool.id === toolId) {
          setSelectedTool((prevTool) => prevTool ? { ...prevTool, downloads: result.data.current_downloads } : prevTool)
        }
        return result.data.current_downloads
      } else {
        console.error("更新下载量失败:", result.message)
        return null
      }
    } catch (error) {
      console.error("更新下载量请求失败:", error)
      return null
    }
  }

  const handleDownload = async (tool: Tool) => {
    if (!tool.downloadUrl) {
      alert(t("messages.invalidUrl"))
      return
    }
    if (!onStartDownload) {
      alert(t("messages.downloadFailed"))
      return
    }
    const existingDownload = downloads?.find(
      (d) => d.tool.id === tool.id && (d.status === "downloading" || d.status === "paused"),
    )
    if (existingDownload) {
      alert(t("download.downloading"))
      return
    }
    const downloadData: Tool & { toolName: string; toolVersion: string } = {
      ...tool,
      toolName: tool.name,
      toolVersion: tool.version
    }
    const downloadId = onStartDownload(downloadData)
    console.log("开始下载工具:", tool.name, "版本:", tool.version, "下载ID:", downloadId)
    updateDownloadCount(tool.id).then((newDownloadCount) => {
      if (newDownloadCount !== null) {
        console.log(`工具 ${tool.name} 下载量已更新为: ${newDownloadCount}`)
      }
    }).catch((error) => {
      console.error(`更新工具 ${tool.name} 下载量时出错:`, error)
    })
  }

  const handleUpdate = async (tool: Tool) => {
    if (!tool.downloadUrl) {
      alert(t("messages.invalidUrl"))
      return
    }
    if (!window.electronAPI) {
      alert(t("messages.error"))
      return
    }
    if (!onStartDownload) {
      alert(t("messages.downloadFailed"))
      return
    }
    const confirmMessage = `确定要更新 ${tool.name} 吗？这将删除旧版本并下载最新版本。`
    if (!confirm(confirmMessage)) {
      return
    }
    try {
      const deleteSuccess = await window.electronAPI.deleteLocalFile(tool.id.toString())
      if (!deleteSuccess) {
        console.warn("删除旧版本失败，继续下载新版本")
      }
      const updatedFiles = await window.electronAPI.getLocalFiles()
      setLocalFiles(updatedFiles as LocalFileInfo[])
      const downloadData: Tool & { toolName: string; toolVersion: string } = {
        ...tool,
        toolName: tool.name,
        toolVersion: tool.version
      }
      const downloadId = onStartDownload(downloadData)
      console.log("开始更新工具:", tool.name, "至版本:", tool.version, "下载ID:", downloadId)
      updateDownloadCount(tool.id).then((newDownloadCount) => {
        if (newDownloadCount !== null) {
          console.log(`工具 ${tool.name} 下载量已更新为: ${newDownloadCount}`)
        }
      }).catch((error) => {
        console.error(`更新工具 ${tool.name} 下载量时出错:`, error)
      })
    } catch (error) {
      console.error("更新工具失败:", error)
      const msg = (error as Error).message || ""
      alert("更新失败: " + msg)
    }
  }

  const handleOpenLocal = async (tool: Tool) => {
    if (window.electronAPI) {
      try {
        const success = await window.electronAPI.openLocalFile(tool.id.toString())
        if (!success) {
          alert(t("tools.openFailed"))
          const files = await window.electronAPI.getLocalFiles()
          setLocalFiles(files as LocalFileInfo[])
        }
      } catch (error) {
        console.error("打开文件失败:", error)
        alert(t("tools.openFailed"))
      }
    }
  }

  const handleDeleteLocal = async (tool: Tool) => {
    if (!confirm(t("tools.confirmDelete"))) {
      return
    }
    if (window.electronAPI) {
      try {
        const success = await window.electronAPI.deleteLocalFile(tool.id.toString())
        if (success) {
          alert(t("tools.deleteSuccess"))
          const files = await window.electronAPI.getLocalFiles()
          setLocalFiles(files as LocalFileInfo[])
        } else {
          alert(t("tools.deleteFailed"))
        }
      } catch (error) {
        console.error("删除文件失败:", error)
        alert(t("tools.deleteFailed"))
      }
    }
  }

  const getDownloadButtonClass = (tool: Tool) => {
    if (!downloads || !tool) return ""
    const download = downloads.find((d) => d.tool.id === tool.id)
    if (!download) return ""
    switch (download.status) {
      case "downloading":
        return "downloading"
      case "paused":
        return "paused"
      case "completed":
        return "completed"
      case "error":
        return "error"
      default:
        return ""
    }
  }

  const getDownloadButtonText = (tool: Tool) => {
    if (!downloads || !tool) return t("tools.download")
    const download = downloads.find((d) => d.tool.id === tool.id)
    if (!download) return t("tools.download")
    switch (download.status) {
      case "downloading":
        return `${t("download.downloading")} ${download.progress}%`
      case "paused":
        return t("download.paused")
      case "completed":
        return t("download.completed")
      case "error":
        return t("download.error")
      default:
        return t("tools.download")
    }
  }

  const isDownloading = (tool: Tool) => {
    if (!downloads || !tool) return false
    const download = downloads.find((d) => d.tool.id === tool.id)
    return Boolean(download && (download.status === "downloading" || download.status === "paused"))
  }

  const isDownloadableFile = (url: string | undefined) => {
    if (!url) return false
    const downloadableExtensions = ['.zip', '.rar', '.7z', '.exe', '.msi', '.dmg', '.pkg', '.deb', '.rpm', '.apk', '.jar', '.tar', '.gz', '.bz2', '.xz']
    const urlLower = url.toLowerCase()
    return downloadableExtensions.some(ext => urlLower.endsWith(ext))
  }

  const handleOpenExternal = async (url: string, tool: Tool | null = null) => {
    if (window.electronAPI) {
      try {
        const success = await window.electronAPI.openExternal(url)
        if (!success) {
          alert(t("messages.error"))
        } else if (tool) {
          updateDownloadCount(tool.id).then((newDownloadCount) => {
            if (newDownloadCount !== null) {
              console.log(`工具 ${tool.name} 下载量已更新为: ${newDownloadCount}`)
            }
          }).catch((error) => {
            console.error(`更新工具 ${tool.name} 下载量时出错:`, error)
          })
        }
      } catch (error) {
        console.error("打开外部链接失败:", error)
        alert(t("messages.error"))
      }
    }
  }

  const filteredTools = getFilteredTools()

  if (loading) {
    return (
      <div className="tools-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>{t("tools.loadingTools")}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="tools-page">
        <div className="error-container">
          <h2>{t("tools.loadFailed")}</h2>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>{t("tools.retry")}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="tools-page">
      <div className="tools-left-panel">
        <div className="tool-details">
          {selectedTool ? (
            <>
              <div className="tool-header">
                <img
                  src={selectedTool.icon || "/placeholder.svg"}
                  alt={selectedTool.name}
                  className="tool-icon"
                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                    e.currentTarget.src =
                      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iOCIgZmlsbD0iIzMzMzMzMyIvPgo8dGV4dCB4PSIzMiIgeT0iMzgiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+VG9vbDwvdGV4dD4KPHN2Zz4K"
                  }}
                />
                <div className="tool-info">
                  <h2>{selectedTool.name}</h2>
                  <div className="tool-meta">
                    <span className="version">{selectedTool.version}</span>
                    <span className="downloads">
                      {selectedTool.downloads} {t("tools.downloads")}
                    </span>
                    <span className="release-date">{formatDate(selectedTool.releaseDate)}</span>
                  </div>
                </div>
              </div>

              <div className="tool-author">
                <img
                  src={selectedTool.author.avatar || "/placeholder.svg"}
                  alt={selectedTool.author.name}
                  className="author-avatar"
                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                    e.currentTarget.src =
                      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTYiIGZpbGw9IiM2NjY2NjYiLz4KPGNpcmNsZSBjeD0iMTYiIGN5PSIxMiIgcj0iNSIgZmlsbD0iI2ZmZiIvPgo8cGF0aCBkPSJNNiAyNmMwLTUuNSA0LjUtMTAgMTAtMTBzMTAgNC41IDEwIDEwIiBmaWxsPSIjZmZmIi8+Cjwvc3ZnPgo="
                  }}
                />
                <a 
                  href={selectedTool.author.link || "#"} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="author-name-link"
                  title={t("tools.viewHomepage")}
                >
                  {selectedTool.author.name}
                </a>
                <div className="author-buttons">
                  {selectedTool.description && (
                    <button 
                      className={`btn-description ${rightPanelContent === 'description' ? 'active' : ''}`}
                      onClick={() => handleRightPanelContent('description')}
                    >
                      {t("tools.description")}
                    </button>
                  )}
                  {selectedTool.changelog && (
                    <button 
                      className={`btn-changelog-compact ${rightPanelContent === 'changelog' ? 'active' : ''}`}
                      onClick={() => handleRightPanelContent('changelog')}
                    >
                      {t("tools.changelog")}
                    </button>
                  )}
                </div>
              </div>

              {selectedTool.description && (
                <div className="tool-brief-description">
                  <div className="brief-description-content">
                    {selectedTool.description}
                  </div>
                </div>
              )}

              <div className="tool-actions">
                <div className="download-actions">
                  {(() => {
                    const toolStatus = getToolStatus(selectedTool)
                    if (toolStatus === 'need-update') {
                      return (
                        <div className="update-actions">
                          <button
                            className="btn-update"
                            onClick={() => handleUpdate(selectedTool)}
                            disabled={isDownloading(selectedTool)}
                          >
                            {isDownloading(selectedTool) ? getDownloadButtonText(selectedTool) : "更新"}
                          </button>
                          <div className="local-actions">
                            <button className="btn-open" onClick={() => handleOpenLocal(selectedTool)}>
                              {t("tools.open")}
                            </button>
                            <button className="btn-delete" onClick={() => handleDeleteLocal(selectedTool)}>
                              {t("tools.delete")}
                            </button>
                          </div>
                        </div>
                      )
                    } else if (toolStatus === 'downloaded') {
                      return (
                        <div className="local-actions">
                          <button className="btn-open" onClick={() => handleOpenLocal(selectedTool)}>
                            {t("tools.open")}
                          </button>
                          <button className="btn-delete" onClick={() => handleDeleteLocal(selectedTool)}>
                            {t("tools.delete")}
                          </button>
                        </div>
                      )
                    } else {
                      if (isDownloadableFile(selectedTool.downloadUrl)) {
                        return (
                          <button
                            className={`btn-download ${getDownloadButtonClass(selectedTool)}`}
                            onClick={() => handleDownload(selectedTool)}
                            disabled={isDownloading(selectedTool)}
                          >
                            {getDownloadButtonText(selectedTool)}
                          </button>
                        )
                      } else if (selectedTool.downloadUrl) {
                        return (
                          <button
                            className="btn-external"
                            onClick={() => {
                              const url = selectedTool.downloadUrl as string
                              handleOpenExternal(url, selectedTool)
                            }}
                          >
                            {t("tools.openInBrowser")}
                          </button>
                        )
                      }
                      return null
                    }
                  })()}
                </div>
              </div>
            </>
          ) : (
            <div className="no-tool-selected">
              <p>{t("tools.noToolSelected")}</p>
            </div>
          )}
        </div>

        <div className="tools-list">
          <div className="tools-list-header">
            <div className="tools-list-title">
              <h3>{t("tools.toolsList")}</h3>
              <div className="filter-buttons">
                <button className={`filter-btn ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>
                  {t("tools.filterAll")}
                </button>
                <button
                  className={`filter-btn ${filter === "downloaded" ? "active" : ""}`}
                  onClick={() => setFilter("downloaded")}
                >
                  {t("tools.filterDownloaded")}
                </button>
                <button
                  className={`filter-btn ${filter === "not-downloaded" ? "active" : ""}`}
                  onClick={() => setFilter("not-downloaded")}
                >
                  {t("tools.filterNotDownloaded")}
                </button>
              </div>
            </div>
            <div className="search-container">
              <div className="search-input-wrapper">
                <SearchIcon className="search-icon" />
                <input
                  type="text"
                  placeholder={t("tools.searchPlaceholder")}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                {searchTerm && (
                  <button className="clear-search-btn" onClick={clearSearch}>
                    <ClearIcon />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="tools-grid">
            {filteredTools.length === 0 ? (
              <div className="no-tools-found">
                <p>
                  {searchTerm
                    ? t("tools.noSearchResults")
                    : filter === "downloaded"
                      ? t("tools.noDownloadedTools")
                      : filter === "not-downloaded"
                        ? t("tools.noNotDownloadedTools")
                        : t("tools.noTools")}
                </p>
              </div>
            ) : (
              filteredTools.map((tool) => (
                <div
                  key={tool.id}
                  className={`tool-item ${selectedTool?.id === tool.id ? "selected" : ""} ${
                    getToolStatus(tool) === 'downloaded' ? "downloaded" : ""
                  } ${
                    getToolStatus(tool) === 'need-update' ? "need-update" : ""
                  }`}
                  onClick={() => handleToolSelect(tool)}
                >
                <img
                  src={tool.icon || "/placeholder.svg"}
                  alt={tool.name}
                  className="tool-item-icon"
                  onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                    e.currentTarget.src =
                      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iNCIgZmlsbD0iIzMzMzMzMyIvPgo8dGV4dCB4PSIyMCIgeT0iMjQiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMCIgZmlsbD0iI2ZmZiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+VG9vbDwvdGV4dD4KPHN2Zz4K"
                  }}
                />
                  <div className="tool-item-info">
                    <h4>{tool.name}</h4>
                    <p>{tool.description}</p>
                    <div className="tool-item-meta">
                      <span>{tool.version}</span>
                      <span>
                        {tool.downloads} {t("tools.downloads")}
                      </span>
                      {(() => {
                        const status = getToolStatus(tool)
                        if (status === 'need-update') {
                          return <span className="update-badge">🔄 需要更新</span>
                        } else if (status === 'downloaded') {
                          return <span className="local-badge">📁 已下载</span>
                        }
                        return null
                      })()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="tools-right-panel">
        <div className="documentation-container">
          {selectedTool ? (
            rightPanelContent === "description" && selectedTool.description ? (
              <div className="changelog-display">
                <div className="changelog-header">
                  <h3>
                    {selectedTool.name} - {t("tools.description")}
                  </h3>
                </div>
                <div
                  className="changelog-content"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(selectedTool.description || ""),
                  }}
                />
              </div>
            ) : rightPanelContent === "changelog" && selectedTool.changelog ? (
              <div className="changelog-display">
                <div className="changelog-header">
                  <h3>
                    {selectedTool.name} - {t("tools.changelog")}
                  </h3>
                </div>
                <div
                  className="changelog-content"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(selectedTool.changelog || ""),
                  }}
                />
              </div>
            ) : selectedTool.documentation ? (
              <IFrame
                ref={iframeRef}
                src={selectedTool.documentation}
                className="documentation-iframe"
                title={`${selectedTool.name} ${t("tools.documentation")}`}
                onLoad={() => console.log("文档加载完成")}
                onError={() => console.error("文档加载失败")}
                allowFullScreen={false}
                loading="eager"
              />
            ) : (
              <div className="no-documentation">
                <h3>{t("tools.documentation")}</h3>
                <p>{t("tools.noDocumentation")}</p>
              </div>
            )
          ) : (
            <div className="no-documentation">
              <h3>{t("tools.documentation")}</h3>
              <p>{t("tools.noDocumentation")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ToolsPage
