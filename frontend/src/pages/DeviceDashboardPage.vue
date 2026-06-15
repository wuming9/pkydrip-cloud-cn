<template>
  <section v-if="consoleData" class="page-stack">
    <header class="page-header console-header">
      <div>
        <p class="eyebrow">灌溉控制器联调</p>
        <h1>{{ device.name }}</h1>
      </div>
      <div class="header-meta">
        <div><span>在线状态</span><strong :class="device.online ? 'ok-text' : 'danger-text'">{{ device.online ? '在线' : '离线' }}</strong></div>
        <div><span>当前模式</span><strong>{{ device.currentMode }}</strong></div>
        <div><span>报警状态</span><strong :class="device.alarmCode ? 'danger-text' : 'ok-text'">{{ alarmText }}</strong></div>
        <div><span>最后通信</span><strong>{{ formatTime(device.lastSeenAt) || '暂无' }}</strong></div>
      </div>
    </header>

    <div class="dashboard-grid">
      <article class="panel">
        <h2>仪表盘</h2>
        <div class="metric-grid">
          <div class="metric"><span>水泵1</span><strong>{{ device.state.pump1 ? 'ON' : 'OFF' }}</strong></div>
          <div class="metric"><span>水泵2</span><strong>{{ device.state.pump2 ? 'ON' : 'OFF' }}</strong></div>
          <div class="metric"><span>阀门</span><strong>{{ activeValvesText }}</strong></div>
          <div class="metric"><span>流量</span><strong>{{ device.state.flow }} L/min</strong></div>
          <div class="metric"><span>压力</span><strong>{{ device.state.pressure }} bar</strong></div>
          <div class="metric"><span>EC / pH</span><strong>{{ device.state.ec }} / {{ device.state.ph }}</strong></div>
        </div>
      </article>

      <article class="panel">
        <h2>ACK 显示</h2>
        <div class="ack-box">
          <div><span>最后命令</span><strong>{{ lastAck.cmd || '-' }}</strong></div>
          <div><span>执行结果</span><strong :class="lastAck.success === false ? 'danger-text' : 'ok-text'">{{ ackResult }}</strong></div>
          <div><span>错误信息</span><strong>{{ lastAck.message || '-' }}</strong></div>
          <div><span>时间</span><strong>{{ formatTime(lastAck.timestamp) || '-' }}</strong></div>
        </div>
      </article>

      <article class="panel wide">
        <div class="section-title">
          <h2>手动控制</h2>
          <button class="danger" @click="emergencyStop">急停</button>
        </div>
        <div class="button-row pump-row">
          <button @click="controlPump(1, true)">水泵1 ON</button>
          <button class="secondary" @click="controlPump(1, false)">水泵1 OFF</button>
          <button @click="controlPump(2, true)">水泵2 ON</button>
          <button class="secondary" @click="controlPump(2, false)">水泵2 OFF</button>
        </div>
        <div class="valve-grid">
          <button
            v-for="valve in 32"
            :key="valve"
            :class="['valve-button', valveOn(valve) ? 'active' : '']"
            @click="controlValve(valve, !valveOn(valve))"
          >
            阀门{{ valve }} {{ valveOn(valve) ? 'ON' : 'OFF' }}
          </button>
        </div>
      </article>

      <article class="panel wide">
        <h2>模式控制</h2>
        <div class="mode-grid">
          <button
            v-for="mode in modes"
            :key="mode"
            :class="device.currentMode === mode ? '' : 'secondary'"
            @click="setMode(mode)"
          >
            {{ mode }}
          </button>
        </div>
      </article>

      <article class="panel">
        <h2>定时灌溉</h2>
        <form class="timer-form" @submit.prevent="createTimerTask">
          <input v-model="timerForm.name" placeholder="名称" required />
          <input v-model="timerForm.startTime" type="time" required />
          <select v-model.number="timerForm.pump"><option :value="1">Pump1</option><option :value="2">Pump2</option></select>
          <input v-model="timerForm.valvesText" placeholder="阀门列表，如 1,2,3" required />
          <input v-model.number="timerForm.durationMinutes" type="number" min="1" placeholder="运行时长/分钟" required />
          <label class="inline-check"><input v-model="timerForm.enabled" type="checkbox" /> 启用</label>
          <button>创建</button>
        </form>
        <ul class="plain-list">
          <li v-for="task in timerTasks" :key="task.id">
            <span>{{ task.name }} · {{ task.startTime }} · Pump{{ task.pump }} · 阀门 {{ task.valves.join(',') }} · {{ task.durationMinutes }}分钟 · {{ task.enabled ? '启用' : '停用' }}</span>
            <div class="button-row">
              <button @click="sendTimerTask(task.id)">下发到设备</button>
              <button class="secondary" @click="deleteTimerTask(task.id)">删除</button>
            </div>
          </li>
        </ul>
      </article>

      <article class="panel">
        <h2>灌溉计划</h2>
        <form class="plan-builder" @submit.prevent="createPlan">
          <input v-model="planForm.name" placeholder="计划名称" required />
          <label class="inline-check"><input v-model="planForm.enabled" type="checkbox" /> 启用</label>
          <div class="group-grid">
            <input v-model="groupForm.groupName" placeholder="组名称" />
            <select v-model.number="groupForm.pump"><option :value="1">Pump1</option><option :value="2">Pump2</option></select>
            <input v-model="groupForm.valvesText" placeholder="阀门列表，如 1,3,5,6" />
            <input v-model.number="groupForm.durationMinutes" type="number" min="1" placeholder="运行时间/分钟" />
            <button type="button" class="secondary" @click="addGroup">添加组</button>
          </div>
          <div class="group-preview" v-for="(group, index) in planForm.groups" :key="index">
            {{ group.groupName }} · Pump{{ group.pump }} · 阀门 {{ group.valves.join(',') }} · {{ group.durationMinutes }}分钟
          </div>
          <button>创建 Plan</button>
        </form>
        <ul class="plain-list">
          <li v-for="plan in plans" :key="plan.id">
            <span>{{ plan.name }} · {{ plan.groups.length }}组 · {{ plan.enabled ? '启用' : '停用' }}</span>
            <div class="button-row">
              <button @click="sendPlan(plan.id)">下发到设备</button>
              <button class="secondary" @click="deletePlan(plan.id)">删除</button>
            </div>
          </li>
        </ul>
      </article>

      <article class="panel">
        <h2>运行日志</h2>
        <ul class="plain-list logs">
          <li v-for="log in logs" :key="log.id">
            <span>{{ formatTime(log.createdAt) }}</span>
            <strong>{{ log.event }}</strong>
            <small>{{ log.result }} · {{ log.deviceId }}</small>
          </li>
        </ul>
      </article>

      <article class="panel">
        <div class="section-title">
          <h2>工程调试状态</h2>
          <button class="secondary" @click="showDebug = !showDebug">{{ showDebug ? '隐藏' : '显示' }}</button>
        </div>
        <div v-if="showDebug" class="debug-box">
          <p>MQTT连接状态：{{ debug.connected ? '已连接' : '未连接' }}</p>
          <p>当前订阅 Topic：{{ debug.subscribedTopics.join('、') }}</p>
          <p>命令 Topic：{{ debug.commandTopic }}</p>
          <h3>最近收到 State JSON</h3>
          <pre>{{ pretty(debug.lastState) }}</pre>
          <h3>最近发送 CMD JSON</h3>
          <pre>{{ pretty(debug.lastCommand) }}</pre>
          <h3>最近收到 ACK JSON</h3>
          <pre>{{ pretty(debug.lastAck) }}</pre>
        </div>
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
const showDebug = ref(false);
const modes = ['MANUAL', 'TIMER', 'PLAN', 'AUTO', 'REMOTE'];
const timerForm = reactive({
  name: 'Morning irrigation',
  startTime: '08:00',
  pump: 1,
  valvesText: '1,2,3',
  durationMinutes: 10,
  enabled: true
});
const planForm = reactive({
  name: 'Greenhouse Plan',
  enabled: true,
  groups: []
});
const groupForm = reactive({
  groupName: 'Group A',
  pump: 1,
  valvesText: '1,3,5,6',
  durationMinutes: 10
});
let timer;

