// ThemeSelector.tsx
import { Button } from 'antd';
import React from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { toggleTheme } from './themeSlice';
import { MoonOutlined, SunOutlined } from '@ant-design/icons';

const ThemeSelector = () => {
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const dispatch = useAppDispatch();

  const handleDarkModeToggle = () => {
    dispatch(toggleTheme());
  };

  return (
    <Button
      type={themeMode === 'dark' ? 'primary' : 'default'}
      icon={themeMode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
      shape="circle"
      onClick={handleDarkModeToggle}
      className="transition-all duration-300" // Optional: add smooth transition
    />
  );
};

export default ThemeSelector;
