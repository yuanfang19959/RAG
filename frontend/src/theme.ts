/**
 * 取自博客 PageIo 的视觉语言：纯中性灰、无渐变、无强调色。
 * 挂件嵌进博客时才不会像贴上去的。
 */
export const color = {
  // 三级字色：黑 + 透明度，比灰阶更实一点
  text: 'rgba(0, 0, 0, 1)',
  textMuted: 'rgba(0, 0, 0, 0.75)',
  textFaint: 'rgba(0, 0, 0, 0.5)',
  border: '#e5e5e5',
  borderLight: '#ebebeb',
  bgSubtle: '#f5f5f5',
  bg: '#fff',
};

export const font =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

/** 移动端断点，和博客保持一致 */
export const MOBILE = 800;
