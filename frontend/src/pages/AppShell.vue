<template>
  <main class="platform-shell">
    <aside class="sidebar">
      <div class="brand">
        <strong>PKY Cloud CN</strong>
        <span>V0.3 真实设备联调版</span>
      </div>
      <nav>
        <router-link to="/console/demo-001">设备详情</router-link>
        <router-link to="/devices">设备管理</router-link>
      </nav>
      <button class="secondary logout" @click="logout">退出登录</button>
      <footer class="version-footer">
        <strong>PKY Cloud CN V0.3</strong>
        <span>真实设备联调版</span>
      </footer>
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
