<script setup lang="ts">
import { cn } from '@/lib/utils'

interface Props {
  class?: string
}

const props = defineProps<Props>()
</script>

<template>
  <div :class="cn('rounded-2xl border border-gray-200 bg-white text-gray-950 shadow-sm', props.class)">
    <slot />
  </div>
</template>
