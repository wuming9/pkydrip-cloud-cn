import { createRouter, createWebHistory } from 'vue-router';
import { getToken } from '../api/client';
import AppShell from '../pages/AppShell.vue';
import LoginPage from '../pages/LoginPage.vue';
import DeviceDashboardPage from '../pages/DeviceDashboardPage.vue';
import DeviceListPage from '../pages/DeviceListPage.vue';

const routes = [
  { path: '/login', component: LoginPage },
  {
    path: '/',
    component: AppShell,
    redirect: '/console/demo-001',
    children: [
      { path: 'console/:deviceId', component: DeviceDashboardPage },
      { path: 'devices', component: DeviceListPage }
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
    return '/console/demo-001';
  }
  return true;
});

export default router;
