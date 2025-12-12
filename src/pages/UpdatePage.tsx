import React, { useState, useEffect, useCallback } from 'react';
import VersionManager from '../utils/VersionManager';
import './UpdatePage.css';

type UpdateInfo = {
  version: string
  min_version?: string
  update: {
    windows?: string
    macos?: string
  }
}

const getPlatform = () => {
  if (window.navigator.platform.toLowerCase().includes('win')) {
    return 'windows';
  } else if (window.navigator.platform.toLowerCase().includes('mac')) {
    return 'macos';
  }
  return 'windows';
};

const UpdatePage: React.FC = () => {
  const [status, setStatus] = useState<string>('checking');
  const [message, setMessage] = useState<string>('正在检查更新...');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isForceUpdate, setIsForceUpdate] = useState<boolean>(false);

  const checkForUpdates = useCallback(async () => {
    try {
      setStatus('checking');
      setMessage('正在检查更新...');
      if (!window.electronAPI) {
        throw new Error('Electron API 不可用');
      }
      const updateData = await window.electronAPI.checkUpdate();
      setUpdateInfo(updateData as UpdateInfo);
      const needsAppUpdate = VersionManager.needsAppUpdate(updateData.version);
      const forceUpdate = updateData.min_version ? VersionManager.needsForceUpdate(updateData.min_version) : false;
      if (needsAppUpdate) {
        setStatus('app-update');
        setIsForceUpdate(forceUpdate);
        if (forceUpdate) {
          setMessage(`发现新版本 ${updateData.version}（强制更新）`);
        } else {
          setMessage(`发现新版本 ${updateData.version}`);
        }
      } else {
        setStatus('completed');
        setMessage('已是最新版本');
        setTimeout(() => finishUpdate(), 1500);
      }
    } catch (error) {
      const msg = (error as Error).message || '未知错误';
      setStatus('error');
      setError(msg);
      setMessage(`检查更新失败: ${msg}`);
      setTimeout(() => finishUpdate(), 5000);
    }
  }, []);

  useEffect(() => {
    setTimeout(() => {
      checkForUpdates();
    }, 100);
  }, [checkForUpdates]);

  const handleAppUpdate = async () => {
    try {
      if (!window.electronAPI) {
        setStatus('error');
        setMessage('桌面功能不可用');
        return;
      }
      const platform = getPlatform();
      const updateUrl = updateInfo!.update[platform as keyof UpdateInfo["update"]];
      if (updateUrl) {
        setMessage('正在打开下载页面...');
        await window.electronAPI.handleAppUpdate(updateUrl);
      } else {
        throw new Error('找不到对应平台的更新包');
      }
    } catch (error) {
      setStatus('error');
      setError((error as Error).message);
      setMessage('打开下载页面失败');
    }
  };

  const finishUpdate = async () => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.finishUpdate();
      } else {
        window.close();
      }
    } catch (error) {
      if (window.electronAPI) {
        window.electronAPI.windowControl('close');
      }
    }
  };

  const renderContent = () => {
    switch (status) {
      case 'checking':
        return (
          <div className="update-content">
            <div className="update-icon">
              <div className="updatepage-loading-spinner"></div>
            </div>
            <h2>检查更新</h2>
            <p className="update-message">{message}</p>
          </div>
        );
      case 'app-update':
        return (
          <div className="update-content">
            <div className="update-icon app-update">📦</div>
            <h2>{isForceUpdate ? '强制更新' : '发现新版本'}</h2>
            <p className="update-message">{message}</p>
            <p className="version-info">
              {VersionManager.appVersion} → {updateInfo?.version}
            </p>
            {isForceUpdate && (
              <p className="force-update-notice">
                ⚠️ 当前版本过低，必须更新后才能继续使用
              </p>
            )}
            <div className="update-actions">
              <button className="update-btn primary" onClick={handleAppUpdate}>
                {isForceUpdate ? '立即更新' : '立即下载'}
              </button>
              {!isForceUpdate && (
                <button className="update-btn secondary" onClick={finishUpdate}>
                  稍后更新
                </button>
              )}
            </div>
          </div>
        );
      case 'completed':
        return (
          <div className="update-content">
            <div className="update-icon completed">✅</div>
            <h2>启动应用</h2>
            <p className="update-message">{message}</p>
          </div>
        );
      case 'error':
        return (
          <div className="update-content">
            <div className="update-icon error">⚠️</div>
            <h2>出现错误</h2>
            <p className="update-message">{message}</p>
            {error && <p className="error-detail">{error}</p>}
            <div className="update-actions">
              <button className="update-btn primary" onClick={checkForUpdates}>
                重试
              </button>
              <button className="update-btn secondary" onClick={finishUpdate}>
                跳过
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="update-page">
      <div className="update-header">
        <img src="https://7th.rhythmdoctor.top/Resource/icon.png" alt="7th Rhythm Studio" className="updatepage-app-logo" />
        <h1>7th Rhythm Studio</h1>
      </div>
      {renderContent()}
    </div>
  );
};

export default UpdatePage;
