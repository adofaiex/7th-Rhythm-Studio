"use client"

import React, { useRef, useState, forwardRef, useImperativeHandle, useEffect } from "react"
import i18n, { t } from "../utils/i18n"
import "./IFrame.css"

let currentActiveIFrame: any = null

export const navigateIFrame = (action: string) => {
  if (!currentActiveIFrame) {
    return false
  }
  try {
    switch (action) {
      case "back": {
        const contentWindow = currentActiveIFrame.getContentWindow()
        if (contentWindow && contentWindow.history) {
          contentWindow.history.back()
          return true
        }
        break
      }
      case "forward": {
        const forwardWindow = currentActiveIFrame.getContentWindow()
        if (forwardWindow && forwardWindow.history) {
          forwardWindow.history.forward()
          return true
        }
        break
      }
      case "refresh":
        currentActiveIFrame.reload()
        return true
      default:
        return false
    }
  } catch (_error) {
    if (action === "refresh") {
      currentActiveIFrame.reload()
      return true
    }
    return false
  }
}

export const getCurrentIFrameInfo = () => {
  if (!currentActiveIFrame) {
    return null
  }
  try {
    return {
      url: currentActiveIFrame.getCurrentURL(),
      canGoBack: true,
      canGoForward: true,
    }
  } catch (_error) {
    return {
      url: "Unknown (Cross-origin)",
      canGoBack: false,
      canGoForward: false,
    }
  }
}

export type IFrameProps = {
  src: string
  className?: string
  style?: React.CSSProperties
  onLoad?: () => void
  onError?: () => void
  title?: string
  allowFullScreen?: boolean
  sandbox?: string
  loading?: "lazy" | "eager"
}

export type IFrameControl = {
  reload: () => void
  getCurrentURL: () => string
  getContentWindow: () => (Window | null)
  getContentDocument: () => (Document | null)
  iframe: HTMLIFrameElement | null
}

const IFrame = forwardRef<IFrameControl, IFrameProps>(({
  src,
  className = "",
  style = {},
  onLoad,
  onError,
  title = "",
  allowFullScreen = false,
  sandbox = "",
  loading = "lazy",
}, ref) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [hasError, setHasError] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [language, setLanguage] = useState<string>(i18n.getCurrentLanguage())

  const getSafeSandbox = (customSandbox: string) => {
    const defaultSandbox = "allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
    if (customSandbox) {
      return customSandbox
    }
    return defaultSandbox
  }

  useEffect(() => {
    const handleLanguageChange = (event: any) => {
      setLanguage(event.detail.language)
    }
    window.addEventListener("languageChanged", handleLanguageChange as EventListener)
    return () => {
      window.removeEventListener("languageChanged", handleLanguageChange as EventListener)
    }
  }, [])

  const handleLoad = () => {
    setIsLoading(false)
    setHasError(false)
    onLoad && onLoad()
  }

  const handleError = () => {
    setIsLoading(false)
    setHasError(true)
    setErrorMessage(t("messages.networkError"))
    onError && onError()
  }

  const reload = () => {
    const iframe = iframeRef.current
    if (iframe) {
      setIsLoading(true)
      setHasError(false)
      try {
        (iframe.contentWindow as Window | null)?.location.reload()
      } catch (_e) {
        iframe.src = src
      }
    }
  }

  const getCurrentURL = () => {
    const iframe = iframeRef.current
    try {
      return iframe ? (iframe.contentWindow as Window).location.href : src
    } catch (_e) {
      return src
    }
  }

  const getContentWindow = () => {
    const iframe = iframeRef.current
    return iframe ? (iframe.contentWindow as Window | null) : null
  }

  const getContentDocument = () => {
    const iframe = iframeRef.current
    return iframe ? iframe.contentDocument : null
  }

  const controlObject: IFrameControl = {
    reload,
    getCurrentURL,
    getContentWindow,
    getContentDocument,
    iframe: iframeRef.current,
  }

  useImperativeHandle(ref, () => controlObject)

  useEffect(() => {
    currentActiveIFrame = controlObject
    return () => {
      if (currentActiveIFrame === controlObject) {
        currentActiveIFrame = null
      }
    }
  }, [])

  useEffect(() => {
    controlObject.iframe = iframeRef.current
    if (currentActiveIFrame === controlObject) {
      currentActiveIFrame = controlObject
    }
  }, [iframeRef.current])

  return (
    <div className={`iframe-container ${className}`} style={style}>
      {isLoading && (
        <div className="iframe-loading">
          <div className="loading-spinner"></div>
          <span>{t("common.loading")}</span>
        </div>
      )}
      {hasError && (
        <div className="iframe-error">
          <div className="error-icon">⚠️</div>
          <h3>{t("common.error")}</h3>
          <p>{errorMessage}</p>
          <button onClick={reload} className="retry-button">
            {t("tools.retry")}
          </button>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={src}
        title={title}
        className={`iframe-element ${isLoading ? "loading" : ""} ${hasError ? "error" : ""}`}
        onLoad={handleLoad}
        onError={handleError}
        allowFullScreen={allowFullScreen}
        sandbox={getSafeSandbox(sandbox)}
        loading={loading}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: hasError ? "none" : "block",
          opacity: isLoading ? 0 : 1,
          transition: "opacity 0.3s ease",
        }}
      />
    </div>
  )
})

IFrame.displayName = "IFrame"

export default IFrame
