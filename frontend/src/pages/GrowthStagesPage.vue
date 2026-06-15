<template>
  <section class="page-stack">
    <header class="page-header">
      <div>
        <p class="eyebrow">生长阶段</p>
        <h1>阶段配置</h1>
      </div>
    </header>

    <article class="panel">
      <form class="inline-form" @submit.prevent="createStage">
        <input v-model="stageName" placeholder="自定义阶段名称" required />
        <button>新增阶段</button>
      </form>
    </article>

    <div class="stage-grid">
      <article v-for="stage in stages" :key="stage.id" class="stage-card">
        <strong>{{ stage.name }}</strong>
        <span>{{ stage.custom ? '自定义' : '系统阶段' }}</span>
        <button v-if="stage.custom" class="secondary" @click="deleteStage(stage.id)">删除</button>
      </article>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { api } from '../api/client';

const stages = ref([]);
const stageName = ref('');

async function loadStages() {
  stages.value = await api('/growth-stages');
}

async function createStage() {
  await api('/growth-stages', {
    method: 'POST',
    body: JSON.stringify({ name: stageName.value })
  });
  stageName.value = '';
  await loadStages();
}

async function deleteStage(id) {
  await api(`/growth-stages/${id}`, { method: 'DELETE' });
  await loadStages();
}

onMounted(loadStages);
</script>
