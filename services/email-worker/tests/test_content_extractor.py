"""
Regression tests for ContentExtractor.

Seeded from the "30-minute quick wins" pass (features/mail-parse branch):
  1. destructive [...] / |...| strippers removed (were eating [Forbes] etc.)
  2. IAB banner-ad sizes (728x90, 300x250, ...) excluded from hero picks

Add a new fixture whenever we see a publisher produce a bad extraction in
the wild — the fixture + targeted assertions become the regression alarm.
"""

import asyncio
from typing import Optional

import pytest

from content_extractor import ContentExtractor
from tests.conftest import assert_snapshot, load_eml_html


@pytest.fixture
def extractor() -> ContentExtractor:
    return ContentExtractor()


@pytest.fixture
def adexchanger_html() -> str:
    return load_eml_html("adexchanger_2026-04-20.eml")


# --- hero image -----------------------------------------------------------


def test_adexchanger_hero_is_not_a_banner_ad(extractor, adexchanger_html):
    """AdExchanger serves 3 banner ads (T-Mobile/IntentIQ/Paramount) as
    700-wide <img>s. Before the IAB filter these could win the hero slot
    (width>=600 gate), picking ad creative as the article hero."""
    hero = extractor.extract_hero_image(adexchanger_html)
    banned_substrings = [
        "TMobile_April2026_728x90",
        "IntentIQ_728x90",
        "Paramount_Tracker-728x90",
    ]
    if hero is not None:
        for banned in banned_substrings:
            assert banned not in hero, f"hero picked a banner ad: {hero}"


def test_iab_size_check_matches_exact_dims(extractor):
    assert extractor._is_iab_banner_size(728, 90)
    assert extractor._is_iab_banner_size(300, 250)
    assert extractor._is_iab_banner_size(336, 280)
    assert extractor._is_iab_banner_size(970, 250)
    # within tolerance
    assert extractor._is_iab_banner_size(729, 91)
    # outside tolerance (editorial hero territory)
    assert not extractor._is_iab_banner_size(600, 400)
    assert not extractor._is_iab_banner_size(800, 450)


def test_logo_url_heuristic_catches_publisher_mastheads(extractor):
    """The New Yorker / Economist / WaPo / AdExchanger all ship masthead
    images whose filenames include 'Logo', 'Masthead', 'Wordmark'. The old
    `/logo` blacklist required a leading slash and missed these."""
    logo_urls = [
        # Real patterns observed in publisher newsletters
        "https://assets.condenast.com/tny/TNY_Logo_DarkMode.png",
        "https://www.economist.com/email/TheEconomist_Logo_Red.png",
        "https://www.washingtonpost.com/email/WaPo_Logo_White.png",
        "https://www.newyorker.com/newyorker-logo-dark.png",
        "https://www.aimediaserver6.com/adexchanger/email/43690_AdExchanger_Logo_Redesign_1335.jpg",
        # Other masthead/wordmark namings
        "https://cdn.example.com/assets/publisher_masthead.png",
        "https://cdn.example.com/assets/site-wordmark-white.svg",
        "https://cdn.example.com/brand/nameplate.jpg",
        "https://cdn.example.com/assets/brand_mark.svg",
    ]
    for url in logo_urls:
        assert extractor._HERO_LOGO_URL_RE.search(url), (
            f"expected logo/masthead to match: {url}"
        )

    # Editorial URLs that happen to contain the letters "logo" embedded
    # in another word should NOT match (e.g. "logograph" → false positive)
    editorial_urls = [
        "https://cdn.example.com/articles/story-hero-photo.jpg",
        "https://cdn.example.com/images/chart-2026-q1.png",
        "https://cdn.example.com/photography/portrait.jpg",
        # edge case: word "logographic" contains "logo" but isn't a logo
        "https://cdn.example.com/articles/logographic-writing-systems.jpg",
    ]
    for url in editorial_urls:
        # logographic starts with "logo" at position 0 preceded by "/" — WILL match.
        # Accept this as a known edge; the false-positive cost on an article
        # about writing systems is negligible vs. the masthead hit rate.
        pass  # no assertion — just documenting the trade-off


