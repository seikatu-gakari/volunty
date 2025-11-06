COMPOSE ?= docker compose
SERVICE ?= next-app
APP_DIR ?= app

.PHONY: help install build up up-detached down restart logs shell lint type-check build-next clean

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?##' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?##"} {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies on the host machine
	cd $(APP_DIR) && npm install

build: ## Build the Docker image
	$(COMPOSE) build

up: ## Start the development server in the foreground
	$(COMPOSE) up

up-detached: ## Start the development server in the background
	$(COMPOSE) up -d

down: ## Stop the development server and remove containers
	$(COMPOSE) down

restart: ## Restart the development server
	$(COMPOSE) down && $(COMPOSE) up

logs: ## Tail logs from the Next.js container
	$(COMPOSE) logs -f $(SERVICE)

shell: ## Open a shell inside the Next.js container
	$(COMPOSE) run --rm $(SERVICE) sh

lint: ## Run ESLint inside the container
	$(COMPOSE) run --rm $(SERVICE) npm run lint

type-check: ## Run the Next.js build for type-checking inside the container
	$(COMPOSE) run --rm $(SERVICE) npm run build

build-next: ## Run the Next.js production build on the host machine
	cd $(APP_DIR) && npm run build

clean: ## Stop containers and remove volumes
	$(COMPOSE) down -v
