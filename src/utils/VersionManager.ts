const appVersion = "1.0.1"
const asarVersion = "1.0.0"

// 版本比较函数
function compareVersions(version1: string, version2: string) {
  const v1 = version1.split('.').map(Number);
  const v2 = version2.split('.').map(Number);
  for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
    const num1 = v1[i] || 0;
    const num2 = v2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

export default {
  version: appVersion, // 兼容旧的命名
  appVersion,
  asarVersion,
  compareVersions,
  
  // 检查是否需要软件更新
  needsAppUpdate(remoteVersion: string) {
    return compareVersions(appVersion, remoteVersion) < 0;
  },
  
  // 检查是否需要热更新
  needsHotUpdate(remoteVersion: string) {
    return compareVersions(asarVersion, remoteVersion) < 0;
  },
  
  // 检查是否需要强制更新（基于最低支持版本）
  needsForceUpdate(minVersion: string) {
    return compareVersions(appVersion, minVersion) < 0;
  }
}