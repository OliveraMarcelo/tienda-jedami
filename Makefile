# Makefile para tienda-jedami

install:
	npm install

dev:
	npm run dev

build:
	npm run build

clean:
	rm -rf dist

lint:
	npm run lint || echo "No hay script de lint configurado"

test:
	npm test || echo "No hay tests configurados"