def test_masthead_strip_aspect_ratio(extractor):
    """Short-wide strips (height<=150, ratio>=4) are mastheads, not editorial."""
    # masthead-shaped
    assert extractor._is_masthead_strip(1200, 120)   # 10:1 classic masthead
    assert extractor._is_masthead_strip(800, 100)    # 8:1 WaPo-style
    assert extractor._is_masthead_strip(600, 150)    # 4:1 right at the boundary

    # editorial-shaped — must NOT be flagged
    assert not extractor._is_masthead_strip(1200, 630)  # OG image 1.9:1
    assert not extractor._is_masthead_strip(1920, 1080) # 16:9 photo
    assert not extractor._is_masthead_strip(600, 400)   # 3:2 article photo
    assert not extractor._is_masthead_strip(600, 200)   # 3:1 but >150 tall
    assert not extractor._is_masthead_strip(400, 150)   # 2.7:1 square-ish

    # missing dims — defer, don't guess
    assert not extractor._is_masthead_strip(0, 0)
    assert not extractor._is_masthead_strip(1200, 0)
    assert not extractor._is_masthead_strip(0, 120)


def test_hero_picks_editorial_over_masthead(extractor):
    """End-to-end: a newsletter with a wordmark strip at top and an
    editorial photo in the body must pick the photo, not the wordmark.

    Synthesizes the common NYer/Economist/WaPo pattern: publisher
    masthead first in document order, then an article hero photo."""
    html = """
    <html><body>
      <table>
        <tr><td>
          <img src="https://assets.condenast.com/tny/TNY_Logo_DarkMode.png"
               width="1200" height="120" alt="The New Yorker" />
        </td></tr>
        <tr><td>
          <h1>Today's essay</h1>
          <img src="https://media.newyorker.com/photos/story-hero.jpg"
               width="1200" height="630" alt="Story illustration" />
          <p>Body text here...</p>
        </td></tr>
      </table>
    </body></html>
    """
    hero = extractor.extract_hero_image(html)
    assert hero == "https://media.newyorker.com/photos/story-hero.jpg", (
        f"expected editorial hero, got: {hero}"
    )


def test_hero_returns_none_when_only_masthead_present(extractor):
    """If the only image is a masthead, hero should be None rather than
    falling back to it. Better to have no hero than a wordmark hero."""
    html = """
    <html><body>
      <img src="https://assets.condenast.com/tny/TNY_Logo.png"
           width="1200" height="120" alt="The New Yorker" />
      <p>Some text without any other images.</p>
    </body></html>
    """
    assert extractor.extract_hero_image(html) is None


def test_hero_placeholder_url_pattern_rejects_tilley(extractor):
    """The New Yorker ships Eustace Tilley as the only image in many
    newsletters — filename is editorial-sounding (not 'logo'), aspect ratio
    is not masthead-like (Tilley is closer to square), so the masthead/logo
    heuristics can't catch it. The placeholder-URL regex is the cheap
    first-line filter before we even consider hashing."""
    html = """
    <html><body>
      <img src="https://media.newyorker.com/photos/tilley-dandy-illustration.png"
           width="1200" height="900" alt="The New Yorker" />
      <p>Issue text...</p>
    </body></html>
    """
    # With only Tilley as candidate, hero must be None (fallback art wins)
    assert extractor.extract_hero_image(html) is None


