<template>
  <main class="app-shell">
    <header class="topbar">
      <div>
        <h1>Devices</h1>
        <p>PKY Cloud H5 V1</p>
      </div>
      <nav>
        <router-link to="/recipes">Recipes</router-link>
        <button class="secondary" @click="logout">Logout</button>
      </nav>
    </header>

    <section class="device-grid">
      <router-link
        v-for="device in devices"
        :key="device.id"
        class="device-card"
        :to="`/devices/${device.id}`"
      >
        <div class="row">
          <h2>{{ device.name }}</h2>
          <span :class="['status', device.online ? 'online' : 'offline']">
            {{ device.online ? 'Online' : 'Offline' }}
          </span>
        </div>
        <p>{{ device.location || 'No location' }}</p>
        <div class="metrics">
          <span>Flow {{ device.state.flow }} L/min</span>
          <span>Pressure {{ device.state.pressure }} bar</span>
          <span>EC {{ device.state.ec }}</span>
          <span>pH {{ device.state.ph }}</span>
        </div>
      </router-link>
    </section>
  </main>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api, clearToken } from '../api/client';

const router = useRouter();
const devices = ref([]);

function logout() {
  clearToken();
  router.push('/login');
}

async function loadDevices() {
  devices.value = await api('/devices');
}

onMounted(loadDevices);
</script>
