from app.core.middleware import REQUEST_ID_HEADER
from tests.conftest import register_user


async def test_request_id_is_returned(client):
    res = await client.get("/healthz", headers={REQUEST_ID_HEADER: "550e8400-e29b-41d4-a716-446655440000"})
    assert res.status_code == 200
    assert res.headers[REQUEST_ID_HEADER] == "550e8400-e29b-41d4-a716-446655440000"


async def test_request_id_is_generated_when_missing(client):
    res = await client.get("/healthz")
    assert res.status_code == 200
    assert res.headers[REQUEST_ID_HEADER]


async def test_authenticated_route_has_request_id(client):
    headers, _ = await register_user(client)
    res = await client.get("/me", headers=headers)
    assert res.status_code == 200
    assert res.headers[REQUEST_ID_HEADER]