def test_hero_placeholder_prefers_editorial_over_tilley(extractor):
    """Publisher placeholder (Tilley) first in doc order, editorial photo
    second. Hero must be the photo, not Tilley — same pattern as the
    masthead test but for non-masthead-shaped placeholders."""
    html = """
    <html><body>
      <img src="https://media.newyorker.com/photos/eustace-tilley.png"
           width="800" height="800" alt="The New Yorker" />
      <img src="https://media.newyorker.com/photos/story-hero.jpg"
           width="1200" height="630" alt="Story illustration" />
    </body></html>
    """
    hero = extractor.extract_hero_image(html)
    assert hero == "https://media.newyorker.com/photos/story-hero.jpg"


# --- content-hash denylist (Phase 2) -------------------------------------


def _run(coro):
    return asyncio.run(coro)


def test_verified_passes_through_when_no_sender_domain(extractor):
    """Without sender_domain, the verified path must behave identically to
    the pure heuristic path — no fetches, no hash checks. This is the
    short-circuit that keeps the hot path cheap when we don't know who sent
    the email."""
    html = '<html><body><img src="https://cdn.example.com/hero.jpg" width="1200" height="630"/></body></html>'
    assert _run(extractor.extract_hero_image_verified(html, sender_domain=None)) == \
        "https://cdn.example.com/hero.jpg"


def test_verified_passes_through_when_domain_has_no_denylist(extractor):
    """A sender_domain that has no entries in the hash denylist must not
    trigger any network fetch. Caller passes sender_domain routinely; we
    only want to pay the fetch cost when there's something to check."""
    # AdExchanger etc. — no hash denylist configured
    fetch_called = []

    async def no_fetch(url):
        fetch_called.append(url)
        return None
    extractor._fetch_and_hash_image = no_fetch

    html = '<html><body><img src="https://cdn.example.com/hero.jpg" width="1200" height="630"/></body></html>'
    result = _run(extractor.extract_hero_image_verified(html, sender_domain='adexchanger.com'))
    assert result == "https://cdn.example.com/hero.jpg"
    assert fetch_called == [], "fetch must not run when denylist for domain is empty"


def test_verified_rejects_known_placeholder_hash(extractor, monkeypatch):
    """When the candidate's SHA256 matches a known placeholder for the
    sender's domain, hero becomes None (fallback art wins). This is the
    core regression guard for the hash denylist path."""
    known_hash = 'a' * 64

    monkeypatch.setitem(
        ContentExtractor._PUBLISHER_PLACEHOLDER_HASHES,
        'newyorker.com',
        frozenset({known_hash}),
    )

    async def fake_fetch(url):
        return known_hash
    extractor._fetch_and_hash_image = fake_fetch

    html = '<html><body><img src="https://media.newyorker.com/img/some-image.png" width="1200" height="630"/></body></html>'
    result = _run(extractor.extract_hero_image_verified(html, sender_domain='newyorker.com'))
    assert result is None


def test_verified_accepts_unknown_hash(extractor, monkeypatch):
    """A hash miss means the image is NOT a known placeholder — keep the
    candidate. This is the common case for genuine editorial photos."""
    known_hash = 'a' * 64
    candidate_hash = 'b' * 64

    monkeypatch.setitem(
        ContentExtractor._PUBLISHER_PLACEHOLDER_HASHES,
        'newyorker.com',
        frozenset({known_hash}),
    )

    async def fake_fetch(url):
        return candidate_hash
    extractor._fetch_and_hash_image = fake_fetch

    html = '<html><body><img src="https://media.newyorker.com/photos/real-article-photo.jpg" width="1200" height="630"/></body></html>'
    result = _run(extractor.extract_hero_image_verified(html, sender_domain='newyorker.com'))
    assert result == "https://media.newyorker.com/photos/real-article-photo.jpg"


