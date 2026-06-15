<template>
  <main class="login-shell">
    <form class="login-panel" @submit.prevent="submit">
      <h1>PKY Cloud CN</h1>
      <p>农业灌溉云平台 V0.2</p>

      <label>
        账号
        <input v-model="username" autocomplete="username" required />
      </label>

      <label>
        密码
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>

      <button :disabled="loading">{{ loading ? '登录中...' : '登录' }}</button>
      <small v-if="error" class="error">{{ error }}</small>
      <small class="hint">默认账号：admin / admin123</small>
    </form>
  </main>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { api, setToken } from '../api/client';

const router = useRouter();
const username = ref('admin');
const password = ref('admin123');
const loading = ref(false);
const error = ref('');

async function submit() {
  loading.value = true;
  error.value = '';

  try {
    const result = await api('/login', {
      method: 'POST',
      body: JSON.stringify({ username: username.value, password: password.value })
    });
    setToken(result.token);
    router.push('/devices');
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}
</script>
