import AntdApp from 'antd/es/app';

/**
 * antd's `message` bound to the app's React context. Unlike the static `message.*` calls it renders
 * correctly on React 19, follows the theme, and works in tests. Needs the <App> wrapper (see App.tsx).
 */
export const useMessage = () => AntdApp.useApp().message;
