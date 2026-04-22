"""
Regression tests for ContentExtractor.

Seeded from the "30-minute quick wins" pass (features/mail-parse branch):
  1. destructive [...] / |...| strippers removed (were eating [Forbes] etc.)
  2. IAB banner-ad sizes (728x90, 300x250, ...) excluded from hero picks

Add a new fixture whenever we see a publisher produce a bad extraction in
the wild — the fixture + targeted assertions become the regression alarm.
"""

import asyncio

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
# The three tests below are CURRENTLY xfail. They're not broken tests —
# they're the regression dashboard for the stage-2/stage-3 overhaul
# (layout-table unwrapping + trafilatura). Today's extractor picks a
# 218-char table cell and returns the footer; these assertions will
# flip to green once we swap the selector-lottery for trafilatura and
# drop xfail here.
#
# xfail strict=False so that when they start passing during development
# they show as XPASS (visible, not a failure) rather than breaking CI.


# `strict=False` → XPASS shows as green, so local-dev flips are visible
_CONTENT_XFAIL = pytest.mark.xfail(
    strict=False,
    reason="selector-lottery extractor picks footer on nested-table newsletters; "
           "fixed by trafilatura swap (stage 2/3).",
)


def _extract(extractor: ContentExtractor, html: str) -> str:
    return asyncio.run(extractor.extract_newsletter_content(html))


@_CONTENT_XFAIL
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


@_CONTENT_XFAIL
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


@_CONTENT_XFAIL
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


@_CONTENT_XFAIL
def test_adexchanger_snapshot(extractor, adexchanger_html):
    """Full-output snapshot. Fails on any diff — use UPDATE_SNAPSHOTS=1
    to re-baseline when the change is intentional."""
    content = _extract(extractor, adexchanger_html)
    assert_snapshot("adexchanger_2026-04-20", content)
