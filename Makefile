PYTHON ?= python3
STREAMLIT ?= streamlit

.PHONY: install demo test ui ui-check verify

install:
	$(PYTHON) -m pip install -r requirements.txt
	$(PYTHON) -m pip install -e .

demo:
	$(PYTHON) scripts/demo.py

test:
	$(PYTHON) -m pytest -q

ui:
	$(STREAMLIT) run ui/app.py

ui-check:
	$(PYTHON) scripts/ui_check.py

verify: install demo test ui-check
