from app.api.redirect import build_redirect_url


def test_build_redirect_url_merges_utm_into_existing_query():
    url = build_redirect_url(
        "https://site.com/page?ref=x", "youtube", "social", "content_5"
    )
    assert "ref=x" in url
    assert "utm_source=youtube" in url
    assert "utm_medium=social" in url
    assert "utm_campaign=content_5" in url


def test_redirect_unknown_short_code_goes_to_default(client):
    resp = client.get("/t/nope", follow_redirects=False)
    assert resp.status_code == 302
    assert resp.headers["location"] == "https://your-site.com"


def test_redirect_known_code_records_click_and_redirects(client, fake_sb):
    fake_sb.seed("tracking_links", [{
        "id": 1, "content_id": 7, "platform": "youtube",
        "short_code": "abc123", "destination_url": "https://site.com/x",
        "utm_source": "youtube", "utm_medium": "social", "utm_campaign": "content_7",
        "click_count": 0,
    }])

    resp = client.get("/t/abc123", follow_redirects=False)

    assert resp.status_code == 302
    assert "utm_source=youtube" in resp.headers["location"]
    clicks = fake_sb.store.get("click_events", [])
    assert len(clicks) == 1
    assert clicks[0]["tracking_link_id"] == 1
    assert clicks[0]["content_id"] == 7
    assert clicks[0]["platform"] == "youtube"
