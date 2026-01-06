PY?=python3

.PHONY: venv install start stop status test

venv:
	$(PY) -m venv .venv

install:
	. .venv/bin/activate && pip install -r requirements.txt

start:
	. .venv/bin/activate && $(PY) -m hapa_keys_node start

stop:
	. .venv/bin/activate && $(PY) -m hapa_keys_node stop

status:
	. .venv/bin/activate && $(PY) -m hapa_keys_node status

test:
	. .venv/bin/activate && pytest -q
