"""
Content Extractor for Email Worker Service

Handles email content extraction and preprocessing.
Extracted from server/gmail.ts with Python implementation using BeautifulSoup.
"""

import re
import asyncio
import hashlib
import aiohttp
from typing import Dict, FrozenSet, List, Optional
from bs4 import BeautifulSoup, Comment
import html2text
import trafilatura

class ContentExtractor:
    """Email content extraction and cleaning"""

    def __init__(self, redis_client=None):
        """
        Args:
            redis_client: optional async redis client (redis.asyncio.Redis).
                When provided, enables Phase 3 auto-learning — every hero
                candidate's (sender_domain, sha256) pair increments a counter,
                and candidates seen `_HERO_COUNTER_THRESHOLD`+ times get
                auto-denied. When None, Phase 3 is off (used by tests + any
                caller that can't reach Redis).
        """
        self._redis = redis_client
        self.html2text_converter = html2text.HTML2Text()
        self.html2text_converter.ignore_links = True
        self.html2text_converter.ignore_images = True
        self.html2text_converter.ignore_emphasis = True
        self.html2text_converter.body_width = 0  # No line wrapping
    
    async def extract_newsletter_content(self, raw_content: str) -> str:
        """
        Extract clean newsletter content from raw email HTML/text
        Extracted from server/gmail.ts extractNewsletterContent function
        """
        if not raw_content:
            return ''

        # If it's already plain text, return with basic cleanup
        if not self._contains_html(raw_content):
            return self._clean_text_content(raw_content)

        try:
            # Load HTML content with BeautifulSoup
            soup = BeautifulSoup(raw_content, 'html.parser')

            # Try the "view online" link first — only reads the soup, does not mutate it.
            # (Must come before _extract_from_email_html, which decomposes cruft links
            # including "View in browser" anchors, making them unfindable afterwards.)
            online_content = await self._try_extract_from_online_version(soup)

            # PRIMARY: trafilatura. Handles nested-table layouts, boilerplate
            # detection, and section preservation that the selector-lottery
            # below can't touch. Returns clean markdown with links intact.
            email_html_content = self._extract_with_trafilatura(raw_content)

            # FALLBACK: legacy selector-based extraction. Kept as a safety net
            # for emails where trafilatura returns nothing (plain-text-only
            # payloads, highly irregular HTML). Expected to fire rarely.
            if not email_html_content or len(email_html_content) < 500:
                print(
                    f"⚠️  trafilatura output too short "
                    f"({len(email_html_content) if email_html_content else 0} chars), "
                    f"falling back to legacy selector extraction"
                )
                email_html_content = await self._extract_from_email_html(soup, raw_content)

            # Accept the online version only when it's meaningfully richer.
            # Many ESPs serve browser-view portals that return only footer boilerplate
            # (e.g. omeclk.com for AdExchanger) — in those cases the email HTML wins.
            if online_content and len(online_content) > max(len(email_html_content) * 1.2, 300):
                print(f"✅ Using online version ({len(online_content)} chars vs email HTML {len(email_html_content)} chars)")
                return online_content

            if online_content:
                print(f"⚠️  Online version ({len(online_content)} chars) not richer than email HTML ({len(email_html_content)} chars) — using email HTML")

            return email_html_content

        except Exception as e:
            print(f"⚠️  Error parsing HTML content, falling back to raw content: {e}")
            # Fallback to basic text cleanup if HTML parsing fails
            return self._clean_text_content(self._strip_html_tags(raw_content))
    
    def _contains_html(self, content: str) -> bool:
        """Check if content contains HTML tags"""
        return '<html' in content.lower() or '<HTML' in content or bool(re.search(r'<[^>]+>', content))
    
    # ESP browser-view and click-tracking URL patterns.
    # These portal/redirect URLs serve minimal wrapper pages, never the newsletter's
    # editorial content. Matched before fetching so we skip the HTTP round-trip.
    _ONLINE_VERSION_URL_BLACKLIST = re.compile(
        r'(omeclk\.com|mailchimp\.com.*/track|list-manage\.com'
        r'|exacttarget\.com|mktdns\.com'
        r'|constantcontact\.com|myemma\.com|campaignmonitor\.com'
        r'|ViewCommInBrowser|InBrowser\.jsp)',
        re.I,
    )

    async def _try_extract_from_online_version(self, soup: BeautifulSoup) -> Optional[str]:
        """
        Try to find "view online" links and scrape better content
        Extracted from server/gmail.ts tryExtractFromOnlineVersion function
        """
        try:
            # Common patterns for "view online" links
            online_patterns = [
                'a[href*="view"]:contains("online")',
                'a[href*="browser"]:contains("view")',
                'a[href*="web"]:contains("view")',
                'a:contains("View in browser")',
                'a:contains("Read online")',
                'a:contains("Open in browser")',
                'a:contains("View this email in your browser")',
                'a:contains("Having trouble viewing")',
                'a[href*="newsletter"]:contains("view")',
                'a[href*="email"]:contains("view")'
            ]
            
            online_url = None
            
            # Look for view online links
            for link in soup.find_all('a', href=True):
                link_text = link.get_text(strip=True).lower()
                href = link.get('href', '')
                
                if any(pattern in link_text for pattern in ['view', 'browser', 'online']) and \
                   any(url_pattern in href for url_pattern in ['view', 'browser', 'web', 'newsletter', 'email']):
                    if href.startswith(('http', 'https')):
                        online_url = href
                        print(f"🔗 Found online version link: {online_url}")
                        break
            
            if not online_url:
                return None

            # Skip known ESP tracking/browser-view portals — they return footer-only pages.
            if self._ONLINE_VERSION_URL_BLACKLIST.search(online_url):
                print(f"⚠️  Skipping online version (tracking/redirect portal): {online_url[:80]}")
                return None

            # Fetch and extract content from online version with timeout
            try:
                timeout = aiohttp.ClientTimeout(total=10)  # 10 second timeout
                headers = {
                    'User-Agent': 'Mozilla/5.0 (compatible; SubsBuzz/2.0; +https://subsbuzz.com)',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
                
                async with aiohttp.ClientSession(timeout=timeout) as session:
                    async with session.get(online_url, headers=headers) as response:
                        if response.status != 200:
                            return None
                        
                        html = await response.text()
                        online_soup = BeautifulSoup(html, 'html.parser')
                        
                        # Extract content from the online version
                        return await self._extract_from_email_html(online_soup, html)
                        
            except Exception as e:
                print(f"⚠️  Failed to extract from online version: {e}")
                return None
                
        except Exception as e:
            print(f"⚠️  Error in _try_extract_from_online_version: {e}")
            return None
    
    # Known-boilerplate signals that mark the start of the footer region in
    # trafilatura-extracted markdown. Everything after the first match is
    # legal/footer/tracking noise, not editorial content. Order doesn't matter
    # — we cut at the earliest match.
    _MARKDOWN_FOOTER_CUTOFF = re.compile(
        r'\n\s*(?:'
        r'\[?View (?:this\s+email\s+)?in\s+(?:your\s+)?(?:web\s+)?browser\]?'
        r'|This (?:message|email)\s+was\s+sent\s+to'
        r'|You\s+received\s+this'
        r'|To\s+(?:ensure\s+delivery|unsubscribe)'
        r')',
        re.IGNORECASE,
    )

    def _extract_with_trafilatura(self, raw_content: str) -> Optional[str]:
        """Run trafilatura against the raw email HTML. Returns None on
        failure or when the extracted body is too short to trust — callers
        should fall back to the legacy selector-based extractor in that case.

        Config rationale:
          - output_format='markdown' preserves headings, bylines, link text
            + URLs so the downstream LLM can see section boundaries.
          - favor_recall=True biases toward keeping borderline content. For
            newsletters, losing signal is worse than including a bit of noise.
          - include_tables=False kills the nested layout-table prefix that
            dominates the top of table-based newsletters (AdExchanger-style).
          - include_images=False — hero extraction is handled separately by
            extract_hero_image(), which has its own filter pipeline.
          - include_comments=False — blog-style comment sections aren't
            present in emails but would leak through on online-version pages.
        """
        try:
            extracted = trafilatura.extract(
                raw_content,
                output_format='markdown',
                favor_recall=True,
                include_links=True,
                include_tables=False,
                include_comments=False,
                include_images=False,
            )
        except Exception as e:
            print(f"⚠️  trafilatura extraction failed: {e}")
            return None

        if not extracted or len(extracted) < 200:
            print(
                f"⚠️  trafilatura returned too little content "
                f"({len(extracted) if extracted else 0} chars, threshold 200) — yielding to fallback"
            )
            return None

        return self._clean_markdown_content(extracted)

    def _clean_markdown_content(self, text: str) -> str:
        """Post-process trafilatura markdown output.

        Distinct from _clean_text_content, which collapses all whitespace
        (incl. newlines) — that would destroy paragraph structure in
        markdown. Here we preserve blank-line separators.
        """
        if not text:
            return ''

        # Strip CSS blocks that occasionally survive HTML parsing (seen on
        # Substack online-view pages where <style> leaks as text).
        text = re.sub(
            r'@(media|font-face|keyframes|supports|import|charset)[^{]*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}',
            '',
            text,
            flags=re.DOTALL,
        )

        # Truncate at the first footer-boilerplate signal. Everything after
        # is "view in browser / sent to / unsubscribe / privacy policy" noise.
        m = self._MARKDOWN_FOOTER_CUTOFF.search(text)
        if m:
            text = text[:m.start()]

        # Normalise: strip per-line trailing whitespace, collapse 3+ blank
        # lines to 2, trim overall.
        text = '\n'.join(line.rstrip() for line in text.split('\n'))
        text = re.sub(r'\n{3,}', '\n\n', text)
        return text.strip()

    async def _extract_from_email_html(self, soup: BeautifulSoup, raw_content: str) -> str:
        """
        Advanced email HTML content extraction
        Extracted from server/gmail.ts extractFromEmailHTML function
        """
        # Step 0: Re-parse with <style>/<script> stripped at the string level.
        # html.parser occasionally preserves <style> text as siblings on Substack's
        # online-view pages (CSS-in-JS / inline-styled pullquote blocks), causing
        # @media { ... } blocks to leak into the final text. Strip before parsing.
        stripped = re.sub(
            r'<(style|script|noscript)\b[^>]*>.*?</\1\s*>',
            '',
            raw_content,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if stripped != raw_content:
            try:
                soup = BeautifulSoup(stripped, 'html.parser')
            except Exception:
                pass  # keep the caller's soup

        # Step 1: Aggressively remove all non-content elements
        for element in soup(['script', 'style', 'noscript', 'meta', 'link']):
            element.decompose()
        
        # Remove tracking pixels
        for img in soup.find_all('img'):
            width = img.get('width', '')
            height = img.get('height', '')
            if width == '1' or height == '1':
                img.decompose()
        
        # Remove hidden elements
        for element in soup.find_all(style=re.compile(r'display\s*:\s*none|visibility\s*:\s*hidden')):
            element.decompose()
        
        # Remove tracking and cruft classes
        cruft_selectors = [
            'unsubscribe', 'footer', 'social-links', 'header-logo', 'nav', 'navigation',
            'sidebar', 'advertisement', 'ad', 'promo', 'sponsor', 'banner', 'tracking',
            'pixel', 'beacon'
        ]
        
        for selector in cruft_selectors:
            for element in soup.find_all(class_=re.compile(selector, re.I)):
                element.decompose()
            for element in soup.find_all(id=re.compile(selector, re.I)):
                element.decompose()
        
        # Step 2: Remove elements with cruft text content
        cruft_texts = [
            'unsubscribe', 'manage preferences', 'view in browser', 'forward to a friend',
            'add to address book', 'whitelist', 'privacy policy', 'terms', 'contact us',
            'follow us', 'like us', 'tweet', 'share', 'facebook', 'twitter', 'linkedin',
            'instagram', 'youtube', 'update preferences', 'email preferences'
        ]
        
        for link in soup.find_all('a'):
            link_text = link.get_text(strip=True).lower()
            if any(cruft in link_text for cruft in cruft_texts):
                # Remove the parent element to get rid of surrounding structure
                parent = link.parent
                if parent:
                    parent.decompose()
                else:
                    link.decompose()
        
        # Step 3: Target main content areas
        main_content = None
        
        # Content selectors in order of preference
        content_selectors = [
            # Newsletter-specific selectors (high priority)
            '[role="article"]', 'article', '.article-content', '.newsletter-content',
            '.email-content', '.main-content', '.content-wrapper', '.email-body',
            
            # Generic content selectors
            '.content', '.main', '.body', '.wrapper .content',
            '[role="main"]', 'main', '#content', '#main',
            
            # Table-based newsletters
            'table[role="presentation"] td',
            'table td[style*="padding"]',
            'table.email-container td', 'table.newsletter td',
            'table[width] td',
            
            # Container patterns
            '.container .content', '.email-container .content',
            '.newsletter-container', '.email-wrapper .content'
        ]
        
        for selector in content_selectors:
            try:
                elements = soup.select(selector)
                for element in elements:
                    text = element.get_text(strip=True)
                    # More lenient content requirements
                    if len(text) > 100 and len(text.split()) > 15:
                        main_content = element
                        print(f"✅ Found content using selector: {selector} ({len(text)} chars)")
                        break
                
                if main_content:
                    break
                    
            except Exception as e:
                continue
        
        # Step 4: Fallback with body cleaning
        if not main_content and soup.body:
            # Remove non-content elements from body
            body_cleaners = [
                'header', 'footer', 'nav', 'aside', '.sidebar', '.nav', '.navigation',
                '.header', '.footer', '.social', '.share', '.follow', '.ad', '.advertisement',
                '.unsubscribe', '.preferences', '.manage', '.contact', '.about'
            ]
            
            for selector in body_cleaners:
                for element in soup.body.select(selector):
                    element.decompose()
            
            main_content = soup.body
        
        # Step 5: Final fallback
        if not main_content:
            main_content = soup
        
        # Step 6: Convert to clean text
        if main_content:
            html_content = str(main_content)
        else:
            html_content = raw_content
        
        # Use html2text for conversion
        clean_text = self.html2text_converter.handle(html_content)
        final_content = self._clean_text_content(clean_text)
        
        # If extracted content is too short, fall back to basic text extraction
        if len(final_content) < 200:
            print(
                f"⚠️  Legacy selector extraction too short "
                f"({len(final_content)} chars, threshold 200) — falling back to raw HTML strip"
            )
            basic_text = self._clean_text_content(self._strip_html_tags(raw_content))
            # Only use basic text if it's significantly longer
            return basic_text if len(basic_text) > (len(final_content) * 1.5) else final_content
        
        return final_content
    
    # URL patterns that strongly imply tracking pixels, logos, icons, spacers, masthead crap
    _HERO_URL_BLACKLIST = re.compile(
        r'(pixel|tracking|beacon|open\.gif|spacer|transparent'
        r'|1x1|analytics|googletagmanager|doubleclick'
        r'|/logo|/avatar|/icon|/unsub|/footer'
        # Publisher-branded email-banner assets (e.g. NYT-Alert-Header-Desktop-Black2.png)
        r'|/email-images/[^?]*-(header|alert|banner|promo)-'
        # Publisher tracker-redirect domains (link.<publisher>.com/img/ wrappers)
        r'|link\.(cntraveler|wired|newyorker|vogue|vanityfair|gq|bonappetit|architecturaldigest|self|glamour|epicurious|teenvogue|allure|pitchfork|them|arstechnica)\.com/img/'
        # LiveIntent impression beacons (any subdomain)
        r'|liveintent\.'
        # "Subscriber link insertion" tracker subdomains — sli.<publisher>.com
        # serves invisible 1x1 pixels with the recipient's email in the query
        # string (e.g. sli.washingtonpost.com/imp?s=…&e=user@…). Not editorial.
        r'|sli\.[a-z0-9-]+\.com'
        # Generic /imp? tracker endpoint regardless of query params. Earlier
        # version required li= which missed WaPo's s=…&e=… shape (TEEPER-206).
        r'|/imp\?'
        # Publisher-hosted newsletter banner art — path-segmented so editorial
        # under /newsletters/<slug>/<file>.jpg still passes. Caught The Drum
        # (thedrum-static.imgix.net/newsletters/banners/newsletter_*.png) on
        # the 2026-05-01 audit; pattern is generic enough for analogous
        # publishers serving nameplate/promo chrome from the same path.
        r'|/newsletters/banners/'
        # Sailthru newsletter-chrome paths: /fss/ = header brand assets,
        # /composer/ = newsletter promo/house-ad banner units. Editorial
        # images are always hosted on the publisher's own CDN, never these.
        r'|sailthru\.com/(?:fss|composer)/'
        # ESP-hosted newsletter chrome on NPR + Economist transactional domains.
        # Editorial images live on brightspotcdn.com (NPR) or economist.com/cdn-cgi
        # (Economist). Anything on image.<mail-subdomain>.<publisher>/lib/ is
        # the ESP-hosted header/nameplate/section-divider art we don't want.
        r'|image\.(?:nl|e)\.(?:npr|economist)\.(?:org|com)/lib/'
        # Economist ad-server + pixel-tracking subdomain
        r'|pas\.economist\.com'
        # Movable Ink dynamic-content beacons (movable-ink-1505.com, -1234.com, …)
        r'|movable-ink-\d+\.'
        # Stock email-tracking pixel domains
        r'|emltrk\.com'
        r'|bounceexchange\.com/tag/'
        r'|pippio\.com/api/sync'
        r'|rs-stripe\.npr\.org/stripe/image'
        # Condé Nast CDN square crops (1:1 ratio path segment) = author
        # headshots / column bylines, not editorial heroes. The same CDN
        # serves legit editorial at 3:2, 16:9, 4:3, master — those pass.
        r'|media\.(?:newyorker|cntraveler|wired|vogue|vanityfair|gq|bonappetit|architecturaldigest|self|glamour|epicurious|teenvogue|allure|pitchfork|them|arstechnica)\.com/photos/[^/]+/1:1/)',
        re.I,
    )
    # Alt-text hints the image is NOT a hero. Word-bounded so compound
    # editorial alt text ("app icons in a row", "cherry lemon slot machine")
    # doesn't trigger on the substring `icon`; likewise `headers`, `footers`,
    # `spacers` are legitimate editorial language that shouldn't match.
    _HERO_ALT_BLACKLIST = re.compile(
        r'\b(logo|icon|avatar|unsubscribe|masthead|footer|header|spacer)\b',
        re.I,
    )
    # Ancestor class/id patterns that unambiguously indicate chrome regions.
    # Plain `header`/`footer` used to live here but caused false positives
    # in table-based newsletters that use `<td class="header">` as a layout
    # slot wrapping lead editorial (seen on NPR Up First). Require a
    # compound-qualifier word (site/email/page) OR a chrome-specific suffix
    # (-links, -nav, -icons, -share). Tag-name check for <header>/<footer>/
    # <nav> still fires separately in the ancestor walk.
    _HERO_ANCESTOR_BLACKLIST = re.compile(
        r'(?:^|[\s_\-])(?:'
        r'masthead'
        r'|(?:site|email|page)[-_]?(?:header|footer)'
        r'|footer[-_]?(?:links|nav)'
        r'|social[-_]?(?:links|share|icons|nav)'
        r'|unsubscribe'
        r'|(?:main[-_]?)?nav(?:igation)?'
        r')(?:[\s_\-]|$)',
        re.I,
    )

    # Publisher logos / mastheads / wordmarks — catches NYer's TNY_Logo_*,
    # Economist's TheEconomist_Logo_Red, WaPo's WaPo_Logo_*, AdExchanger's
    # 43690_AdExchanger_Logo_Redesign_*, etc. The existing _HERO_URL_BLACKLIST
    # only matched `/logo` as a path segment — this catches the word as a
    # filename segment too. Boundaries are non-letter chars (so underscores,
    # hyphens, dots, slashes, end-of-string all work). Deliberately doesn't
    # match camelCase boundaries (StratecheryLogo) — acceptable miss.
    _HERO_LOGO_URL_RE = re.compile(
        r'(?:^|[^A-Za-z])'
        r'(?:logo|masthead|wordmark|nameplate|'
        r'brand[_-]?mark|publisher[_-]?logo|newsletter[_-]?logo)'
        r'(?:[^A-Za-z]|$)',
        re.I,
    )

    # Publisher "placeholder hero" URL patterns — specific illustrations/brand
    # marks that get recycled as the only image in many emails but don't trip
    # the generic logo/masthead filters because their filenames are editorial-
    # sounding (NYer's "tilley", Economist's "kal" cartoon, etc.).
    #
    # Prefer this over the hash denylist when the URL is stable and
    # characteristic — it's a pure string check, zero network cost.
    _HERO_PLACEHOLDER_URL_RE = re.compile(
        r'('
        # The New Yorker — Eustace Tilley character, the recurring brand
        # illustration that fronts many NYer newsletters. Matches filenames
        # and path segments like `tilley`, `eustace`, `monocle-man`.
        r'tilley|eustace'
        # NYer additional chrome: flagship daily header banner,
        # cropped footer nameplate, and Sailthru "NL_Unit" promo slots.
        r'|flagship[-_]?daily[-_]?header'
        r'|footer[-_]?tny'
        r'|TNY[_-]?NL[_-]?Unit'
        # AdExchanger newsletter chrome: `ADX-Newsletter-Header-*.gif`
        # banners, section-icon filenames (NewsRoundup, TheBigStory,
        # TalksIcon, Big-Story-podcast-square), and `hdst_<author>_crop.png`
        # column-byline headshots. `ADX-Optimizing_the_News_logo` is caught
        # by the generic logo regex already — kept here for clarity when
        # ADX reuses the prefix on other section assets.
        r'|Newsletter[-_]?Header'
        r'|NewsRoundup'
        r'|TheBigStory'
        r'|Big[-_]?Story[-_]?podcast'
        r'|TalksIcon'
        r'|(?:^|/)hdst_'
        r')',
        re.I,
    )

    # Photo/illustration credit signatures, matched against text NEAR each
    # candidate <img>. The presence of a credit line is a strong positive
    # signal that the image is editorial — mastheads, house-ad banners,
    # section icons, and tracking pixels never carry credits.
    #
    # Patterns (all case-insensitive):
    #   - "Photo/Illustration/Photograph by X"
    #   - "Photo: X" / "Credit: X"
    #   - "Photo courtesy of X"
    #   - "(Firstname Lastname/Getty Images)" — the parenthesised slash-form
    #     common to Axios, NYer sidebar photos, Condé Nast.
    #   - Bare "Name/Getty Images" / "Name/Reuters" / "Name/AP" /
    #     "Name/AFP/Getty Images" — the New Yorker + Economist style.
    _PHOTO_CREDIT_RE = re.compile(
        r'(?:'
        r'(?:photo|photograph|illustration|image)\s+(?:by|courtesy\s+of)\s+'
        r'|(?:photo|photograph|illustration|image|credit)\s*[:\-]\s*'
        # Credit agencies: capture the "Someone/Agency" form anywhere in text
        r'|\b[A-Z][\w.\-]+(?:\s+[A-Z][\w.\-]+){0,4}\s*/\s*'
        r'(?:Getty(?:\s+Images)?|Reuters|AP|AFP|Bloomberg|EPA|'
        r'Shutterstock|Magnum|Redux|The\s+New\s+York\s+Times)\b'
        r')',
        re.I,
    )

    # Per-sender SHA256 content-hash denylist. Keyed by sender domain suffix
    # (e.g. 'newyorker.com' matches both newsletter@newyorker.com and
    # newsletter@e.newyorker.com). Seeded by hand from images observed
    # being recycled as placeholder heroes across many emails from the
    # same publisher — the last line of defence when the URL pattern
    # isn't stable enough to regex.
    #
    # To add an entry: inspect the offending <img src>, fetch the bytes,
    # run sha256. See the Phase 3 todo for auto-population.
    _PUBLISHER_PLACEHOLDER_HASHES: Dict[str, FrozenSet[str]] = {
        # Seed placeholder — real hashes populated once we capture a NYer
        # .eml fixture and hash the actual Tilley asset.
        # 'newyorker.com': frozenset({'<sha256-of-tilley.png>'}),
    }

    # Cap on bytes fetched for hashing. Placeholder assets are small (<100KB
    # typical), and a runaway fetch would block the worker. Anything larger
    # than this is almost certainly not a recurring placeholder.
    _HASH_FETCH_MAX_BYTES = 512 * 1024
    _HASH_FETCH_TIMEOUT_SECONDS = 5

    # Phase 3 auto-learning parameters. When the same (sender_domain, sha256)
    # pair has been seen `_HERO_COUNTER_THRESHOLD` times across all users,
    # further sightings are denied — the image is demonstrably recurring and
    # therefore not a per-email editorial hero. TTL expires counters for
    # publishers that stop sending (or rotate their placeholder art).
    _HERO_COUNTER_KEY = 'subsbuzz:hero:count:{domain}:{digest}'
    _HERO_COUNTER_THRESHOLD = 3
    _HERO_COUNTER_TTL_SECONDS = 90 * 24 * 3600

    # IAB standard banner-ad dimensions (w, h). Images declared at these exact
    # sizes are almost never editorial heroes — they're display-ad creative
    # slotted into the newsletter (T-Mobile 728x90, Paramount 728x90, etc.).
    # Filter BEFORE the generic "too small" check — a 728x90 ad is wide enough
    # to pass the width>=600 hero gate otherwise.
    _IAB_BANNER_SIZES = frozenset({
        (728, 90),    # leaderboard (most common newsletter banner)
        (970, 90),    # pushdown / large leaderboard
        (970, 250),   # billboard
        (700, 90),    # AdExchanger-style custom leaderboard
        (300, 250),   # medium rectangle (MPU)
        (336, 280),   # large rectangle
        (300, 600),   # half page
        (160, 600),   # wide skyscraper
        (320, 50),    # mobile banner
    })
    _IAB_SIZE_TOLERANCE = 2  # px — absorb rounding on declared dims

    # Ad-creative filenames almost always embed the dimensions as NxM
    # (TMobile_April2026_728x90.jpg, IntentIQ_728x90_Where_Identity.jpg,
    # Paramount_Tracker-728x90.png). Catches banners even when the <img>
    # declares width but leaves height empty — a common newsletter pattern.
    # Require literal `x` as separator (not `_`/`-`) so year-prefixed names
    # like `April2026_728x90` aren't misread as (2026, 728).
    _FILENAME_DIMS_RE = re.compile(r'(?<!\d)(\d{2,4})x(\d{2,4})(?!\d)', re.I)

    def _is_iab_banner_size(self, width: int, height: int) -> bool:
        """True if (width, height) matches a known IAB banner-ad slot within tolerance."""
        tol = self._IAB_SIZE_TOLERANCE
        for bw, bh in self._IAB_BANNER_SIZES:
            if abs(width - bw) <= tol and abs(height - bh) <= tol:
                return True
        return False

    def _url_declares_iab_banner(self, src: str) -> bool:
        """True if the URL filename encodes an IAB banner size (e.g. _728x90.jpg)."""
        for m in self._FILENAME_DIMS_RE.finditer(src):
            try:
                w, h = int(m.group(1)), int(m.group(2))
            except ValueError:
                continue
            if self._is_iab_banner_size(w, h):
                return True
        return False

    # How far (in rendered text chars) after an <img> we'll look for a credit
    # line. Photo credits always sit immediately under the photo — anything
    # further than ~300 chars is probably body prose, not the credit.
    _CREDIT_LOOKAHEAD_CHARS = 300

    def _image_has_nearby_credit(self, img) -> bool:
        """True if the <img> has a photo-credit line in its immediate DOM
        neighbourhood. Looks at the nearest ancestor block (figure/table row/
        paragraph) and the first text content of the following siblings,
        capped at _CREDIT_LOOKAHEAD_CHARS chars.

        Strong positive signal for editorial content — chrome/mastheads/
        house-ads are never credited. We use this to PROMOTE a candidate to
        the top of selection, not to reject uncredited images (plenty of
        editorial uses uncredited stock or publisher-owned art).
        """
        try:
            # Walk ancestors up to the nearest block-like container so we can
            # scan its trailing text. <figure> is the canonical wrapper;
            # table-based newsletters use <td> / <tr>; plain HTML uses <p>/<div>.
            container = None
            for ancestor in img.parents:
                name = getattr(ancestor, 'name', None)
                if name in ('figure', 'figcaption', 'td', 'tr', 'p', 'div', 'li'):
                    container = ancestor
                    break
            if container is None:
                return False

            # Gather the text that follows the <img> within its container,
            # plus the text of the immediately-next sibling block. Credits
            # commonly sit either inside the same <figure> as a <figcaption>
            # OR in the row immediately below the image row.
            buf = []
            seen_img = False
            for el in container.descendants:
                if el is img:
                    seen_img = True
                    continue
                if not seen_img:
                    continue
                if hasattr(el, 'get_text'):
                    buf.append(el.get_text(' ', strip=True))
                elif isinstance(el, str):
                    buf.append(el.strip())
                if sum(len(s) for s in buf) > self._CREDIT_LOOKAHEAD_CHARS:
                    break

            # Also peek at the very next sibling block — caption rows in
            # table-based newsletters are *after* the image's <td>, not
            # inside it.
            nxt = container.find_next_sibling()
            if nxt is not None and hasattr(nxt, 'get_text'):
                buf.append(nxt.get_text(' ', strip=True)[: self._CREDIT_LOOKAHEAD_CHARS])

            text = ' '.join(b for b in buf if b)[: self._CREDIT_LOOKAHEAD_CHARS * 2]
            if not text:
                return False
            return bool(self._PHOTO_CREDIT_RE.search(text))
        except Exception:
            return False

    @staticmethod
    def _is_masthead_strip(width: int, height: int) -> bool:
        """Short-wide ratio indicating a masthead/wordmark band.

        Publisher mastheads are almost always <=150px tall and >=4x wider than
        tall (NYer black wordmark band, Economist red strip, WaPo nameplate).
        Editorial photos and charts cluster near 3:2 / 16:9 / 4:3 — none
        satisfy both conditions. Only fires when both dims are declared; if
        either is missing, defer to the other filters rather than guessing.
        """
        if not (width and height):
            return False
        if height > 150:
            return False
        return (width / height) >= 4.0

    def extract_hero_image(self, raw_content: str) -> Optional[str]:
        """
        Pick a likely hero image URL from an email's raw HTML. Returns None when
        nothing survives the filters. Pure HTML heuristics — no network fetches.

        Filters out:
          - data:/cid:/about: schemes (inline or broken refs)
          - tracking/pixel/logo/icon URL patterns
          - alt text hinting at logo/icon/avatar/unsubscribe/masthead
          - declared dimensions <= 50 (tiny icons, spacers, pixels)
          - ancestors that are <header>/<footer>/<nav>, or classes/ids matching
            header/footer/masthead/nav/social/unsubscribe

        Selection order among survivors:
          1. First <img> with declared width >= 600 (in document order — hero is
             usually near the top of newsletter content)
          2. Largest by declared area (width * height), when dimensions exist
          3. First survivor with no dimension hints (common for responsive heroes)
        """
        if not raw_content or not self._contains_html(raw_content):
            return None

        try:
            soup = BeautifulSoup(raw_content, 'html.parser')
        except Exception as e:
            print(f"⚠️  Hero image extraction: HTML parse failed: {e}")
            return None

        candidates = []
        for img in soup.find_all('img'):
            src = (img.get('src') or '').strip()
            if not src:
                continue
            if src.startswith(('data:', 'cid:', 'about:')):
                continue
            if self._HERO_URL_BLACKLIST.search(src):
                continue

            alt = img.get('alt') or ''
            if alt and self._HERO_ALT_BLACKLIST.search(alt):
                continue

            # Parse declared dimensions (attrs only — no image download)
            def _dim(val):
                try:
                    return int(str(val).replace('px', '').strip() or 0)
                except (ValueError, TypeError):
                    return 0

            width = _dim(img.get('width', 0))
            height = _dim(img.get('height', 0))

            # Reject declared IAB banner-ad sizes (728x90, 300x250, etc.) —
            # these are ad creative, not editorial heroes. Two paths:
            #  1. Both dims declared on the <img> → check the pair.
            #  2. Dims only in the filename (banner.jpg often names itself
            #     like foo_728x90.jpg; <img> declares width but empty height).
            if width and height and self._is_iab_banner_size(width, height):
                continue
            if self._url_declares_iab_banner(src):
                continue

            # Reject publisher logos / mastheads / wordmarks. Two paths:
            #  1. Filename says so (TNY_Logo, TheEconomist_Logo_Red, WaPo_Logo).
            #  2. Short-wide aspect ratio typical of masthead strips, even
            #     when the filename is generic (e.g. <publisher>/header.png).
            if self._HERO_LOGO_URL_RE.search(src):
                continue
            if self._HERO_PLACEHOLDER_URL_RE.search(src):
                continue
            if self._is_masthead_strip(width, height):
                continue

            # Too small to be a hero
            if (0 < width <= 50) or (0 < height <= 50):
                continue

            # Walk ancestors looking for header/footer/nav regions
            bad_ancestor = False
            for ancestor in img.parents:
                if getattr(ancestor, 'name', None) in ('header', 'footer', 'nav'):
                    bad_ancestor = True
                    break
                classes = ' '.join(ancestor.get('class', []) or []) if hasattr(ancestor, 'get') else ''
                elem_id = ancestor.get('id', '') if hasattr(ancestor, 'get') else ''
                if classes and self._HERO_ANCESTOR_BLACKLIST.search(classes):
                    bad_ancestor = True
                    break
                if elem_id and self._HERO_ANCESTOR_BLACKLIST.search(elem_id):
                    bad_ancestor = True
                    break
            if bad_ancestor:
                continue

            # Normalise protocol-relative URLs; drop relative paths we can't resolve
            if src.startswith('//'):
                src = 'https:' + src
            elif not src.startswith(('http://', 'https://')):
                continue

            candidates.append({
                'src': src,
                'width': width,
                'height': height,
                'credited': self._image_has_nearby_credit(img),
            })

        if not candidates:
            return None

        # Tier 0 — credited editorial: any image with a photo-credit line
        # nearby beats everything else. Credits mean human-authored editorial
        # content (AP/Getty/Reuters/photographer byline), which is exactly
        # the signal we want for a hero. Reject the smallest credited images
        # though — tiny "Photograph by" illustrations exist (e.g. 80px
        # author-author byline thumbnails on some newsletters).
        credited = [c for c in candidates if c['credited'] and (c['width'] == 0 or c['width'] >= 150)]
        if credited:
            # Prefer the LARGEST credited image (by declared width when
            # available, doc-order otherwise) — picks the main hero when
            # a newsletter has multiple credited photos in section thumbs.
            credited.sort(key=lambda c: c['width'] or 0, reverse=True)
            return credited[0]['src']

        # Tier 1 — first reasonably-wide image in doc order (hero is
        # usually near the top of newsletter content).
        for c in candidates:
            if c['width'] >= 600:
                return c['src']

        # Tier 2 — first medium-width image in doc order. Catches editorial
        # photos hosted via CMS crops (w_560, w_800) that don't cross the
        # 600 threshold but are clearly too big to be brand chrome.
        for c in candidates:
            if c['width'] >= 300:
                return c['src']

        # Tier 3 — largest by declared area (when both dims exist).
        with_area = [c for c in candidates if c['width'] and c['height']]
        if with_area:
            with_area.sort(key=lambda c: c['width'] * c['height'], reverse=True)
            return with_area[0]['src']

        # Tier 4 — first survivor (last-resort for responsive layouts
        # with no declared dims on any <img>).
        return candidates[0]['src']

    async def extract_hero_image_verified(
        self,
        raw_content: str,
        sender_domain: Optional[str] = None,
    ) -> Optional[str]:
        """Full hero pipeline: static filters + content-hash verification.

        Layered denials (first match wins):
          A. Static URL + dimension filters (in extract_hero_image).
          B. Static SHA256 denylist (_PUBLISHER_PLACEHOLDER_HASHES) — cheap
             when seeded, requires a manual entry per publisher.
          C. Phase 3 Redis counter — auto-learns recurring heroes. Any
             (sender_domain, sha256) pair seen >= _HERO_COUNTER_THRESHOLD
             times gets denied. Runs only when a Redis client is injected.

        Short-circuits without fetching when no sender_domain, no Phase 3
        client, and no static entries exist for the domain — the hot path
        stays cheap for senders we don't track.

        Failure policy: fetch errors and Redis errors KEEP the candidate.
        Better to ship a weak hero than blank the card on a transient
        infrastructure problem. Fallback art is reserved for "we know this
        is garbage", not "we don't know."
        """
        url = self.extract_hero_image(raw_content)
        if not url or not sender_domain:
            return url

        static_denylist = self._placeholder_hashes_for_domain(sender_domain)
        phase3_enabled = self._redis is not None

        # Short-circuit when nothing would use the hash — saves the HTTP fetch
        # on senders we have no data for.
        if not static_denylist and not phase3_enabled:
            return url

        digest = await self._fetch_and_hash_image(url)
        if digest is None:
            return url  # fetch failed — prefer candidate

        if digest in static_denylist:
            print(f"⚠️  Hero rejected (static placeholder hash): {url}")
            return None

        if phase3_enabled and await self._counter_says_deny(sender_domain, digest):
            print(f"⚠️  Hero rejected (recurring across publisher): {url}")
            return None

        return url

    async def _counter_says_deny(self, sender_domain: str, digest: str) -> bool:
        """Atomic INCR+EXPIRE for (sender_domain, sha256); returns True once
        the count crosses _HERO_COUNTER_THRESHOLD. Any Redis error returns
        False (fail-open: keep the candidate).
        """
        key = self._HERO_COUNTER_KEY.format(domain=sender_domain, digest=digest)
        try:
            pipe = self._redis.pipeline()
            pipe.incr(key)
            pipe.expire(key, self._HERO_COUNTER_TTL_SECONDS)
            count, _ = await pipe.execute()
            return int(count) >= self._HERO_COUNTER_THRESHOLD
        except Exception as e:
            print(f"⚠️  Hero counter check failed ({sender_domain}): {e}")
            return False

    def _placeholder_hashes_for_domain(self, sender_domain: str) -> FrozenSet[str]:
        """Collect placeholder hashes registered for any suffix of sender_domain.
        'e.newyorker.com' → union of entries for 'e.newyorker.com', 'newyorker.com'.
        Empty domain or no matches → empty set.
        """
        if not sender_domain:
            return frozenset()
        sender_domain = sender_domain.lower().strip()
        hashes: set = set()
        for key, vals in self._PUBLISHER_PLACEHOLDER_HASHES.items():
            if sender_domain == key or sender_domain.endswith('.' + key):
                hashes.update(vals)
        return frozenset(hashes)

    @staticmethod
    def _sha256_bytes(data: bytes) -> str:
        return hashlib.sha256(data).hexdigest()

    async def _fetch_and_hash_image(self, url: str) -> Optional[str]:
        """Fetch `url` and return sha256 hex of the response body.

        Bounded by _HASH_FETCH_MAX_BYTES and _HASH_FETCH_TIMEOUT_SECONDS to
        avoid the worker blocking on a slow/malicious response. Returns None
        on any failure — callers treat None as "couldn't verify" and keep the
        candidate.
        """
        try:
            timeout = aiohttp.ClientTimeout(total=self._HASH_FETCH_TIMEOUT_SECONDS)
            headers = {
                'User-Agent': 'Mozilla/5.0 (compatible; SubsBuzz/2.0; +https://subsbuzz.com)',
                'Accept': 'image/*,*/*;q=0.5',
            }
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(url, headers=headers) as resp:
                    if resp.status != 200:
                        return None
                    body = await resp.content.read(self._HASH_FETCH_MAX_BYTES + 1)
                    if len(body) > self._HASH_FETCH_MAX_BYTES:
                        return None  # too large — almost certainly not a recurring placeholder
                    return self._sha256_bytes(body)
        except Exception as e:
            print(f"⚠️  Hero hash fetch failed for {url}: {e}")
            return None

    @staticmethod
    def domain_from_sender(sender: str) -> Optional[str]:
        """Pull the domain from a raw From header or bare email address.
        'The New Yorker <newsletter@e.newyorker.com>' → 'e.newyorker.com'
        Returns None if no @-local-part found.
        """
        if not sender:
            return None
        m = re.search(r'@([A-Za-z0-9.\-]+)', sender)
        return m.group(1).lower() if m else None

    def _strip_html_tags(self, content: str) -> str:
        """Remove HTML tags from content"""
        return re.sub(r'<[^>]*>', ' ', content)
    
    def _clean_text_content(self, text: str) -> str:
        """
        Clean and normalize text content
        Extracted from server/gmail.ts cleanTextContent function
        """
        if not text:
            return ''

        # Strip CSS blocks that survive HTML parsing (seen in Substack online-view
        # pages where <style> content leaked through as text nodes).
        # Matches @media/@font-face/@keyframes wrappers and standalone selector { ... }
        # declarations. Done before whitespace collapsing so the DOTALL pass still works.
        text = re.sub(r'@(media|font-face|keyframes|supports|import|charset)[^{]*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', '', text, flags=re.DOTALL)
        text = re.sub(r'(?:^|\n)\s*[.#][\w\-,\s.#:>+~\[\]()"\'=]+\s*\{[^{}]{0,2000}\}', '', text, flags=re.DOTALL)

        # Remove multiple consecutive whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove excessive newlines (more than 2)
        text = re.sub(r'\n\s*\n\s*\n+', '\n\n', text)
        
        # Remove leading/trailing whitespace per line
        lines = [line.strip() for line in text.split('\n')]
        text = '\n'.join(lines)
        
        # Remove empty lines at start/end
        text = re.sub(r'^\n+|\n+$', '', text)

        # Remove common email artifacts. Do NOT strip [brackets] or |pipes| —
        # newsletters routinely use [Forbes], [Reuters], [WSJ] for source
        # attribution (see AdExchanger's "But Wait! There's More!" section),
        # and the naive pattern deletes the attribution along with the prose.
        text = re.sub(r'^>.*$', '', text, flags=re.MULTILINE)  # Remove quoted text lines
        text = re.sub(r'Click here to view.*$', '', text, flags=re.MULTILINE)
        text = re.sub(r'This email was sent to.*$', '', text, flags=re.MULTILINE)
        text = re.sub(r'You received this.*$', '', text, flags=re.MULTILINE)
        text = re.sub(r'To unsubscribe.*$', '', text, flags=re.MULTILINE)
        text = re.sub(r'^\s*[\*\-\_\=]{3,}\s*$', '', text, flags=re.MULTILINE)  # Remove separator lines
        
        # Final cleanup
        return text.strip()