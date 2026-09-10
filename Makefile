.PHONY: install
install:
	bash scripts/npm_task.sh install

.PHONY: test
test:
	bash scripts/npm_task.sh test

.PHONY: test-watch
test-watch:
	bash scripts/npm_task.sh test-watch

.PHONY: test-coverage
test-coverage:
	bash scripts/npm_task.sh test-coverage

.PHONY: tests-coverage
tests-coverage:
	bash scripts/npm_task.sh tests-coverage

.PHONY: format
format:
	bash scripts/npm_task.sh format

.PHONY: format-check
format-check:
	bash scripts/npm_task.sh format-check

.PHONY: lint
lint:
	bash scripts/npm_task.sh lint

.PHONY: security
security:
	bash scripts/npm_task.sh security

.PHONY: typecheck
typecheck:
	bash scripts/npm_task.sh typecheck

.PHONY: build
build:
	bash scripts/npm_task.sh build

.PHONY: ssr-smoke
ssr-smoke:
	bash scripts/npm_task.sh ssr-smoke

.PHONY: lighthouse
lighthouse:
	bash scripts/npm_task.sh lighthouse

.PHONY: quality
quality:
	bash scripts/npm_task.sh quality
