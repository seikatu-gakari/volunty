COMPOSE ?= docker compose
SERVICE ?= next-app
APP_DIR ?= app

.PHONY: help install build up up-detached down restart logs shell lint type-check build-next clean supabase-start supabase-stop supabase-status supabase-reset supabase-clean db-migrate db-seed db-setup

help: ## 利用可能なコマンド一覧を表示
	@grep -E '^[a-zA-Z_-]+:.*?##' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?##"} {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## ホストマシンに依存関係をインストール（app/package.jsonに基づきnpm installを実行）
	cd $(APP_DIR) && npm install

build: ## Dockerイメージをビルド（開発環境の構築）
	$(COMPOSE) build

up: ## 開発サーバーを前面起動（フォアグラウンド、http://localhost:3000でアクセス可能）
	@echo "Supabase ローカル環境を起動中..."
	supabase start
	$(COMPOSE) up --build

up-detached: ## 開発サーバーをバックグラウンド起動（デーモンモード）
	$(COMPOSE) up -d

down: ## 開発サーバーを停止してコンテナを削除
	$(COMPOSE) down
	@echo "Supabase ローカル環境を停止してコンテナを削除中..."
	supabase stop --no-backup

restart: ## 開発サーバーを再起動（down → up）
	$(MAKE) down && $(MAKE) up

logs: ## Next.jsコンテナのログをリアルタイム表示
	$(COMPOSE) logs -f $(SERVICE)

shell: ## Next.jsコンテナ内でシェルを起動（デバッグやコマンド実行用）
	$(COMPOSE) run --rm $(SERVICE) sh

lint: ## ESLintをコンテナ内で実行（コード品質チェック）
	$(COMPOSE) run --rm $(SERVICE) npm run lint

type-check: ## TypeScriptの型チェックをコンテナ内で実行（npm run buildで検証）
	$(COMPOSE) run --rm $(SERVICE) npm run build

build-next: ## Next.jsの本番ビルドをホストマシンで実行（本番デプロイ前の検証用）
	cd $(APP_DIR) && npm run build

clean: ## コンテナを停止してボリュームも削除（完全クリーンアップ）
	$(COMPOSE) down -v

# ============================================
# Supabase ローカル開発
# ============================================

supabase-start: ## Supabase ローカル環境を起動（Auth + PostgreSQL）
	supabase start

supabase-stop: ## Supabase ローカル環境を停止
	supabase stop

supabase-status: ## Supabase ローカル環境のステータスを表示
	supabase status

supabase-reset: ## ローカルDBをリセット（マイグレーション再適用 + seed）
	supabase db reset

supabase-clean: ## Supabase コンテナを停止してDBデータを完全削除（バックアップなし）
	supabase stop --no-backup

db-migrate: ## Prisma マイグレーションをローカルDBに適用
	cd $(APP_DIR) && npx prisma migrate dev

db-seed: ## Prisma シードをローカルDBに実行
	cd $(APP_DIR) && npx prisma db seed

db-setup: ## ローカルDB初期セットアップ（supabase start → migrate → seed）
	@echo "Supabase ローカル環境を起動中..."
	supabase start
	@echo "Prisma マイグレーションを適用中..."
	cd $(APP_DIR) && npx prisma migrate dev
	@echo "ローカルDB セットアップ完了！"
