def test_save_creates_draft_with_success_platforms_only(client, fake_sb):
    body = {
        "video_info": {"title": "My Vid", "thumbnail_url": "http://t/x.jpg", "video_id": "abc"},
        "analysis": {"summary": "A short summary", "keywords": ["k1", "k2"]},
        "results": {
            "youtube_shorts": {"status": "success", "data": {"title": "yt", "hashtags": ["#a"]}},
            "facebook": {"status": "error", "error": "boom"},
        },
    }
    resp = client.post("/api/workflow/save", json=body)
    assert resp.status_code == 200
    out = resp.json()
    assert out["status"] == "draft"
    assert "content_id" in out

    rows = fake_sb.store["contents"]
    assert len(rows) == 1
    row = rows[0]
    assert row["title"] == "My Vid"
    assert row["description"] == "A short summary"
    assert row["tags"] == ["k1", "k2"]
    assert row["thumbnail_path"] == "http://t/x.jpg"
    assert row["status"] == "draft"
    assert set(row["workflow_data"]["generated"].keys()) == {"youtube_shorts"}
    assert row["workflow_data"]["generated"]["youtube_shorts"] == {"title": "yt", "hashtags": ["#a"]}
    assert row["workflow_data"]["video_info"]["video_id"] == "abc"


def test_save_title_fallback_when_missing(client, fake_sb):
    body = {
        "video_info": {},
        "analysis": {"summary": "", "keywords": []},
        "results": {},
    }
    resp = client.post("/api/workflow/save", json=body)
    assert resp.status_code == 200
    assert fake_sb.store["contents"][0]["title"] == "제목 없음"


def test_save_missing_analysis_returns_422(client):
    resp = client.post("/api/workflow/save", json={"video_info": {}, "results": {}})
    assert resp.status_code == 422
