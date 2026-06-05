def test_upload_unknown_content_404(client):
    resp = client.post("/api/upload/999", json={"platforms": ["youtube"]})
    assert resp.status_code == 404


def test_upload_creates_history_and_tracking(client, fake_sb):
    fake_sb.seed("contents", [{"id": 5, "title": "t", "status": "draft"}])

    resp = client.post("/api/upload/5", json={"platforms": ["youtube", "facebook"]})

    assert resp.status_code == 200
    body = resp.json()
    assert len(body["results"]) == 2
    assert len(fake_sb.store["upload_history"]) == 2
    assert len(fake_sb.store["tracking_links"]) == 2
    # content 상태가 uploading 으로 갱신
    assert fake_sb.store["contents"][0]["status"] == "uploading"
    # tracking_url 형식
    assert body["results"][0]["tracking_url"].startswith("/t/")


def test_retry_non_failed_400(client, fake_sb):
    fake_sb.seed("upload_history", [{"id": 1, "content_id": 5, "platform": "youtube", "status": "pending"}])
    resp = client.post("/api/upload/retry/1")
    assert resp.status_code == 400


def test_retry_failed_sets_pending(client, fake_sb):
    fake_sb.seed("upload_history", [{"id": 1, "content_id": 5, "platform": "youtube", "status": "failed", "error_message": "boom"}])
    resp = client.post("/api/upload/retry/1")
    assert resp.status_code == 200
    assert fake_sb.store["upload_history"][0]["status"] == "pending"
    assert fake_sb.store["upload_history"][0]["error_message"] is None