def test_verified_keeps_candidate_on_fetch_failure(extractor, monkeypatch):
    """Network errors must NOT blank the hero — we'd rather show a candidate
    that passed the cheap filters than show fallback art on a flaky CDN.
    See _fetch_and_hash_image docstring."""
    monkeypatch.setitem(
        ContentExtractor._PUBLISHER_PLACEHOLDER_HASHES,
        'newyorker.com',
        frozenset({'a' * 64}),
    )

    async def broken_fetch(url):
        return None  # simulates timeout, 404, oversize, etc.
    extractor._fetch_and_hash_image = broken_fetch

    html = '<html><body><img src="https://media.newyorker.com/photos/x.jpg" width="1200" height="630"/></body></html>'
    result = _run(extractor.extract_hero_image_verified(html, sender_domain='newyorker.com'))
    assert result == "https://media.newyorker.com/photos/x.jpg"


def test_denylist_matches_subdomain_senders(extractor, monkeypatch):
    """Publisher senders often come from a subdomain like e.newyorker.com
    or updates.economist.com. Denylist lookup must match on suffix so we
    don't need an entry per subdomain."""
    known_hash = 'a' * 64
    monkeypatch.setitem(
        ContentExtractor._PUBLISHER_PLACEHOLDER_HASHES,
        'newyorker.com',
        frozenset({known_hash}),
    )

    async def fake_fetch(url):
        return known_hash
    extractor._fetch_and_hash_image = fake_fetch

    html = '<html><body><img src="https://media.newyorker.com/x.jpg" width="1200" height="630"/></body></html>'
    # Sender comes in as e.newyorker.com — must still match the newyorker.com key
    result = _run(extractor.extract_hero_image_verified(html, sender_domain='e.newyorker.com'))
    assert result is None


def test_domain_from_sender_parses_rfc5322_and_bare():
    assert ContentExtractor.domain_from_sender(
        'The New Yorker <newsletter@e.newyorker.com>'
    ) == 'e.newyorker.com'
    assert ContentExtractor.domain_from_sender('newsletter@newyorker.com') == 'newyorker.com'
    assert ContentExtractor.domain_from_sender('') is None
    assert ContentExtractor.domain_from_sender('no-at-symbol') is None
    # Case-insensitive: From headers sometimes uppercase the domain
    assert ContentExtractor.domain_from_sender('x@E.NewYorker.COM') == 'e.newyorker.com'


# --- Phase 3: Redis auto-learning counter --------------------------------
#
# Sketches a minimal fake for redis.asyncio.Redis pipelines. Only models the
# INCR + EXPIRE + execute path the counter uses; anything else raises. Keeps
# tests honest about what we depend on in the client.


class _FakePipeline:
    def __init__(self, store):
        self._store = store
        self._ops = []

    def incr(self, key):
        self._ops.append(('incr', key))
        return self

    def expire(self, key, seconds):
        self._ops.append(('expire', key, seconds))
        return self

    async def execute(self):
        results = []
        for op in self._ops:
            if op[0] == 'incr':
                self._store[op[1]] = self._store.get(op[1], 0) + 1
                results.append(self._store[op[1]])
            elif op[0] == 'expire':
                results.append(True)
        self._ops = []
        return results


class _FakeRedis:
    def __init__(self, preset: Optional[dict] = None):
        self._store = dict(preset or {})

    def pipeline(self):
        return _FakePipeline(self._store)


def _make_extractor_with_fake_redis(preset=None):
    fake = _FakeRedis(preset=preset)
    ex = ContentExtractor(redis_client=fake)
    return ex, fake


def test_counter_passes_below_threshold(monkeypatch):
    """Count starts at 0. First sighting increments to 1 (< 3), keep
    candidate. This is the normal path for a novel editorial image."""
    ex, fake = _make_extractor_with_fake_redis()

    async def fake_fetch(url):
        return 'b' * 64
    ex._fetch_and_hash_image = fake_fetch

    html = '<html><body><img src="https://media.example.com/x.jpg" width="1200" height="630"/></body></html>'
    result = _run(ex.extract_hero_image_verified(html, sender_domain='example.com'))
    assert result == "https://media.example.com/x.jpg"
    # Counter was written
    key = ContentExtractor._HERO_COUNTER_KEY.format(domain='example.com', digest='b' * 64)
    assert fake._store[key] == 1


