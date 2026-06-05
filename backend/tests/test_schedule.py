def test_schedule_sets_date_and_status(client, fake_sb):
    fake_sb.seed("contents", [{"id": 3, "title": "d", "status": "draft", "scheduled_at": None}])

    resp = client.patch("/api/contents/3/schedule", json={"scheduled_at": "2026-06-10"})

    assert resp.status_code == 200
    row = fake_sb.store["contents"][0]
    assert row["status"] == "scheduled"
    assert row["scheduled_at"] == "2026-06-10"
    out = resp.json()
    assert out["id"] == 3
    assert out["status"] == "scheduled"


def test_schedule_unknown_content_returns_404(client):
    resp = client.patch("/api/contents/999/schedule", json={"scheduled_at": "2026-06-10"})
    assert resp.status_code == 404
