<template>
  <main class="platform-shell">
    <aside class="sidebar">
      <div class="brand">
        <strong>PKY Cloud CN</strong>
        <span>V0.2 农业灌溉云平台</span>
      </div>
      <nav>
        <router-link to="/console/demo-001">设备控制台</router-link>
        <router-link to="/crops">作物管理</router-link>
        <router-link to="/growth-stages">生长阶段</router-link>
        <router-link to="/strategies">灌溉策略</router-link>
        <router-link to="/devices">设备管理</router-link>
      </nav>
      <button class="secondary logout" @click="logout">退出登录</button>
    </aside>
    <section class="content-shell">
      <router-view />
    </section>
  </main>
</template>

<script setup>
import { useRouter } from 'vue-router';
import { clearToken } from '../api/client';

const router = useRouter();

function logout() {
  clearToken();
  router.push('/login');
}
</script>
