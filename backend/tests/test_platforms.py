def test_list_platforms_seeds_missing(client, fake_sb):
    resp = client.get("/api/platforms/")
    assert resp.status_code == 200
    # 주입된 Supabase 클라이언트에 6종이 lazy-seed 되어야 함
    # (구버전은 SQLAlchemy get_db를 써서 주입 fake를 무시 → store 비어 RED)
    seeded = {row["platform"] for row in fake_sb.store.get("platform_connections", [])}
    assert {"youtube", "naver_blog", "facebook", "instagram", "linkedin", "living_sequence_lab"} <= seeded
    returned = {row["platform"] for row in resp.json()}
    assert {"youtube", "naver_blog", "facebook", "instagram", "linkedin", "living_sequence_lab"} <= returned


def test_disconnect_unsupported_platform_400(client):
    resp = client.post("/api/platforms/nope/disconnect")
    assert resp.status_code == 400


def test_disconnect_clears_tokens(client, fake_sb):
    fake_sb.seed("platform_connections", [{
        "id": 1, "platform": "youtube", "is_connected": True,
        "access_token": "tok", "refresh_token": "ref",
        "account_name": "me", "account_id": "123",
    }])

    resp = client.post("/api/platforms/youtube/disconnect")

    assert resp.status_code == 200
    row = fake_sb.store["platform_connections"][0]
    assert row["is_connected"] is False
    assert row["access_token"] is None
    assert row["refresh_token"] is None
