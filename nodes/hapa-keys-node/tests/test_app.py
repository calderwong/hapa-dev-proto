import pytest
from fastapi.testclient import TestClient

from hapa_keys_node.app import ENV_FALLBACKS, KNOWN_SERVICES, create_app


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("HAPA_KEYS_NODE_TOKEN", "test-token")
    monkeypatch.setenv("HAPA_KEYS_NODE_STORAGE_DIR", str(tmp_path / "data"))

    for names in ENV_FALLBACKS.values():
        for name in names:
            monkeypatch.delenv(name, raising=False)

    app = create_app()
    with TestClient(app) as c:
        yield c


def _auth_headers(token: str = "test-token"):
    return {"Authorization": f"Bearer {token}"}


def test_health_public(client: TestClient):
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert data["service"] == "hapa-keys-node"
    assert data["api_version"] == "v1"
    assert isinstance(data.get("keys_stored"), int)


def test_ui_public(client: TestClient):
    r = client.get("/")
    assert r.status_code == 200
    assert "Hapa Keys Node" in r.text


def test_capabilities_requires_auth(client: TestClient):
    r = client.get("/capabilities")
    assert r.status_code == 401

    r2 = client.get("/capabilities", headers=_auth_headers())
    assert r2.status_code == 200
    data = r2.json()
    assert data["service"] == "hapa-keys-node"
    assert data["api_version"] == "v1"


def test_list_keys_includes_known_services(client: TestClient):
    r = client.get("/v1/keys", headers=_auth_headers())
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    items = data["items"]
    assert isinstance(items, list)

    by_service = {it.get("service"): it for it in items}
    for svc in KNOWN_SERVICES:
        assert svc in by_service


def test_key_crud_roundtrip(client: TestClient):
    service = "gemini"

    put = client.put(f"/v1/keys/{service}", headers=_auth_headers(), json={"value": "abc123"})
    assert put.status_code == 200
    pdata = put.json()
    assert pdata["service"] == service
    assert pdata["configured"] is True
    assert pdata["source"] == "stored"

    getv = client.get(f"/v1/keys/{service}/value", headers=_auth_headers())
    assert getv.status_code == 200
    vdata = getv.json()
    assert vdata["service"] == service
    assert vdata["value"] == "abc123"
    assert vdata["source"] == "stored"

    delete = client.delete(f"/v1/keys/{service}", headers=_auth_headers())
    assert delete.status_code == 200
    ddata = delete.json()
    assert ddata["service"] == service
    assert ddata["deleted"] is True

    getv2 = client.get(f"/v1/keys/{service}/value", headers=_auth_headers())
    assert getv2.status_code == 404


def test_unknown_service_404(client: TestClient):
    r = client.get("/v1/keys/not-a-real-service", headers=_auth_headers())
    assert r.status_code == 404


def test_env_fallback_source(monkeypatch, tmp_path):
    monkeypatch.setenv("HAPA_KEYS_NODE_TOKEN", "test-token")
    monkeypatch.setenv("HAPA_KEYS_NODE_STORAGE_DIR", str(tmp_path / "data"))

    for names in ENV_FALLBACKS.values():
        for name in names:
            monkeypatch.delenv(name, raising=False)

    monkeypatch.setenv("GEMINI_API_KEY", "from-env")

    app = create_app()
    with TestClient(app) as client:
        r = client.get("/v1/keys/gemini", headers=_auth_headers())
        assert r.status_code == 200
        data = r.json()
        assert data["configured"] is True
        assert data["source"] == "env:GEMINI_API_KEY"