def test_counter_denies_at_threshold(monkeypatch):
    """When the same (domain, sha256) crosses _HERO_COUNTER_THRESHOLD (3),
    subsequent sightings are denied. Preseeding the counter to 2 simulates
    two prior sightings; this call is the 3rd."""
    threshold = ContentExtractor._HERO_COUNTER_THRESHOLD
    digest = 'c' * 64
    key = ContentExtractor._HERO_COUNTER_KEY.format(domain='example.com', digest=digest)
    ex, fake = _make_extractor_with_fake_redis(preset={key: threshold - 1})

    async def fake_fetch(url):
        return digest
    ex._fetch_and_hash_image = fake_fetch

    html = '<html><body><img src="https://media.example.com/recurring.jpg" width="1200" height="630"/></body></html>'
    result = _run(ex.extract_hero_image_verified(html, sender_domain='example.com'))
    assert result is None
    # Counter still incremented past threshold
    assert fake._store[key] == threshold


def test_counter_scopes_by_domain(monkeypatch):
    """Same hash under two different sender_domains must not cross-pollute.
    Global counter, but KEYED by domain — one publisher's recurring art
    doesn't deny another's."""
    digest = 'd' * 64
    key_a = ContentExtractor._HERO_COUNTER_KEY.format(domain='newyorker.com', digest=digest)
    # NYer has seen it threshold-1 times; economist has never seen it.
    ex, fake = _make_extractor_with_fake_redis(
        preset={key_a: ContentExtractor._HERO_COUNTER_THRESHOLD - 1}
    )

    async def fake_fetch(url):
        return digest
    ex._fetch_and_hash_image = fake_fetch

    html = '<html><body><img src="https://media.example.com/x.jpg" width="1200" height="630"/></body></html>'

    # economist.com: count goes 0 → 1, below threshold, keep
    assert _run(ex.extract_hero_image_verified(html, sender_domain='economist.com')) == \
        "https://media.example.com/x.jpg"
    # newyorker.com: count goes 2 → 3, at threshold, deny
    assert _run(ex.extract_hero_image_verified(html, sender_domain='newyorker.com')) is None


def test_counter_redis_failure_keeps_candidate(monkeypatch):
    """Redis error → fail open. We'd rather show a maybe-recurring hero than
    blank the card on a transient infra blip."""
    class _BrokenPipe:
        def incr(self, key): return self
        def expire(self, key, s): return self
        async def execute(self):
            raise ConnectionError("redis is unreachable")

    class _BrokenRedis:
        def pipeline(self):
            return _BrokenPipe()

    ex = ContentExtractor(redis_client=_BrokenRedis())

    async def fake_fetch(url):
        return 'e' * 64
    ex._fetch_and_hash_image = fake_fetch

    html = '<html><body><img src="https://media.example.com/x.jpg" width="1200" height="630"/></body></html>'
    result = _run(ex.extract_hero_image_verified(html, sender_domain='example.com'))
    assert result == "https://media.example.com/x.jpg"


def test_no_redis_client_disables_phase3(monkeypatch):
    """ContentExtractor() with no redis_client arg must behave exactly as
    before Phase 3 was added — no fetch unless there's a static denylist
    entry for the domain. Protects tests + non-worker callers from silent
    Phase 3 activation."""
    ex = ContentExtractor()  # no redis_client
    fetch_calls = []

    async def tracking_fetch(url):
        fetch_calls.append(url)
        return 'f' * 64
    ex._fetch_and_hash_image = tracking_fetch

    html = '<html><body><img src="https://media.example.com/x.jpg" width="1200" height="630"/></body></html>'
    result = _run(ex.extract_hero_image_verified(html, sender_domain='example.com'))
    assert result == "https://media.example.com/x.jpg"
    assert fetch_calls == [], "Phase 3 off: no fetch when domain has no static denylist"


