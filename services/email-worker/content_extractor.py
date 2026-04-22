"""
Content Extractor for Email Worker Service

Handles email content extraction and preprocessing.
Extracted from server/gmail.ts with Python implementation using BeautifulSoup.
"""

import re
import asyncio
import aiohttp
from typing import Optional
from bs4 import BeautifulSoup, Comment
import html2text

class ContentExtractor:
    """Email content extraction and cleaning"""
    
    def __init__(self):
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

            # Always extract from the email HTML as the baseline.
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
            print("⚠️  Extracted content too short, falling back to basic HTML stripping")
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
        # LiveIntent-style tracking beacon fingerprint: /imp? with li= param
        r'|/imp\?[^"\s]*li=)',
        re.I,
    )
    # Alt-text hints the image is NOT a hero
    _HERO_ALT_BLACKLIST = re.compile(
        r'(logo|icon|avatar|unsubscribe|masthead|footer|header|spacer)',
        re.I,
    )
    # Ancestor class/id/tag names that indicate non-content regions
    _HERO_ANCESTOR_BLACKLIST = re.compile(
        r'(header|footer|masthead|nav|navigation|social|unsubscribe|footer-links)',
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

            candidates.append({'src': src, 'width': width, 'height': height})

        if not candidates:
            return None

        for c in candidates:
            if c['width'] >= 600:
                return c['src']

        with_area = [c for c in candidates if c['width'] and c['height']]
        if with_area:
            with_area.sort(key=lambda c: c['width'] * c['height'], reverse=True)
            return with_area[0]['src']

        return candidates[0]['src']

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