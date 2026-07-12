import { Outlet } from 'react-router-dom';
import { useDeviceLayout } from '../hooks/useDeviceLayout';
import { DesktopLayout } from './DesktopLayout';
import { MobileLayout } from './MobileLayout';

export function ResponsiveLayout() {
  const { isDesktop } = useDeviceLayout();

  if (isDesktop) {
    return <DesktopLayout />;
  }

  return <MobileLayout />;
}

export function LayoutOutlet() {
  return <Outlet />;
}
