<template>
  <main class="login-shell">
    <form class="login-panel" @submit.prevent="submit">
      <h1>PKY Cloud H5</h1>
      <p>Greenhouse irrigation control</p>

      <label>
        Username
        <input v-model="username" autocomplete="username" required />
      </label>

      <label>
        Password
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>

      <button :disabled="loading">{{ loading ? 'Signing in...' : 'Login' }}</button>
      <small v-if="error" class="error">{{ error }}</small>
      <small class="hint">Default: admin / admin123</small>
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
