<template>
  <section class="page-stack">
    <header class="page-header">
      <div>
        <p class="eyebrow">作物管理</p>
        <h1>作物档案</h1>
      </div>
    </header>

    <article class="panel">
      <form class="form-grid" @submit.prevent="createCrop">
        <input v-model="form.name" placeholder="作物名称" required />
        <input v-model="form.variety" placeholder="品种" />
        <input v-model="form.plantingDate" type="date" />
        <input v-model="form.area" placeholder="面积" />
        <input v-model="form.remark" class="span-2" placeholder="备注" />
        <button>新增作物</button>
      </form>
    </article>

    <article class="panel">
      <div class="table">
        <div class="table-row table-head crop-table">
          <span>作物名称</span>
          <span>品种</span>
          <span>种植日期</span>
          <span>面积</span>
          <span>备注</span>
          <span>操作</span>
        </div>
        <div v-for="crop in crops" :key="crop.id" class="table-row crop-table">
          <strong>{{ crop.name }}</strong>
          <span>{{ crop.variety || '-' }}</span>
          <span>{{ crop.planting_date || '-' }}</span>
          <span>{{ crop.area || '-' }}</span>
          <span>{{ crop.remark || '-' }}</span>
          <button class="secondary" @click="deleteCrop(crop.id)">删除</button>
        </div>
      </div>
    </article>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { api } from '../api/client';

const crops = ref([]);
const form = reactive({
  name: '',
  variety: '',
  plantingDate: '',
  area: '',
  remark: ''
});

async function loadCrops() {
  crops.value = await api('/crops');
}

async function createCrop() {
  await api('/crops', {
    method: 'POST',
    body: JSON.stringify(form)
  });
  Object.assign(form, { name: '', variety: '', plantingDate: '', area: '', remark: '' });
  await loadCrops();
}

async function deleteCrop(id) {
  await api(`/crops/${id}`, { method: 'DELETE' });
  await loadCrops();
}

onMounted(loadCrops);
</script>
