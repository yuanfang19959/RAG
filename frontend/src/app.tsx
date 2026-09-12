import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import React from 'react';

import { color, font } from './theme';

/**
 * umi 的 rootContainer：把整个应用包一层，类似 Next.js 的 layout。
 * 在这里统一改 antd 的设计变量，省得每个组件都写 style。
 */
export function rootContainer(container: React.ReactNode) {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          // 主色用近黑而不是 antd 默认的蓝，克制一些
          colorPrimary: color.text,
          colorText: color.text,
          colorTextSecondary: color.textMuted,
          colorTextTertiary: color.textFaint,
          colorBorder: color.border,
          colorBorderSecondary: color.borderLight,
          borderRadius: 10,
          fontFamily: font,
          fontSize: 14,
        },
        components: {
          Button: { primaryShadow: 'none' },
        },
      }}
    >
      {container}
    </ConfigProvider>
  );
}
