COMPOSE ?= docker compose
SERVICE ?= next-app
APP_DIR ?= app

.PHONY: help install build up up-detached down restart logs shell lint type-check build-next clean supabase-start supabase-stop supabase-status supabase-reset supabase-clean db-migrate db-seed db-setup promote-admin promote-admin-prod

help: ## 利用可能なコマンド一覧を表示
	@grep -E '^[a-zA-Z_-]+:.*?##' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?##"} {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## ホストマシンに依存関係をインストール（app/package.jsonに基づきnpm installを実行）
	cd $(APP_DIR) && npm install

build: ## Dockerイメージをビルド（開発環境の構築）
	$(COMPOSE) build

up: ## 開発サーバーを前面起動（フォアグラウンド、http://localhost:3000でアクセス可能）
	@echo "Supabase ローカル環境を起動中..."
	@set -a; . ./app/.env.local 2>/dev/null; set +a; supabase start
	$(COMPOSE) up --build

up-detached: ## 開発サーバーをバックグラウンド起動（デーモンモード）
	$(COMPOSE) up -d

down: ## 開発サーバーを停止してコンテナを削除
	$(COMPOSE) down
	@echo "Supabase ローカル環境を停止してコンテナを削除中..."
	@set -a; . ./app/.env.local 2>/dev/null; set +a; supabase stop --no-backup

restart: ## 開発サーバーを再起動（down → up）
	$(MAKE) down && $(MAKE) up

logs: ## Next.jsコンテナのログをリアルタイム表示
	$(COMPOSE) logs -f $(SERVICE)

shell: ## Next.jsコンテナ内でシェルを起動（デバッグやコマンド実行用）
	$(COMPOSE) run --rm $(SERVICE) sh

lint: ## ESLintをコンテナ内で実行（コード品質チェック）
	$(COMPOSE) run --rm $(SERVICE) npm run lint

type-check: ## TypeScriptの型チェックをコンテナ内で実行（npm run buildで検証）
	$(COMPOSE) run --rm -e NODE_ENV=production $(SERVICE) npm run build

build-next: ## Next.jsの本番ビルドをホストマシンで実行（本番デプロイ前の検証用）
	cd $(APP_DIR) && npm run build

clean: ## コンテナを停止してボリュームも削除（完全クリーンアップ）
	$(COMPOSE) down -v

# ============================================
# Supabase ローカル開発
# ============================================

supabase-start: ## Supabase ローカル環境を起動（Auth + PostgreSQL）
	@set -a; . ./app/.env.local 2>/dev/null; set +a; supabase start

supabase-stop: ## Supabase ローカル環境を停止
	@set -a; . ./app/.env.local 2>/dev/null; set +a; supabase stop

supabase-status: ## Supabase ローカル環境のステータスを表示
	supabase status

supabase-reset: ## ローカルDBをリセット（マイグレーション再適用 + seed）
	supabase db reset

supabase-clean: ## Supabase コンテナを停止してDBデータを完全削除（バックアップなし）
	@set -a; . ./app/.env.local 2>/dev/null; set +a; supabase stop --no-backup

db-migrate: ## Prisma マイグレーションをローカルDBに適用
	cd $(APP_DIR) && npx prisma migrate dev

db-seed: ## Prisma シードをローカルDBに実行
	cd $(APP_DIR) && npx prisma db seed

db-setup: ## ローカルDB初期セットアップ（supabase start → migrate → seed）
	@echo "Supabase ローカル環境を起動中..."
	@set -a; . ./app/.env.local 2>/dev/null; set +a; supabase start
	@echo "Prisma マイグレーションを適用中..."
	cd $(APP_DIR) && npx prisma migrate dev
	@echo "ローカルDB セットアップ完了！"

promote-admin: ## ローカル管理者アカウントを作成/更新（例: make promote-admin EMAIL=you@example.com PASSWORD=secret）
	@if [ -z "$(EMAIL)" ]; then echo "EMAIL=<email> を指定してください"; exit 1; fi
	cd $(APP_DIR) && npx tsx scripts/promote-admin.ts "$(EMAIL)" "$(PASSWORD)"

promote-admin-prod: ## 本番管理者アカウントを作成/更新（SUPABASE_URL / SERVICE_ROLE_KEY / DATABASE_URL を必ず指定）
	@if [ -z "$(EMAIL)" ]; then echo "EMAIL=<email> を指定してください"; exit 1; fi
	@if [ -z "$(SUPABASE_URL)" ]; then echo "SUPABASE_URL=<url> を指定してください"; exit 1; fi
	@if [ -z "$(SERVICE_ROLE_KEY)" ]; then echo "SERVICE_ROLE_KEY=<key> を指定してください"; exit 1; fi
	@if [ -z "$(DATABASE_URL)" ]; then echo "DATABASE_URL=<url> を指定してください"; exit 1; fi
	cd $(APP_DIR) && SUPABASE_URL="$(SUPABASE_URL)" SUPABASE_SERVICE_ROLE_KEY="$(SERVICE_ROLE_KEY)" DATABASE_URL="$(DATABASE_URL)" npx tsx scripts/promote-admin.ts "$(EMAIL)" "$(PASSWORD)"
