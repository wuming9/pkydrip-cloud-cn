<template>
  <section class="page-stack">
    <header class="page-header">
      <div>
        <p class="eyebrow">设备管理</p>
        <h1>设备列表</h1>
      </div>
    </header>

    <article class="panel">
      <div class="table">
        <div class="table-row table-head">
          <span>设备名称</span>
          <span>设备在线状态</span>
          <span>设备ID</span>
          <span>固件版本</span>
          <span>最近通信时间</span>
          <span>操作</span>
        </div>
        <div v-for="device in devices" :key="device.id" class="table-row">
          <strong>{{ device.name }}</strong>
          <span :class="device.online ? 'ok-text' : 'muted-text'">{{ device.online ? '在线' : '离线' }}</span>
          <span>{{ device.id }}</span>
          <span>{{ device.firmwareVersion || '-' }}</span>
          <span>{{ formatTime(device.lastSeenAt) || '暂无' }}</span>
          <router-link class="text-action" :to="`/console/${device.id}`">进入控制台</router-link>
        </div>
      </div>
    </article>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { api } from '../api/client';

const devices = ref([]);

async function loadDevices() {
  devices.value = await api('/devices');
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (input) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

onMounted(loadDevices);
</script>
