import React, { useState } from 'react';
import { getJSONFromLocalStorage, saveJSONToLocalStorage } from '../utils/localStorageFunctions';
import { Button, ConfigProvider, Tooltip } from '@/shared/antd-imports';
import { PushpinFilled, PushpinOutlined } from '@/shared/antd-imports';
import { colors } from '../styles/colors';
import { navRoutes, NavRoutesType } from '../features/navbar/navRoutes';

// Props type for the component
type PinRouteToNavbarButtonProps = {
  name: string;
  path: string;
  adminOnly?: boolean;
};

// this component pin the given path to navbar
const PinRouteToNavbarButton = ({ name, path, adminOnly = false }: PinRouteToNavbarButtonProps) => {
  // Load pinned route names from localStorage, default to all route names if empty
  const pinnedRouteNames: string[] = getJSONFromLocalStorage('navRoutesPinned') || navRoutes.map(r => r.name);

  const [isPinned, setIsPinned] = useState(pinnedRouteNames.includes(name));

  // this function handle pin to the navbar
  const handlePinToNavbar = (name: string, path: string) => {
    const currentPinned: string[] = getJSONFromLocalStorage('navRoutesPinned') || navRoutes.map(r => r.name);

    let newPinnedList: string[];
    if (isPinned) {
      newPinnedList = currentPinned.filter(routeName => routeName !== name);
    } else {
      newPinnedList = [...currentPinned, name];
    }

    setIsPinned(prev => !prev);
    saveJSONToLocalStorage('navRoutesPinned', newPinnedList);

    // Notify navbar to re-read localStorage immediately (fixes real-time sidebar update)
    window.dispatchEvent(new Event('navRoutesUpdated'));
  };

  return (
    <ConfigProvider wave={{ disabled: true }}>
      <Tooltip title={'Click to pin this into the main menu'} trigger={'hover'}>
        <Button
          className="borderless-icon-btn"
          onClick={() => handlePinToNavbar(name, path)}
          icon={
            isPinned ? (
              <PushpinFilled
                style={{
                  fontSize: 18,
                  color: colors.skyBlue,
                }}
              />
            ) : (
              <PushpinOutlined
                style={{
                  fontSize: 18,
                  color: colors.skyBlue,
                }}
              />
            )
          }
        />
      </Tooltip>
    </ConfigProvider>
  );
};

export default PinRouteToNavbarButton;
