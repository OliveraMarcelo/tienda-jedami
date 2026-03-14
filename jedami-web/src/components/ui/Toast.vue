<script setup lang="ts">
import { cn } from '@/lib/utils'
import { type VariantProps, cva } from 'class-variance-authority'

const toastVariants = cva(
  'group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-xl border p-4 pr-8 shadow-lg transition-all',
  {
    variants: {
      variant: {
        default: 'border bg-white text-gray-950',
        success: 'border-green-200 bg-green-50 text-green-900',
        destructive: 'border-red-200 bg-red-50 text-red-900',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

type ToastVariants = VariantProps<typeof toastVariants>

interface Props {
  variant?: ToastVariants['variant']
  class?: string
}

const props = withDefaults(defineProps<Props>(), { variant: 'default' })
</script>

<template>
  <div :class="cn(toastVariants({ variant: props.variant }), props.class)">
    <slot />
  </div>
</template>
