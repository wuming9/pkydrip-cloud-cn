import { createRouter, createWebHistory } from 'vue-router';
import { getToken } from '../api/client';
import LoginPage from '../pages/LoginPage.vue';
import DeviceListPage from '../pages/DeviceListPage.vue';
import DeviceDashboardPage from '../pages/DeviceDashboardPage.vue';
import RecipePage from '../pages/RecipePage.vue';

const routes = [
  { path: '/', redirect: '/devices' },
  { path: '/login', component: LoginPage },
  { path: '/devices', component: DeviceListPage },
  { path: '/devices/:deviceId', component: DeviceDashboardPage },
  { path: '/recipes', component: RecipePage }
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
