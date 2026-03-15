<template>
  <div class="min-h-screen bg-[#F0F8FF] animate-pulse">
    <!-- Header -->
    <div class="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div class="h-5 w-24 bg-gray-200 rounded"></div>
        <div class="flex items-center gap-4">
          <div class="h-4 w-16 bg-gray-200 rounded"></div>
          <div class="h-4 w-20 bg-gray-200 rounded"></div>
          <div class="h-7 w-24 bg-gray-200 rounded-full"></div>
        </div>
      </div>
    </div>
    <!-- Contenido -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        <div v-for="n in 8" :key="n" class="rounded-2xl bg-gray-200 aspect-[3/4]"></div>
      </div>
    </main>
  </div>
</template>
