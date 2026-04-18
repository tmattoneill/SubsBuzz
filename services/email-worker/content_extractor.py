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
            
            # First, try to find and use "view online" link for better content
            online_content = await self._try_extract_from_online_version(soup)
            if online_content:
                print("✅ Successfully extracted content from online version")
                return online_content
            
            # Fall back to aggressive email HTML cleaning
            return await self._extract_from_email_html(soup, raw_content)
            
        except Exception as e:
            print(f"⚠️  Error parsing HTML content, falling back to raw content: {e}")
            # Fallback to basic text cleanup if HTML parsing fails
            return self._clean_text_content(self._strip_html_tags(raw_content))
    
    def _contains_html(self, content: str) -> bool:
        """Check if content contains HTML tags"""
        return '<html' in content.lower() or '<HTML' in content or bool(re.search(r'<[^>]+>', content))
    
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
        r'|/logo|/avatar|/icon|/unsub|/footer)',
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
        
        # Remove common email artifacts
        text = re.sub(r'\[.*?\]', '', text)  # Remove [brackets] content
        text = re.sub(r'\|.*?\|', '', text)  # Remove |pipe| content
        text = re.sub(r'^>.*$', '', text, flags=re.MULTILINE)  # Remove quoted text lines
        text = re.sub(r'Click here to view.*$', '', text, flags=re.MULTILINE)
        text = re.sub(r'This email was sent to.*$', '', text, flags=re.MULTILINE)
        text = re.sub(r'You received this.*$', '', text, flags=re.MULTILINE)
        text = re.sub(r'To unsubscribe.*$', '', text, flags=re.MULTILINE)
        text = re.sub(r'^\s*[\*\-\_\=]{3,}\s*$', '', text, flags=re.MULTILINE)  # Remove separator lines
        
        # Final cleanup
        return text.strip()