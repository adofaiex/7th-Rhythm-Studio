"use client"

import React, { useState, useEffect } from "react"
import HomeWorkIcon from "@material-ui/icons/HomeWork"
import AppsIcon from "@material-ui/icons/Apps"
import SettingsIcon from "@material-ui/icons/Settings"
import ForumIcon from "@material-ui/icons/Forum"
import TollIcon from '@material-ui/icons/Toll';
import DeveloperModeIcon from '@material-ui/icons/DeveloperMode';
import i18n, { t } from "../utils/i18n"
import themeManager from "../utils/theme"
import "./Sidebar.css"

type Props = {
  activeTab: string
  onTabChange?: (id: string) => void
}

const Sidebar: React.FC<Props> = ({ activeTab, onTabChange }) => {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [language, setLanguage] = useState<string>(i18n.getCurrentLanguage())
  const [currentTheme, setCurrentTheme] = useState<string>(themeManager.getActualTheme())

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
    const handleThemeChange = (event: any) => {
      setCurrentTheme(event.detail.theme)
    }
    window.addEventListener("themeChanged", handleThemeChange as EventListener)
    return () => {
      window.removeEventListener("themeChanged", handleThemeChange as EventListener)
    }
  }, [])

  const getIconColor = () => {
    return currentTheme === "dark" ? "#ffffff" : "#333333"
  }

  const menuItems = [
    {
      id: "home",
      label: t("sidebar.home"),
      icon: <HomeWorkIcon style={{ color: getIconColor() }} />,
      tooltip: t("sidebar.home"),
    },
    {
      id: "tools",
      label: t("sidebar.tools"),
      icon: <AppsIcon style={{ color: getIconColor() }} />,
      tooltip: t("sidebar.tools"),
    },
    {
      id: "community",
      label: t("sidebar.community"),
      icon: <ForumIcon style={{ color: getIconColor() }} />,
      tooltip: t("sidebar.community"),
    },
    {
      id: "online_tools",
      label: t("sidebar.onlinetools"),
      icon: <TollIcon style={{ color: getIconColor() }} />,
      tooltip: t("sidebar.onlinetools"),
    },
  ]

  const developerItem = {
    id: "developer",
    label: t("sidebar.developer") || "开发者控制台",
    icon: <DeveloperModeIcon style={{ color: getIconColor() }} />,
    tooltip: t("sidebar.developer") || "开发者控制台",
  }

  const settingsItem = {
    id: "settings",
    label: t("sidebar.settings"),
    icon: <SettingsIcon style={{ color: getIconColor() }} />,
    tooltip: t("sidebar.settings"),
  }

  const handleItemClick = (itemId: string) => {
    onTabChange?.(itemId)
  }

  return (
    <div className="sidebar">
      <div className="sidebar-content">
        <div className="sidebar-menu">
          {menuItems.map((item) => (
            <div
              key={item.id}
              className={`sidebar-item ${activeTab === item.id ? "active" : ""}`}
              onClick={() => handleItemClick(item.id)}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
              title={item.tooltip}
            >
              <div className="sidebar-icon">
                {typeof item.icon == "string" ? (
                  <img src={item.icon || "/placeholder.svg"} alt={item.label} />
                ) : (
                  item.icon
                )}
              </div>
              {hoveredItem === item.id && <div className="sidebar-tooltip">{item.tooltip}</div>}
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <div
            className={`sidebar-item ${activeTab === developerItem.id ? "active" : ""}`}
            onClick={() => handleItemClick(developerItem.id)}
            onMouseEnter={() => setHoveredItem(developerItem.id)}
            onMouseLeave={() => setHoveredItem(null)}
            title={developerItem.tooltip}
          >
            <div className="sidebar-icon">
              {typeof developerItem.icon == "string" ? (
                <img src={developerItem.icon || "/placeholder.svg"} alt={developerItem.label} />
              ) : (
                developerItem.icon
              )}
            </div>
            {hoveredItem === developerItem.id && (
              <div className="sidebar-tooltip">{developerItem.tooltip}</div>
            )}
          </div>

          <div
            className={`sidebar-item ${activeTab === settingsItem.id ? "active" : ""}`}
            onClick={() => handleItemClick(settingsItem.id)}
            onMouseEnter={() => setHoveredItem(settingsItem.id)}
            onMouseLeave={() => setHoveredItem(null)}
            title={settingsItem.tooltip}
          >
            <div className="sidebar-icon">
              {typeof settingsItem.icon == "string" ? (
                <img src={settingsItem.icon || "/placeholder.svg"} alt={settingsItem.label} />
              ) : (
                settingsItem.icon
              )}
            </div>
            {hoveredItem === settingsItem.id && (
              <div className="sidebar-tooltip">{settingsItem.tooltip}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Sidebar
