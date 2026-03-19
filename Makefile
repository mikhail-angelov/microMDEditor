# Micro MD Editor Makefile
# ========================

# Development
.PHONY: dev
dev:
	@echo "Starting development server..."
	npm run dev

.PHONY: test
test:
	@echo "Running tests..."
	npm test

.PHONY: test-watch
test-watch:
	@echo "Running tests in watch mode..."
	npm run test:watch

.PHONY: lint
lint:
	@echo "Running linter..."
	npm run lint

.PHONY: build
build:
	@echo "Building library..."
	npm run build

# Example/Demo
.PHONY: example
example:
	@echo "Starting example app..."
	npm run example

.PHONY: example-build
example-build:
	@echo "Building example app..."
	cd example && npm run build

# Deployment
.PHONY: deploy
deploy:
	@echo "Deploying to GitHub Pages..."
	npm run deploy

.PHONY: deploy-dry-run
deploy-dry-run:
	@echo "Dry run deployment (build only)..."
	npm run deploy:build-example
	@echo "Demo would be copied to ./demo directory"

.PHONY: preview
preview:
	@echo "Previewing demo locally..."
	@if [ -d "demo" ]; then \
		echo "Opening demo at http://localhost:8080"; \
		cd demo && python3 -m http.server 8080; \
	else \
		echo "Demo not built. Run 'make deploy-dry-run' first."; \
	fi

# Cleanup
.PHONY: clean
clean:
	@echo "Cleaning build artifacts..."
	rm -rf dist demo
	cd example && rm -rf dist

.PHONY: clean-all
clean-all: clean
	@echo "Cleaning node_modules..."
	rm -rf node_modules example/node_modules

# Help
.PHONY: help
help:
	@echo "Micro MD Editor - Available commands:"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start development server"
	@echo "  make test         - Run tests"
	@echo "  make test-watch   - Run tests in watch mode"
	@echo "  make lint         - Run linter"
	@echo "  make build        - Build library"
	@echo ""
	@echo "Example/Demo:"
	@echo "  make example      - Start example app"
	@echo "  make example-build - Build example app"
	@echo ""
	@echo "Deployment:"
	@echo "  make deploy       - Deploy to GitHub Pages"
	@echo "  make deploy-dry-run - Build demo without deploying"
	@echo "  make preview      - Preview demo locally"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean        - Remove build artifacts"
	@echo "  make clean-all    - Remove build artifacts and node_modules"
	@echo ""
	@echo "Help:"
	@echo "  make help         - Show this help message"
	@echo ""
	@echo "GitHub Pages URL: https://mikhail-angelov.github.io/microMDEditor/"