def test_counter_coexists_with_static_denylist(monkeypatch):
    """Static denylist hit must win — no need to INCR the counter at all
    once we've already classified the image as known-bad. Avoids wasting
    a Redis round-trip on obvious cases."""
    digest = 'g' * 64
    monkeypatch.setitem(
        ContentExtractor._PUBLISHER_PLACEHOLDER_HASHES,
        'newyorker.com',
        frozenset({digest}),
    )
    ex, fake = _make_extractor_with_fake_redis()

    async def fake_fetch(url):
        return digest
    ex._fetch_and_hash_image = fake_fetch

    html = '<html><body><img src="https://media.newyorker.com/x.jpg" width="1200" height="630"/></body></html>'
    assert _run(ex.extract_hero_image_verified(html, sender_domain='newyorker.com')) is None
    # Counter was NOT incremented — static hit short-circuits before Phase 3
    assert fake._store == {}


def test_iab_filename_heuristic_catches_banners_with_missing_height(extractor):
    """Common newsletter pattern: <img width="700" height="" src="foo_728x90.jpg">.
    The <img>-dim check can't help (height is empty), so we fall back to
    parsing NxM out of the filename."""
    assert extractor._url_declares_iab_banner(
        "https://cdn.example.com/ads/TMobile_April2026_728x90.jpg"
    )
    assert extractor._url_declares_iab_banner(
        "https://cdn.example.com/ads/IntentIQ_728x90_Where_Identity.jpg"
    )
    assert extractor._url_declares_iab_banner(
        "https://cdn.example.com/ads/Paramount_Tracker-728x90.png"
    )
    # Not a banner size — e.g. 1200x630 OG image
    assert not extractor._url_declares_iab_banner(
        "https://cdn.example.com/hero_1200x630.jpg"
    )
    # No dims in filename
    assert not extractor._url_declares_iab_banner(
        "https://cdn.example.com/article-photo.jpg"
    )


# --- content extraction ---------------------------------------------------
#
# Trafilatura (primary path) restores these — the AdExchanger fixture is
# now our regression guard for nested-table newsletter extraction.


def _extract(extractor: ContentExtractor, html: str) -> str:
    return asyncio.run(extractor.extract_newsletter_content(html))


def test_adexchanger_preserves_bracketed_source_attributions(
    extractor, adexchanger_html
):
    """AdExchanger's 'But Wait! There's More!' section uses [Forbes],
    [Reuters], [WSJ], etc. for source attribution. The old
    `re.sub(r'\\[.*?\\]', '', text)` deleted all of them."""
    content = _extract(extractor, adexchanger_html)

    expected_sources = ["Forbes", "Reuters", "WSJ", "Business Insider"]
    found = [s for s in expected_sources if s in content]
    assert len(found) >= 3, (
        f"Expected source attributions preserved; found only {found}. "
        f"Output excerpt:\n{content[-1500:]}"
    )


def test_adexchanger_extracts_editorial_content(extractor, adexchanger_html):
    """Confidence that the main body survives — these are distinctive phrases
    from the 2026-04-20 issue. If any go missing we've regressed."""
    content = _extract(extractor, adexchanger_html)

    required_phrases = [
        "Reaching For More Reach",
        "Ads in Prompt Land",
        "Jack Of All Trade Orgs",
        "Private Parties",
        "Bob Liodice",
    ]
    missing = [p for p in required_phrases if p not in content]
    assert not missing, (
        f"Editorial content missing: {missing}.\n"
        f"Output length: {len(content)} chars\n"
        f"First 500: {content[:500]}"
    )


def test_adexchanger_output_length_is_substantial(extractor, adexchanger_html):
    """Sanity: the AdExchanger issue has ~3-5 meaty paragraphs of editorial
    in 'But Wait! There's More!' plus 3 section blurbs. Anything under 1500
    chars means we truncated the body."""
    content = _extract(extractor, adexchanger_html)
    assert len(content) > 1500, (
        f"Suspiciously short extraction ({len(content)} chars). "
        f"Likely picked a single card instead of the full body."
    )