const device = computed(() => consoleData.value.device);
const timerTasks = computed(() => consoleData.value.timerTasks || []);
const plans = computed(() => consoleData.value.plans || []);
const logs = computed(() => consoleData.value.logs || []);
const debug = computed(() => consoleData.value.debug || {});
const lastAck = computed(() => device.value.lastAck || {});
const ackResult = computed(() => {
  if (!device.value.lastAck) return '-';
  return lastAck.value.success === false ? '失败' : '成功';
});
const alarmText = computed(() => (device.value.alarmCode ? `报警码 ${device.value.alarmCode}` : '正常'));
const activeValvesText = computed(() => {
  const active = device.value.state.valves
    .map((value, index) => (value ? index + 1 : null))
    .filter(Boolean);
  return active.length ? active.join(', ') : '无';
});

async function loadConsole() {
  consoleData.value = await api(`/console/${route.params.deviceId}`);
}

function valveOn(valveNumber) {
  return Number(device.value.state.valves[valveNumber - 1]) === 1;
}

async function controlPump(pump, value) {
  await api(`/devices/${device.value.id}/pumps/${pump}`, {
    method: 'POST',
    body: JSON.stringify({ value })
  });
  await loadConsole();
}

async function controlValve(valve, value) {
  await api(`/devices/${device.value.id}/valves/${valve}`, {
    method: 'POST',
    body: JSON.stringify({ value })
  });
  await loadConsole();
}

