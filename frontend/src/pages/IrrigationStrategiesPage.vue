<template>
  <section class="page-stack">
    <header class="page-header">
      <div>
        <p class="eyebrow">灌溉策略</p>
        <h1>策略配置</h1>
      </div>
    </header>

    <article class="panel">
      <form class="strategy-form" @submit.prevent="createStrategy">
        <input v-model="form.name" placeholder="策略名称" required />
        <select v-model="form.cropId">
          <option value="">关联作物</option>
          <option v-for="crop in crops" :key="crop.id" :value="crop.id">{{ crop.name }}</option>
        </select>
        <select v-model="form.growthStageId">
          <option value="">关联生长阶段</option>
          <option v-for="stage in stages" :key="stage.id" :value="stage.id">{{ stage.name }}</option>
        </select>
        <input v-model.number="form.dailyTimes" type="number" min="1" placeholder="每日次数" />
        <input v-model="form.startTime" type="time" required />
        <input v-model.number="form.durationMinutes" type="number" min="1" placeholder="运行时长/分钟" required />
        <input v-model.number="form.soilMoistureThreshold" type="number" placeholder="土壤湿度阈值" />
        <input v-model="form.remark" class="span-2" placeholder="备注" />
        <button>新增策略</button>
      </form>
    </article>

    <article class="panel">
      <div class="table">
        <div class="table-row table-head strategy-table">
          <span>策略名称</span>
          <span>作物</span>
          <span>阶段</span>
          <span>每日次数</span>
          <span>开始时间</span>
          <span>运行时长</span>
          <span>土壤湿度阈值</span>
          <span>备注</span>
          <span>操作</span>
        </div>
        <div v-for="strategy in strategies" :key="strategy.id" class="table-row strategy-table">
          <strong>{{ strategy.name }}</strong>
          <span>{{ strategy.cropName || '-' }}</span>
          <span>{{ strategy.growthStageName || '-' }}</span>
          <span>{{ strategy.dailyTimes }} 次</span>
          <span>{{ strategy.startTime }}</span>
          <span>{{ strategy.durationMinutes }} 分钟</span>
          <span>{{ strategy.soilMoistureThreshold ?? '-' }}</span>
          <span>{{ strategy.remark || '-' }}</span>
          <button class="secondary" @click="deleteStrategy(strategy.id)">删除</button>
        </div>
      </div>
    </article>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { api } from '../api/client';

const crops = ref([]);
const stages = ref([]);
const strategies = ref([]);
const form = reactive({
  name: '',
  cropId: '',
  growthStageId: '',
  dailyTimes: 1,
  startTime: '08:00',
  durationMinutes: 10,
  soilMoistureThreshold: '',
  remark: ''
});

async function loadAll() {
  const [cropResult, stageResult, strategyResult] = await Promise.all([
    api('/crops'),
    api('/growth-stages'),
    api('/strategies')
  ]);
  crops.value = cropResult;
  stages.value = stageResult;
  strategies.value = strategyResult;
}

async function createStrategy() {
  await api('/strategies', {
    method: 'POST',
    body: JSON.stringify(form)
  });
  Object.assign(form, {
    name: '',
    cropId: '',
    growthStageId: '',
    dailyTimes: 1,
    startTime: '08:00',
    durationMinutes: 10,
    soilMoistureThreshold: '',
    remark: ''
  });
  await loadAll();
}

async function deleteStrategy(id) {
  await api(`/strategies/${id}`, { method: 'DELETE' });
  await loadAll();
}

onMounted(loadAll);
</script>
