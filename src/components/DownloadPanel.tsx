"use client"

import React, { useState, useEffect } from "react"
import PauseIcon from "@material-ui/icons/Pause"
import PlayArrowIcon from "@material-ui/icons/PlayArrow"
import CancelIcon from "@material-ui/icons/Cancel"
import DeleteIcon from "@material-ui/icons/Delete"
import CloseIcon from "@material-ui/icons/Close"
import i18n, { t } from "../utils/i18n"
import "./DownloadPanel.css"

type Props = {
  downloads: any[]
  onPause: (id: string) => void
  onResume: (id: string) => void
  onCancel: (id: string) => void
  onClose: () => void
}

const DownloadPanel: React.FC<Props> = ({ downloads, onPause, onResume, onCancel, onClose }) => {
  const [language, setLanguage] = useState<string>(i18n.getCurrentLanguage())

  useEffect(() => {
    const handleLanguageChange = (event: any) => {
      setLanguage(event.detail.language)
    }
    window.addEventListener("languageChanged", handleLanguageChange as EventListener)
    return () => {
      window.removeEventListener("languageChanged", handleLanguageChange as EventListener)
    }
  }, [])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const formatSpeed = (bytesPerSecond: number) => {
    return formatFileSize(bytesPerSecond) + "/s"
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "downloading":
        return t("download.downloading")
      case "paused":
        return t("download.paused")
      case "completed":
        return t("download.completed")
      case "error":
        return t("download.error")
      default:
        return "Unknown"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "downloading":
        return "#2196F3"
      case "paused":
        return "#FF9800"
      case "completed":
        return "#4CAF50"
      case "error":
        return "#f44336"
      default:
        return "#666"
    }
  }

  return (
    <div className="download-panel">
      <div className="download-panel-header">
        <h3>{t("download.downloadManager")}</h3>
        <button className="close-btn" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>

      <div className="download-list">
        {downloads.length === 0 ? (
          <div className="no-downloads">
            <p>{t("download.noDownloads")}</p>
          </div>
        ) : (
          downloads.map((download: any) => (
            <div key={download.id} className="download-item">
              <div className="download-info">
                <div className="download-header">
                  <img
                    src={download.tool.icon || "/placeholder.svg"}
                    alt={download.tool.name}
                    className="download-icon"
                    onError={(e: any) => {
                      e.target.src =
                        "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iNCIgZmlsbD0iIzMzMzMzMyIvPgo8dGV4dCB4PSIxNiIgeT0iMjAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI4IiBmaWxsPSIjZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5Ub29sPC90ZXh0Pgo8L3N2Zz4K"
                    }}
                  />
                  <div className="download-details">
                    <h4>{download.tool.name}</h4>
                    <div className="download-meta">
                      <span className="status" style={{ color: getStatusColor(download.status) }}>
                        {getStatusText(download.status)}
                      </span>
                      {download.status === "downloading" && (
                        <>
                          <span className="speed">{formatSpeed(download.speed)}</span>
                          <span className="size">
                            {formatFileSize(download.downloaded)} / {formatFileSize(download.total)}
                          </span>
                        </>
                      )}
                      {download.status === "error" && <span className="error-msg">{download.error}</span>}
                    </div>
                  </div>
                </div>

                {download.status !== "completed" && download.status !== "error" && (
                  <div className="progress-container">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${download.progress}%`,
                          backgroundColor: getStatusColor(download.status),
                        }}
                      />
                    </div>
                    <span className="progress-text">{download.progress}%</span>
                  </div>
                )}
              </div>

              <div className="download-actions">
                {download.status === "downloading" && (
                  <button
                    className="action-btn pause-btn"
                    onClick={() => onPause(download.id)}
                    title={t("download.pause")}
                  >
                    <PauseIcon />
                  </button>
                )}

                {download.status === "paused" && (
                  <button
                    className="action-btn resume-btn"
                    onClick={() => onResume(download.id)}
                    title={t("download.resume")}
                  >
                    <PlayArrowIcon />
                  </button>
                )}

                {(download.status === "error" || download.status === "paused") && (
                  <button
                    className="action-btn cancel-btn"
                    onClick={() => onCancel(download.id)}
                    title={t("download.cancel")}
                  >
                    <CancelIcon />
                  </button>
                )}

                {download.status === "completed" && (
                  <button
                    className="action-btn remove-btn"
                    onClick={() => onCancel(download.id)}
                    title={t("download.remove")}
                  >
                    <DeleteIcon />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default DownloadPanel
