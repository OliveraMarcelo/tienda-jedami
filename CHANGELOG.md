# Changelog

## [1.4.1](https://github.com/OliveraMarcelo/tienda-jedami/compare/v1.4.0...v1.4.1) (2026-11-10)


### Bug Fixes

* **payments:** marcar como aprobado el pago de Mercado Pago sin error de tipos en la query ([9d5d793](https://github.com/OliveraMarcelo/tienda-jedami/commit/9d5d79319fd459d4be65ea79efc80965b6976b5e))

## [1.4.0](https://github.com/OliveraMarcelo/tienda-jedami/compare/v1.3.0...v1.4.0) (2026-11-10)


### Features

* **payments:** sincronizar el estado del pago con Mercado Pago y procesar reintentos en el webhook ([1494c1b](https://github.com/OliveraMarcelo/tienda-jedami/commit/1494c1b3b58652f766f9f04af7925ce97bdc76ef))
* **web:** QR de Mercado Pago por pedido con confirmación automática ([d24abeb](https://github.com/OliveraMarcelo/tienda-jedami/commit/d24abebf3d6d1b661cbaec0e9545dd88bf519e24))

## [1.3.0](https://github.com/OliveraMarcelo/tienda-jedami/compare/v1.2.0...v1.3.0) (2026-11-09)


### Features

* **categories:** devolver productCount en GET /categories ([b01ea9f](https://github.com/OliveraMarcelo/tienda-jedami/commit/b01ea9f5986f8e3b20929ddbe7b1adf6fc9c567b))
* **web:** rediseño de la tienda estilo Cheeky y admin estilo Tiendanube ([d9f42f0](https://github.com/OliveraMarcelo/tienda-jedami/commit/d9f42f0713d94c750f80b2fc7c233d862e0f0e56))


### Bug Fixes

* **products:** no borrar la categoría al actualizar un producto sin categoryId ([ffa03a8](https://github.com/OliveraMarcelo/tienda-jedami/commit/ffa03a8a537f6ab5cbb3bc26f68f79760f750349))

## [1.2.0](https://github.com/OliveraMarcelo/tienda-jedami/compare/v1.1.1...v1.2.0) (2026-11-09)


### Features

* **products:** ocultar productos del catálogo sin borrarlos ([3dc8c7a](https://github.com/OliveraMarcelo/tienda-jedami/commit/3dc8c7a74e48fb33c33e644818cd16f376b84027))

## [1.1.1](https://github.com/OliveraMarcelo/tienda-jedami/compare/v1.1.0...v1.1.1) (2026-11-09)


### Bug Fixes

* **infra:** servir imágenes subidas en /uploads y generar URLs https ([6a53b7f](https://github.com/OliveraMarcelo/tienda-jedami/commit/6a53b7fd70feac3a6fbdf25f9c0cd7fb9a06aee2))

## [1.1.0](https://github.com/OliveraMarcelo/tienda-jedami/compare/v1.0.0...v1.1.0) (2026-11-01)


### Features

* **infra:** provisioning dev+stg con Terraform KVM y workflows CI/CD ([6a2a071](https://github.com/OliveraMarcelo/tienda-jedami/commit/6a2a07100aca9739a42eda53e26d77f9bd142082))


### Bug Fixes

* **ci:** excluir RC del deploy a prod y corregir tag de imagen ([0da2c7f](https://github.com/OliveraMarcelo/tienda-jedami/commit/0da2c7f340e3d0c3c3d9ebdb122c0a7c946daa07))
* **ci:** quitar tag major.minor de imágenes Docker ([5833548](https://github.com/OliveraMarcelo/tienda-jedami/commit/583354879f51404c0cd907f38665b9ea440556e1))
* **ci:** release-please cubre todo el repo y dispara el deploy a prod ([722f9e3](https://github.com/OliveraMarcelo/tienda-jedami/commit/722f9e30fdeb41cd9e604b17e15438269c1b4f2b))
* **ci:** usar versión específica en prod en lugar de latest ([1784e14](https://github.com/OliveraMarcelo/tienda-jedami/commit/1784e14561c4d79a34e480a363df3619ddcd81f0))
* **infra:** ambientes dev+stg funcionando en VMs locales ([014440d](https://github.com/OliveraMarcelo/tienda-jedami/commit/014440d81bcc012c83eea3c8bc1f59c1a9d9b565))
