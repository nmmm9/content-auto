import pytest
from fastapi.testclient import TestClient

from main import app
from app.core.database import get_supabase


class FakeResp:
    def __init__(self, data):
        self.data = data


class FakeQuery:
    """supabase-py 빌더 체인 중 라우터가 쓰는 메서드만 흉내내는 인메모리 더블."""

    def __init__(self, store, table):
        self.store = store
        self.table_name = table
        self._filters = []
        self._op = ("select", None)

    def select(self, *args, **kwargs):
        self._op = ("select", None)
        return self

    def insert(self, payload):
        self._op = ("insert", payload)
        return self

    def update(self, payload):
        self._op = ("update", payload)
        return self

    def eq(self, col, val):
        self._filters.append((col, val))
        return self

    def limit(self, *args, **kwargs):
        return self

    def order(self, *args, **kwargs):
        return self

    def range(self, *args, **kwargs):
        return self

    def _match(self, row):
        return all(row.get(c) == v for c, v in self._filters)

    def execute(self):
        rows = self.store.setdefault(self.table_name, [])
        op, payload = self._op
        if op == "select":
            return FakeResp([dict(r) for r in rows if self._match(r)])
        if op == "insert":
            items = payload if isinstance(payload, list) else [payload]
            created = []
            for item in items:
                row = dict(item)
                row.setdefault("id", len(rows) + 1)
                rows.append(row)
                created.append(dict(row))
            return FakeResp(created)
        if op == "update":
            updated = []
            for row in rows:
                if self._match(row):
                    row.update(payload)
                    updated.append(dict(row))
            return FakeResp(updated)
        return FakeResp([])


class FakeSupabase:
    def __init__(self):
        self.store = {}

    def table(self, name):
        return FakeQuery(self.store, name)

    def seed(self, table, rows):
        self.store.setdefault(table, []).extend(dict(r) for r in rows)


@pytest.fixture
def fake_sb():
    return FakeSupabase()


@pytest.fixture
def client(fake_sb):
    app.dependency_overrides[get_supabase] = lambda: fake_sb
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