async function emergencyStop() {
  await api(`/devices/${device.value.id}/emergency-stop`, { method: 'POST' });
  await loadConsole();
}

async function setMode(mode) {
  await api(`/devices/${device.value.id}/mode`, {
    method: 'POST',
    body: JSON.stringify({ mode })
  });
  await loadConsole();
}

async function createTimerTask() {
  await api(`/devices/${device.value.id}/timer-tasks`, {
    method: 'POST',
    body: JSON.stringify({
      name: timerForm.name,
      startTime: timerForm.startTime,
      pump: timerForm.pump,
      valves: parseValveList(timerForm.valvesText),
      durationMinutes: timerForm.durationMinutes,
      enabled: timerForm.enabled
    })
  });
  await loadConsole();
}

async function sendTimerTask(id) {
  await api(`/timer-tasks/${id}/send`, { method: 'POST' });
  await loadConsole();
}

async function deleteTimerTask(id) {
  await api(`/timer-tasks/${id}`, { method: 'DELETE' });
  await loadConsole();
}

function addGroup() {
  const group = {
    groupName: groupForm.groupName,
    pump: groupForm.pump,
    valves: parseValveList(groupForm.valvesText),
    durationMinutes: Number(groupForm.durationMinutes)
  };
  if (group.groupName && group.valves.length && group.durationMinutes) {
    planForm.groups.push(group);
  }
}

async function createPlan() {
  await api(`/devices/${device.value.id}/device-plans`, {
    method: 'POST',
    body: JSON.stringify(planForm)
  });
  planForm.groups = [];
  await loadConsole();
}

async function sendPlan(id) {
  await api(`/device-plans/${id}/send`, { method: 'POST' });
  await loadConsole();
}

async function deletePlan(id) {
  await api(`/device-plans/${id}`, { method: 'DELETE' });
  await loadConsole();
}

function parseValveList(value) {
  return [...new Set(String(value).split(',').map((item) => Number(item.trim())).filter((item) => item >= 1 && item <= 32))];
}

function pretty(value) {
  if (!value) return '-';
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

function formatTime(value) {
  if (!value) return '';
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (input) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

onMounted(() => {
  loadConsole();
  timer = window.setInterval(loadConsole, 3000);
});

onBeforeUnmount(() => window.clearInterval(timer));
</script>
