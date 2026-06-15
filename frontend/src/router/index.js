import { createRouter, createWebHistory } from 'vue-router';
import { getToken } from '../api/client';
import AppShell from '../pages/AppShell.vue';
import LoginPage from '../pages/LoginPage.vue';
import DeviceDashboardPage from '../pages/DeviceDashboardPage.vue';
import DeviceListPage from '../pages/DeviceListPage.vue';
import CropManagementPage from '../pages/CropManagementPage.vue';
import GrowthStagesPage from '../pages/GrowthStagesPage.vue';
import IrrigationStrategiesPage from '../pages/IrrigationStrategiesPage.vue';

const routes = [
  { path: '/login', component: LoginPage },
  {
    path: '/',
    component: AppShell,
    redirect: '/console/demo-001',
    children: [
      { path: 'console/:deviceId', component: DeviceDashboardPage },
      { path: 'devices', component: DeviceListPage },
      { path: 'crops', component: CropManagementPage },
      { path: 'growth-stages', component: GrowthStagesPage },
      { path: 'strategies', component: IrrigationStrategiesPage }
    ]
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to) => {
  if (to.path !== '/login' && !getToken()) {
    return '/login';
  }
  if (to.path === '/login' && getToken()) {
    return '/devices';
  }
  return true;
});

export default router;