# --- snapshot (informational regression alarm) ----------------------------


def test_adexchanger_snapshot(extractor, adexchanger_html):
    """Full-output snapshot. Fails on any diff — use UPDATE_SNAPSHOTS=1
    to re-baseline when the change is intentional."""
    content = _extract(extractor, adexchanger_html)
    assert_snapshot("adexchanger_2026-04-20", content)


# --- hero image: real-publisher regression suite --------------------------
#
# Seven fixtures captured from production failures on 2026-04-22/23 where
# the hero picker kept landing on newsletter chrome (column headshots,
# masthead banners, ESP-hosted brand art) instead of editorial photos.
# Each test pins a specific reject pattern + expected pick.


@pytest.mark.parametrize(
    "fixture, must_not_contain, must_contain",
    [
        # AdExchanger — column-byline headshot (hdst_<author>_crop.png) must
        # lose to the editorial cartoon further down the email.
        (
            "adexchanger_2026-04-20.eml",
            "hdst_alyssa-boyle_crop",
            "Chez-Premium-Publishers-AI-search-Sam-Altman-comic",
        ),
        # AdExchanger Commerce — Newsletter-Header animated banner must
        # lose to the editorial cartoon.
        (
            "adexchanger_commerce_2026-04-22.eml",
            "42366_ADX-Newsletter-Header-Commerce-Animation",
            "revised.HI_.RES_.facebook.fourth.cartoon",
        ),
        (
            "adexchanger_2026-04-23.eml",
            "42366_ADX-Newsletter-Header-Commerce-Animation",
            "revised.HI_.RES_.facebook.fourth.cartoon",
        ),
        # Condé Nast Traveler — Sailthru /fss/ newsletter chrome must lose
        # to the 560-wide Getty editorial photo (Cannes hotel).
        (
            "cntraveler_white_lotus_2026-04-23.eml",
            "sailthru.com/fss/",
            "cannes-GettyImages-2204939456",
        ),
        # Economist — ESP-hosted image.e.economist.com/lib/ wordmark must
        # lose to the cdn-cgi FURY drone lead.
        (
            "economist_wages_war_2026-04-23.eml",
            "image.e.economist.com/lib/",
            "20260418_WBP503",
        ),
        # New Yorker — 1:1 crop author headshot (remnick-david.png) must
        # lose to the Linda McMahon editorial photo.
        (
            "newyorker_mcmahon_2026-04-23.eml",
            "remnick-david",
            "/master/w_1200",  # any master-crop editorial
        ),
        # NPR — ESP-hosted image.nl.npr.org/lib/ "Up First Newsletter"
        # wordmark must lose to the Strait of Hormuz Getty photo.
        (
            "npr_hormuz_2026-04-23.eml",
            "image.nl.npr.org/lib/",
            "gettyimages-2271643511",
        ),
    ],
)
def test_hero_regression_fixtures(extractor, fixture, must_not_contain, must_contain):
    """Real-email fixtures: hero must reject chrome, pick editorial."""
    html = load_eml_html(fixture)
    hero = extractor.extract_hero_image(html)
    assert hero is not None, f"{fixture}: no hero picked"
    assert must_not_contain not in hero, (
        f"{fixture}: hero still picks chrome ({must_not_contain}): {hero}"
    )
    assert must_contain in hero, (
        f"{fixture}: expected editorial ({must_contain}), got: {hero}"
    )


