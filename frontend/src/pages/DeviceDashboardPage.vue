<template>
  <section v-if="consoleData" class="page-stack">
    <header class="page-header console-header">
      <div>
        <p class="eyebrow">设备控制台</p>
        <h1>{{ device.name }}</h1>
      </div>
      <div class="header-meta">
        <div><span>设备状态</span><strong :class="device.online ? 'ok-text' : 'muted-text'">{{ device.online ? '在线' : '离线' }}</strong></div>
        <div><span>当前模式</span><strong>{{ device.currentMode || '自动模式' }}</strong></div>
        <div><span>当前策略</span><strong>{{ device.currentStrategy || '未设置' }}</strong></div>
        <div><span>最后通信</span><strong>{{ formatTime(device.lastSeenAt) || '暂无' }}</strong></div>
      </div>
    </header>

    <div class="dashboard-grid">
      <article class="panel">
        <h2>今日灌溉统计</h2>
        <div class="metric-grid">
          <div class="metric"><span>今日灌溉次数</span><strong>{{ stats.irrigationCount }} 次</strong></div>
          <div class="metric"><span>累计运行时间</span><strong>{{ stats.runtimeMinutes }} 分钟</strong></div>
          <div class="metric"><span>累计用水量</span><strong>{{ stats.waterLiters }} L</strong></div>
          <div class="metric"><span>最近一次灌溉时间</span><strong>{{ formatTime(stats.lastIrrigationAt) || '暂无' }}</strong></div>
        </div>
      </article>

      <article class="panel">
        <h2>设备状态</h2>
        <div class="metric-grid">
          <div class="metric"><span>水泵状态</span><strong>{{ device.state.pumpOn ? '运行中' : '已停止' }}</strong></div>
          <div class="metric"><span>当前运行阀门</span><strong>{{ activeValvesText }}</strong></div>
          <div class="metric"><span>流量</span><strong>{{ device.state.flow }} L/min</strong></div>
          <div class="metric"><span>压力</span><strong>{{ device.state.pressure }} bar</strong></div>
          <div class="metric"><span>EC</span><strong>{{ device.state.ec }}</strong></div>
          <div class="metric"><span>pH</span><strong>{{ device.state.ph }}</strong></div>
        </div>
      </article>

      <article class="panel wide">
        <div class="section-title">
          <h2>手动控制</h2>
          <div class="button-row">
            <button @click="controlPump(true)">水泵启动</button>
            <button class="danger" @click="controlPump(false)">水泵停止</button>
          </div>
        </div>
        <div class="valve-grid">
          <button
            v-for="valve in 32"
            :key="valve"
            :class="['valve-button', activeValves.includes(valve) ? 'active' : '']"
            @click="controlValve(valve, !activeValves.includes(valve))"
          >
            阀门{{ valve }}
          </button>
        </div>
        <small v-if="commandMessage" class="hint">{{ commandMessage }}</small>
      </article>

      <article class="panel">
        <h2>灌溉计划</h2>
        <form class="plan-form" @submit.prevent="createPlan">
          <input v-model="plan.name" placeholder="名称" required />
          <input v-model="plan.startTime" type="time" required />
          <input v-model.number="plan.durationMinutes" type="number" min="1" placeholder="运行时长/分钟" required />
          <label class="inline-check"><input v-model="plan.enabled" type="checkbox" /> 启用</label>
          <button>新增</button>
        </form>
        <ul class="plain-list">
          <li v-for="item in plans" :key="item.id">
            <span>{{ item.name }} · {{ item.startTime }} · {{ item.durationMinutes }}分钟 · {{ item.enabled ? '启用' : '停用' }}</span>
            <button class="secondary" @click="deletePlan(item.id)">删除</button>
          </li>
        </ul>
      </article>

      <article class="panel">
        <h2>运行日志</h2>
        <ul class="plain-list logs">
          <li v-for="log in logs" :key="log.id">
            <span>{{ formatTime(log.createdAt) }}</span>
            <strong>{{ log.event }}</strong>
            <small>{{ log.deviceId || '-' }} · {{ log.result || '成功' }}</small>
          </li>
        </ul>
      </article>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api/client';

const route = useRoute();
const consoleData = ref(null);
const commandMessage = ref('');
const plan = reactive({
  name: '上午灌溉',
  startTime: '08:00',
  durationMinutes: 10,
  enabled: true
});
let timer;

const device = computed(() => consoleData.value.device);
const stats = computed(() => consoleData.value.todayStats);
const plans = computed(() => consoleData.value.plans);
const logs = computed(() => consoleData.value.logs);
const activeValves = computed(() => device.value.state.activeValves || []);
const activeValvesText = computed(() =>
  activeValves.value.length ? activeValves.value.map((item) => `${item}路`).join('、') : '无'
);

async function loadConsole() {
  consoleData.value = await api(`/console/${route.params.deviceId}`);
}

async function controlPump(on) {
  await api(`/devices/${device.value.id}/pump`, {
    method: 'POST',
    body: JSON.stringify({ on })
  });
  commandMessage.value = on ? '水泵启动指令已发送' : '水泵停止指令已发送';
  await loadConsole();
}

async function controlValve(valveNumber, on) {
  await api(`/devices/${device.value.id}/valves/${valveNumber}`, {
    method: 'POST',
    body: JSON.stringify({ on })
  });
  commandMessage.value = `阀门${valveNumber}${on ? '开启' : '关闭'}指令已发送`;
  await loadConsole();
}

async function createPlan() {
  await api(`/devices/${device.value.id}/plans`, {
    method: 'POST',
    body: JSON.stringify(plan)
  });
  await loadConsole();
}

async function deletePlan(id) {
  await api(`/plans/${id}`, { method: 'DELETE' });
  await loadConsole();
}

function formatTime(value) {
  if (!value) return '';
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (input) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

onMounted(() => {
  loadConsole();
  timer = window.setInterval(loadConsole, 5000);
});

onBeforeUnmount(() => window.clearInterval(timer));
</script>
