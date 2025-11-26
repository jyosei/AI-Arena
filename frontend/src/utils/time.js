/**
 * 格式化时间为相对时间或绝对时间
 * @param {string|Date} value - ISO 8601 时间字符串或 Date 对象
 * @param {boolean} relative - 是否使用相对时间
 * @returns {string} 格式化后的时间字符串
 */
export function formatDateTime(value, relative = true) {
  if (!value) return '-';
  
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    
    if (relative) {
      const now = new Date();
      const diff = now - date;
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      const months = Math.floor(days / 30);
      const years = Math.floor(days / 365);
      
      if (seconds < 60) return '刚刚';
      if (minutes < 60) return `${minutes}分钟前`;
      if (hours < 24) return `${hours}小时前`;
      if (days < 30) return `${days}天前`;
      if (months < 12) return `${months}个月前`;
      return `${years}年前`;
    }
    
    // 绝对时间: YYYY-MM-DD HH:mm
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  } catch {
    return value;
  }
}

/**
 * 格式化时间为完整的绝对时间
 * @param {string|Date} value - ISO 8601 时间字符串或 Date 对象
 * @returns {string} 格式化后的时间字符串
 */
export function formatDateTimeFull(value) {
  return formatDateTime(value, false);
}

/**
 * 格式化时间为相对时间（默认）
 * @param {string|Date} value - ISO 8601 时间字符串或 Date 对象
 * @returns {string} 格式化后的时间字符串
 */
export function formatDateTimeRelative(value) {
  return formatDateTime(value, true);
}