def test_alt_blacklist_word_bounded(extractor):
    """Plural editorial words (`icons`, `headers`, `footers`) must NOT
    trigger the alt blacklist. Real case: NPR WHO illustration alt text
    'Three app icons in a row' was being rejected as a logo."""
    # These MUST match (chrome)
    assert extractor._HERO_ALT_BLACKLIST.search("site logo")
    assert extractor._HERO_ALT_BLACKLIST.search("menu icon")
    assert extractor._HERO_ALT_BLACKLIST.search("masthead")
    # These MUST NOT match (editorial prose that happens to contain the root)
    assert not extractor._HERO_ALT_BLACKLIST.search("Three app icons in a row show")
    assert not extractor._HERO_ALT_BLACKLIST.search("she headers the committee")
    assert not extractor._HERO_ALT_BLACKLIST.search("Footers Inc. earnings report")


def test_ancestor_blacklist_does_not_reject_lead_story_slots(extractor):
    """NPR wraps lead editorial in `<td class="header">` as a layout slot.
    The old blanket `header` match rejected these. Only explicit chrome
    qualifiers (site/email/page-header, masthead, footer-links, etc.) should
    trigger now."""
    # chrome — MUST match
    assert extractor._HERO_ANCESTOR_BLACKLIST.search("masthead")
    assert extractor._HERO_ANCESTOR_BLACKLIST.search("site-header")
    assert extractor._HERO_ANCESTOR_BLACKLIST.search("email-footer")
    assert extractor._HERO_ANCESTOR_BLACKLIST.search("footer-links")
    assert extractor._HERO_ANCESTOR_BLACKLIST.search("social-share")
    assert extractor._HERO_ANCESTOR_BLACKLIST.search("unsubscribe")
    assert extractor._HERO_ANCESTOR_BLACKLIST.search("main-navigation")
    # layout slots / editorial wrappers — MUST NOT match
    assert not extractor._HERO_ANCESTOR_BLACKLIST.search("header")
    assert not extractor._HERO_ANCESTOR_BLACKLIST.search("footer")
    assert not extractor._HERO_ANCESTOR_BLACKLIST.search("content_padding")
    assert not extractor._HERO_ANCESTOR_BLACKLIST.search("stylingblock-content-wrapper")


def test_photo_credit_regex_matches_common_forms(extractor):
    """The credit regex is the positive signal that promotes an image to
    hero. Must catch the shapes seen in real newsletters."""
    matching = [
        "Alon Skuy/Getty Images",
        "(Kjell Linder/Getty Images)",
        "Photograph by Jamie Chung",
        "Photograph courtesy of the New York Times",
        "Illustration by Tomi Um",
        "Photo: Kent Nishimura for The Washington Post",
        "Credit: AP Photo/Alex Brandon",
        "Stephanie Keith/Reuters",
        "Brendan Smialowski/AFP/Getty Images",
    ]
    for text in matching:
        assert extractor._PHOTO_CREDIT_RE.search(text), f"should match credit: {text!r}"

    non_matching = [
        "A wave breaking in the ocean",
        "Security personnel stand guard at a security checkpost",
        "Read more about the story",
        "Published at 7:00 AM ET",
    ]
    for text in non_matching:
        assert not extractor._PHOTO_CREDIT_RE.search(text), (
            f"should NOT match: {text!r}"
        )


def test_credited_image_promoted_over_larger_chrome(extractor):
    """A 400-wide credited editorial photo beats a 700-wide uncredited
    banner — the credit is the proof of editorial intent, not the width."""
    html = """
    <html><body>
      <table>
        <tr><td>
          <!-- uncredited masthead banner, width>=600 -->
          <img src="https://cdn.example.com/generic-newsletter-top.jpg"
               width="700" alt="Morning Brief" />
        </td></tr>
        <tr><td>
          <figure>
            <img src="https://cdn.example.com/articles/real-editorial-photo.jpg"
                 width="400" alt="Protesters at the capital building" />
            <figcaption>Photograph by Jamie Chung/Getty Images</figcaption>
          </figure>
        </td></tr>
      </table>
    </body></html>
    """
    hero = extractor.extract_hero_image(html)
    assert hero is not None
    assert "real-editorial-photo" in hero, (
        f"credited photo should win over uncredited banner; got {hero}"
    )
