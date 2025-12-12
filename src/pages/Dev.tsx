"use client"

import React, { useState, useEffect, useRef } from "react"
import IFrame from "../components/IFrame"
import i18n, { t } from "../utils/i18n"
import "./Dev.css"

const DevPage: React.FC = () => {
  const [language, setLanguage] = useState<string>(i18n.getCurrentLanguage())
  const iframeRef = useRef<any>(null)

  useEffect(() => {
    const handleLanguageChange = (event: any) => {
      setLanguage(event.detail.language)
    }
    window.addEventListener("languageChanged", handleLanguageChange as EventListener)
    return () => {
      window.removeEventListener("languageChanged", handleLanguageChange as EventListener)
    }
  }, [])

  return (
    <div className="dev-page">
      <div className="dev-content">
        <IFrame
          ref={iframeRef}
          src="https://7th.rhythmdoctor.top/Development/"
          className="dev-iframe"
          title="Developer Console"
        />
      </div>
    </div>
  )
}

export default DevPage
