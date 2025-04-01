SHELL := /bin/bash

.PHONY: all setup run clean

all: run

.env: .env.example
	cp .env.example .env



run: .env
	@echo "Starting services..."

	docker compose up -d --build
	@echo "Observability Query Language is now running!"
	@echo "Visit: http://localhost:3000/a/quesma-oql-app/one"

stop:
	docker compose down

# Convienience aliases
up: run
down: stop

clean:
	docker compose down
	rm -rf dist
	rm -rf node_modules
