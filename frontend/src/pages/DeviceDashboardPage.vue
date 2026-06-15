<template>
  <main class="app-shell" v-if="device">
    <header class="topbar">
      <div>
        <router-link class="back-link" to="/devices">Back to devices</router-link>
        <h1>{{ device.name }}</h1>
        <p>{{ device.id }} · {{ device.location || 'No location' }}</p>
      </div>
      <router-link to="/recipes">Recipes</router-link>
    </header>

    <section class="dashboard-grid">
      <div class="panel">
        <h2>Live State</h2>
        <div class="metric-grid">
          <div class="metric"><span>Pump</span><strong>{{ device.state.pumpOn ? 'On' : 'Off' }}</strong></div>
          <div class="metric"><span>Valve</span><strong>{{ device.state.valveOn ? 'Open' : 'Closed' }}</strong></div>
          <div class="metric"><span>Flow</span><strong>{{ device.state.flow }} L/min</strong></div>
          <div class="metric"><span>Pressure</span><strong>{{ device.state.pressure }} bar</strong></div>
          <div class="metric"><span>EC</span><strong>{{ device.state.ec }}</strong></div>
          <div class="metric"><span>pH</span><strong>{{ device.state.ph }}</strong></div>
        </div>
      </div>

      <div class="panel">
        <h2>Manual Control</h2>
        <div class="control-row">
          <span>Pump</span>
          <button @click="controlPump(!device.state.pumpOn)">
            Turn {{ device.state.pumpOn ? 'Off' : 'On' }}
          </button>
        </div>
        <div class="control-row">
          <span>Valve</span>
          <button @click="controlValve(!device.state.valveOn)">
            {{ device.state.valveOn ? 'Close' : 'Open' }}
          </button>
        </div>
        <small v-if="commandMessage" class="hint">{{ commandMessage }}</small>
      </div>

      <div class="panel">
        <h2>Timer Irrigation Plan</h2>
        <form class="plan-form" @submit.prevent="createPlan">
          <input v-model="plan.name" placeholder="Plan name" required />
          <input v-model="plan.startTime" type="time" required />
          <input v-model.number="plan.durationMinutes" type="number" min="1" placeholder="Minutes" required />
          <button>Add</button>
        </form>
        <ul class="plain-list">
          <li v-for="item in plans" :key="item.id">
            <span>{{ item.name }} · {{ item.startTime }} · {{ item.durationMinutes }} min</span>
            <button class="secondary" @click="deletePlan(item.id)">Delete</button>
          </li>
        </ul>
      </div>

      <div class="panel">
        <h2>Recent Operation Logs</h2>
        <ul class="plain-list logs">
          <li v-for="log in logs" :key="log.id">
            <span>{{ log.createdAt }}</span>
            <strong>{{ log.action }}</strong>
            <small>{{ log.deviceId || '-' }}</small>
          </li>
        </ul>
      </div>
    </section>
  </main>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api/client';

const route = useRoute();
const device = ref(null);
const plans = ref([]);
const logs = ref([]);
const commandMessage = ref('');
const plan = reactive({
  name: 'Morning irrigation',
  startTime: '08:00',
  durationMinutes: 10
});
let timer;

async function loadAll() {
  const deviceId = route.params.deviceId;
  const [deviceResult, planResult, logResult] = await Promise.all([
    api(`/devices/${deviceId}`),
    api(`/devices/${deviceId}/plans`),
    api('/logs')
  ]);
  device.value = deviceResult;
  plans.value = planResult;
  logs.value = logResult;
}

async function controlPump(on) {
  await api(`/devices/${device.value.id}/pump`, {
    method: 'POST',
    body: JSON.stringify({ on })
  });
  commandMessage.value = `Pump command sent: ${on ? 'on' : 'off'}`;
  await loadAll();
}

async function controlValve(on) {
  await api(`/devices/${device.value.id}/valve`, {
    method: 'POST',
    body: JSON.stringify({ on })
  });
  commandMessage.value = `Valve command sent: ${on ? 'open' : 'close'}`;
  await loadAll();
}

async function createPlan() {
  await api(`/devices/${device.value.id}/plans`, {
    method: 'POST',
    body: JSON.stringify(plan)
  });
  await loadAll();
}

async function deletePlan(id) {
  await api(`/plans/${id}`, { method: 'DELETE' });
  await loadAll();
}

onMounted(() => {
  loadAll();
  timer = window.setInterval(loadAll, 5000);
});

onBeforeUnmount(() => window.clearInterval(timer));
</script>
