ENGINE_VENV ?= packages/engine/.venv
ENGINE_PYTHON ?= $(ENGINE_VENV)/bin/python
ENGINE_PIP ?= $(ENGINE_VENV)/bin/pip
ENGINE_SRC ?= $(PWD)/packages/engine/src
WEB_DIR ?= apps/web
ARTIFACT_DIR ?= $(PWD)/apps/web/public/research/latest

.PHONY: install dev run test verify session backtest

install:
	cd $(WEB_DIR) && bun install
	python3 -m venv $(ENGINE_VENV)
	$(ENGINE_PIP) install --upgrade pip
	$(ENGINE_PIP) install -r packages/engine/requirements.txt
	PYTHONPATH=$(ENGINE_SRC) $(ENGINE_PYTHON) -m pip install -e packages/engine

dev:
	cd $(WEB_DIR) && bun run dev

run:
	PYTHONPATH=$(ENGINE_SRC) $(ENGINE_PYTHON) -m engine.scripts.demo --out "$(ARTIFACT_DIR)"

backtest: run

session:
	PYTHONPATH=$(ENGINE_SRC) $(ENGINE_PYTHON) -m engine.scripts.session_cli

test:
	PYTHONPATH=$(ENGINE_SRC) $(ENGINE_PYTHON) -m pytest -q packages/engine/tests

verify: install run test
	cd $(WEB_DIR) && bun run verify
