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
  const navRoutesList: NavRoutesType[] = getJSONFromLocalStorage('navRoutes') || navRoutes;

  const [isPinned, setIsPinned] = useState(
    // this function check the current name is available in local storage's navRoutes list if it's available then isPinned state will be true
    navRoutesList.filter(item => item.name === name).length && true
  );

  // this function handle pin to the navbar
  const handlePinToNavbar = (name: string, path: string) => {
    let newNavRoutesList;

    const route: NavRoutesType = { name, path, adminOnly };

    if (isPinned) {
      newNavRoutesList = navRoutesList.filter(item => item.name !== route.name);
    } else {
      newNavRoutesList = [...navRoutesList, route];
    }

    setIsPinned(prev => !prev);
    saveJSONToLocalStorage('navRoutes', newNavRoutesList);
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
