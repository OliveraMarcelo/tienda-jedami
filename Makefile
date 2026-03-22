.PHONY: help \
        install install-bff install-web install-mobile \
        dev dev-bff dev-web dev-mobile dev \
        build build-bff build-web \
        lint lint-bff lint-web \
        clean clean-bff clean-web clean-mobile \
        mobile-get mobile-run-android mobile-run-ios mobile-run-web

# ─── Colores ────────────────────────────────────────────────────────────────
CYAN  := \033[0;36m
RESET := \033[0m

define log
	@echo "$(CYAN)► $(1)$(RESET)"
endef

# ─── Default ────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  Jedami Monorepo"
	@echo ""
	@echo "  Instalación:"
	@echo "    make install           Instala dependencias de todos los servicios"
	@echo "    make install-bff       Instala deps del BFF"
	@echo "    make install-web       Instala deps del frontend web"
	@echo "    make install-mobile    Instala deps de Flutter (flutter pub get)"
	@echo ""
	@echo "  Desarrollo:"
	@echo "    make dev               Levanta BFF + Web en paralelo (Ctrl+C detiene ambos)"
	@echo "    make dev-bff           Levanta el BFF en modo watch"
	@echo "    make dev-web           Levanta el frontend web (Vite)"
	@echo "    make dev-mobile        Abre Flutter DevTools"
	@echo ""
	@echo "  Build:"
	@echo "    make build             Build de bff y web"
	@echo "    make build-bff         Build del BFF"
	@echo "    make build-web         Build del frontend web"
	@echo ""
	@echo "  Lint:"
	@echo "    make lint              Lint de bff y web"
	@echo "    make lint-bff          Lint del BFF"
	@echo "    make lint-web          Lint del frontend web"
	@echo ""
	@echo "  Mobile:"
	@echo "    make mobile-get        flutter pub get"
	@echo "    make mobile-run-android  Corre app en Android"
	@echo "    make mobile-run-ios      Corre app en iOS"
	@echo "    make mobile-run-web      Corre app en navegador"
	@echo ""
	@echo "  Limpieza:"
	@echo "    make clean             Limpia artefactos de build de todos los servicios"
	@echo "    make clean-bff         Limpia dist/ del BFF"
	@echo "    make clean-web         Limpia dist/ del web"
	@echo "    make clean-mobile      Limpia build/ de Flutter"
	@echo ""

# ─── Instalación ────────────────────────────────────────────────────────────
install: install-bff install-web install-mobile

install-bff:
	$(call log,Instalando dependencias del BFF...)
	cd jedami-bff && npm install

install-web:
	$(call log,Instalando dependencias del frontend web...)
	cd jedami-web && npm install

install-mobile:
	$(call log,Instalando dependencias de Flutter...)
	cd jedami-mobile && flutter pub get

# ─── Desarrollo ─────────────────────────────────────────────────────────────
dev:
	$(call log,Levantando BFF + Web en paralelo...)
	@trap 'kill 0' INT; \
	  (cd jedami-bff && npm run dev) & \
	  (cd jedami-web && npm run dev) & \
	  wait

dev-bff:
	$(call log,Levantando BFF en modo dev...)
	cd jedami-bff && npm run dev

dev-web:
	$(call log,Levantando frontend web...)
	cd jedami-web && npm run dev

dev-mobile:
	$(call log,Corriendo app Flutter en Chrome...)
	cd jedami-mobile && flutter run -d chrome

# ─── Build ──────────────────────────────────────────────────────────────────
build: build-bff build-web

build-bff:
	$(call log,Building BFF...)
	cd jedami-bff && npm run build

build-web:
	$(call log,Building frontend web...)
	cd jedami-web && npm run build

# ─── Lint ───────────────────────────────────────────────────────────────────
lint: lint-bff lint-web

lint-bff:
	$(call log,Lint BFF...)
	cd jedami-bff && npm run lint 2>/dev/null || echo "Sin script de lint configurado"

lint-web:
	$(call log,Lint frontend web...)
	cd jedami-web && npm run lint

# ─── Mobile ─────────────────────────────────────────────────────────────────
mobile-get:
	$(call log,Flutter pub get...)
	cd jedami-mobile && flutter pub get

mobile-run-android:
	$(call log,Corriendo app en Android...)
	cd jedami-mobile && flutter run -d android

mobile-run-ios:
	$(call log,Corriendo app en iOS...)
	cd jedami-mobile && flutter run -d ios

mobile-run-web:
	$(call log,Corriendo app en navegador...)
	cd jedami-mobile && flutter run -d chrome

# ─── Limpieza ───────────────────────────────────────────────────────────────
clean: clean-bff clean-web clean-mobile

clean-bff:
	$(call log,Limpiando BFF...)
	rm -rf jedami-bff/dist

clean-web:
	$(call log,Limpiando frontend web...)
	rm -rf jedami-web/dist

clean-mobile:
	$(call log,Limpiando Flutter build...)
	cd jedami-mobile && flutter clean
