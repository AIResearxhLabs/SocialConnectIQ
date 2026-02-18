"""
Trending Topics Agent - AI-powered trending content generation
Uses OpenAI GPT-4o to generate personalized trending topics based on user interests
Now fetches REAL news from Google News RSS and uses AI for formatting only.
"""
import logging
import json
import hashlib
import urllib.request
import xml.etree.ElementTree as ET
from html import unescape
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

# In-memory cache for trending topics
_trending_cache: Dict[str, Dict[str, Any]] = {}
CACHE_DURATION_MINUTES = 10  # 10 min cache — fresh enough for news, fast for users


class TrendingTopicsAgent:
    """
    AI agent for generating personalized trending topics.
    Uses GPT-4o to create engaging, relevant content based on user interests.
    Includes caching to optimize API costs.
    """
    
    def __init__(self, openai_api_key: str, model: str = "gpt-4o", gnews_api_key: str = ""):
        """
        Initialize Trending Topics Agent
        
        Args:
            openai_api_key: OpenAI API key
            model: OpenAI model to use (default: gpt-4o)
            gnews_api_key: GNews.io API key for news fetching
        """
        self.client = AsyncOpenAI(api_key=openai_api_key)
        self.model = model
        self.gnews_api_key = gnews_api_key
        logger.info(f"TrendingTopicsAgent initialized with model: {model}, gnews={'yes' if gnews_api_key else 'no'}")
    
    def _get_cache_key(self, interests: List[str]) -> str:
        """Generate a cache key based on sorted interests"""
        sorted_interests = sorted([i.lower().strip() for i in interests])
        return hashlib.md5(json.dumps(sorted_interests).encode()).hexdigest()
    
    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cached data is still valid"""
        if cache_key not in _trending_cache:
            return False
        
        cached = _trending_cache[cache_key]
        expiry = cached.get("expiry")
        if not expiry:
            return False
        
        return datetime.now() < expiry
    
    def _get_cached(self, cache_key: str) -> Optional[List[Dict]]:
        """Get cached trending topics if valid"""
        if self._is_cache_valid(cache_key):
            logger.info(f"Cache hit for key: {cache_key[:8]}...")
            return _trending_cache[cache_key]["data"]
        return None
    
    def _set_cache(self, cache_key: str, data: List[Dict]):
        """Cache trending topics with expiry"""
        _trending_cache[cache_key] = {
            "data": data,
            "expiry": datetime.now() + timedelta(minutes=CACHE_DURATION_MINUTES),
            "created_at": datetime.now().isoformat()
        }
        logger.info(f"Cached {len(data)} trending topics for key: {cache_key[:8]}...")
    
    def clear_cache(self, user_id: str = None):
        """Clear cache - optionally for specific user"""
        global _trending_cache
        if user_id:
            # Clear caches that might belong to this user
            # In a production system, you'd track user -> cache key mapping
            pass
        else:
            _trending_cache = {}
        logger.info("Trending cache cleared")
    
    def _fetch_rss_feed(self, interest: str, max_items: int = 5) -> List[Dict[str, str]]:
        """
        Fetch real news from Google News RSS for a given interest.
        
        Args:
            interest: The topic/interest to search for
            max_items: Maximum number of items to return per interest
            
        Returns:
            List of news items with title, link, snippet, pubDate
        """
        import re
        
        # Build Google News RSS URL
        query = urllib.request.quote(interest)
        url = f"https://news.google.com/rss/search?q={query}&hl=en-IN&gl=IN&ceid=IN:en"
        
        logger.info(f"[RSS] Fetching news for interest: {interest}")
        logger.info(f"[RSS] URL: {url}")
        
        news_items = []
        
        try:
            # Fetch with timeout
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=5) as response:
                xml_data = response.read().decode('utf-8')
            
            # Parse XML
            root = ET.fromstring(xml_data)
            channel = root.find('channel')
            
            if channel is None:
                logger.warning(f"[RSS] No channel found in RSS response for {interest}")
                return []
            
            for item in channel.findall('item')[:max_items]:
                title_elem = item.find('title')
                link_elem = item.find('link')
                desc_elem = item.find('description')
                pubdate_elem = item.find('pubDate')
                
                title = unescape(title_elem.text) if title_elem is not None and title_elem.text else ""
                link = link_elem.text if link_elem is not None and link_elem.text else ""
                
                # Clean up description (remove HTML tags)
                desc = ""
                if desc_elem is not None and desc_elem.text:
                    desc = re.sub(r'<[^>]+>', '', unescape(desc_elem.text))
                
                pubdate = pubdate_elem.text if pubdate_elem is not None else ""
                
                if title:  # Only add if we have a title
                    news_items.append({
                        "title": title[:150],  # Limit title length
                        "link": link,
                        "snippet": desc[:300] if desc else "",  # Limit snippet
                        "pubDate": pubdate,
                        "category": interest
                    })
            
            logger.info(f"[RSS] Fetched {len(news_items)} news items for {interest}")
            
        except urllib.error.URLError as e:
            logger.error(f"[RSS] Network error fetching {interest}: {e}")
        except ET.ParseError as e:
            logger.error(f"[RSS] XML parse error for {interest}: {e}")
        except Exception as e:
            logger.error(f"[RSS] Unexpected error fetching {interest}: {e}")
        
        return news_items

    def _resolve_google_news_url(self, url: str) -> str:
        """Resolve a Google News redirect URL to the actual article URL.
        Uses googlenewsdecoder to decode the protobuf-encoded URLs."""
        if not url or 'news.google.com' not in url:
            return url
        
        try:
            from googlenewsdecoder import new_decoderv1
            result = new_decoderv1(url, interval=5)
            if result and result.get("status"):
                decoded = result.get("decoded_url", "")
                if decoded:
                    logger.debug(f"[URL-RESOLVE] Decoded: {decoded[:80]}")
                    return decoded
        except Exception as e:
            logger.debug(f"[URL-RESOLVE] Decoder failed for {url[:60]}: {e}")
        
        return url

    def _extract_article_data(self, url: str, max_paragraphs: int = 3) -> Dict[str, str]:
        """
        Fetch an article URL and extract preview text, og:image, and og:description.
        Handles Google News redirect URLs.
        Returns dict with keys: preview, image_url, description, source_url
        """
        import re
        
        result = {"preview": "", "image_url": "", "description": "", "source_url": ""}
        
        if not url:
            return result
        
        try:
            from bs4 import BeautifulSoup
            
            # Resolve Google News redirects to get the actual article URL
            actual_url = self._resolve_google_news_url(url)
            result["source_url"] = actual_url
            
            req = urllib.request.Request(actual_url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'identity',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            })
            with urllib.request.urlopen(req, timeout=10) as response:
                html = response.read().decode('utf-8', errors='ignore')
            
            soup = BeautifulSoup(html, 'html.parser')
            
            # --- Extract og:image / twitter:image for thumbnail ---
            og_image = (
                soup.find('meta', property='og:image') or
                soup.find('meta', attrs={'name': 'og:image'}) or
                soup.find('meta', attrs={'name': 'twitter:image'}) or
                soup.find('meta', property='twitter:image') or
                soup.find('meta', attrs={'name': 'twitter:image:src'})
            )
            if og_image and og_image.get('content'):
                img_url = og_image['content'].strip()
                # Make sure it's a full URL
                if img_url.startswith('//'):
                    img_url = 'https:' + img_url
                elif img_url.startswith('/'):
                    # Relative URL - construct from base
                    from urllib.parse import urlparse
                    parsed = urlparse(actual_url)
                    img_url = f"{parsed.scheme}://{parsed.netloc}{img_url}"
                # Filter out Google News logos and other non-article images
                if not any(domain in img_url.lower() for domain in ['google.com', 'gstatic.com', 'google.co', 'googleapis.com/logo']):
                    result["image_url"] = img_url
                    logger.debug(f"[Preview] Found og:image: {img_url[:80]}")
                else:
                    logger.debug(f"[Preview] Skipped Google og:image: {img_url[:80]}")
            
            # --- Extract og:description / meta description ---
            og_desc = (
                soup.find('meta', property='og:description') or
                soup.find('meta', attrs={'name': 'og:description'}) or
                soup.find('meta', attrs={'name': 'description'}) or
                soup.find('meta', attrs={'name': 'twitter:description'})
            )
            if og_desc and og_desc.get('content'):
                desc = og_desc['content'].strip()
                if len(desc) > 30:
                    result["description"] = desc
            
            # --- Remove non-content elements for paragraph extraction ---
            for tag in soup(['script', 'style', 'nav', 'header', 'footer', 'aside', 'form', 'figure', 'figcaption', 'iframe', 'noscript']):
                tag.decompose()
            
            # Try to find the main article content area
            article = (
                soup.find('article') or 
                soup.find('main') or 
                soup.find('div', class_=re.compile(r'(article[-_]?(body|content|text)|story[-_]?(body|content)|post[-_]?(body|content))', re.I)) or
                soup.find('div', class_=re.compile(r'^(content|body|entry)', re.I)) or
                soup.find('div', {'role': 'article'}) or
                soup.find('div', id=re.compile(r'(article|content|story|body)', re.I))
            )
            search_area = article if article else (soup.body if soup.body else soup)
            
            # Extract meaningful paragraphs
            paragraphs = []
            for p in search_area.find_all('p'):
                text = p.get_text(strip=True)
                # Skip short text (captions, dates, bylines, cookie notices)
                if len(text) > 40 and not re.match(r'^(By |Written by |Published |Updated |Photo |Image |Credit |Source |\u00a9|Subscribe |Sign up |Log in |Advertisement)', text, re.I):
                    paragraphs.append(text)
                    if len(paragraphs) >= max_paragraphs:
                        break
            
            preview = '\n\n'.join(paragraphs)
            result["preview"] = preview[:1000] if preview else ""
            
            return result
            
        except Exception as e:
            logger.debug(f"[Preview] Could not extract from {url[:60]}: {e}")
            return result

    async def fetch_news_fast(
        self,
        interests: List[str],
        correlation_id: str = "unknown",
        items_per_interest: int = 5,
        max_total: int = 15,
        shuffle: bool = False
    ) -> Dict[str, Any]:
        """
        Fast news fetch via GNews API — returns real images + descriptions instantly.
        Falls back to Google News RSS if GNews API key is not set.
        """
        import asyncio, time, re as _re
        from concurrent.futures import ThreadPoolExecutor
        t_start = time.time()
        
        logger.info(f"[{correlation_id}] FAST fetch for {len(interests)} interests: {interests}")
        
        if not interests:
            return {"success": False, "error": "No interests provided.", "topics": []}
        
        # --- Cache check: instant return if cached ---
        cache_key = self._get_cache_key(interests)
        cached_topics = self._get_cached(cache_key)
        if cached_topics and not shuffle:
            logger.info(f"[{correlation_id}] Cache HIT — returning {len(cached_topics)} topics in 0ms")
            return {"success": True, "topics": cached_topics, "cached": True}
        
        # --- Dynamically calculate items per interest to cover ALL interests ---
        # Ensure every interest gets at least 2 articles, distributed evenly
        items_per_interest = max(2, (max_total + len(interests) - 1) // len(interests))
        logger.info(f"[{correlation_id}] {len(interests)} interests -> {items_per_interest} items each (max_total={max_total})")
        
        # --- Fetch from GNews API (includes images + descriptions) ---
        all_articles = []
        
        if self.gnews_api_key:
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = asyncio.get_event_loop()
            
            def _fetch_gnews(interest: str, max_items: int) -> List[Dict]:
                """Fetch articles from GNews API for one interest."""
                import urllib.request as _ur
                encoded_q = _ur.quote(interest)
                api_url = (
                    f"https://gnews.io/api/v4/search?"
                    f"q={encoded_q}&lang=en&country=in&max={max_items}"
                    f"&sortby=publishedAt"
                    f"&apikey={self.gnews_api_key}"
                )
                req = _ur.Request(api_url, headers={"User-Agent": "Mozilla/5.0"})
                try:
                    with _ur.urlopen(req, timeout=8) as resp:
                        data = json.loads(resp.read().decode("utf-8"))
                    
                    articles = []
                    for a in data.get("articles", []):
                        articles.append({
                            "title": (a.get("title") or "")[:150],
                            "description": (a.get("description") or ""),
                            "image": a.get("image") or "",
                            "url": a.get("url") or "",
                            "publishedAt": a.get("publishedAt") or "",
                            "source": (a.get("source") or {}).get("name", ""),
                            "category": interest
                        })
                    return articles
                except Exception as e:
                    logger.error(f"[{correlation_id}] GNews error for '{interest}': {e}")
                    return []
            
            # Parallel fetch — one thread per interest
            gnews_pool = ThreadPoolExecutor(max_workers=len(interests))
            
            async def fetch_one(interest):
                return await loop.run_in_executor(
                    gnews_pool, _fetch_gnews, interest, items_per_interest
                )
            
            tasks = [fetch_one(interest) for interest in interests]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            gnews_pool.shutdown(wait=False)
            
            # Interleave round-robin across interests for diversity
            results_by_interest = {}
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"[{correlation_id}] Error fetching '{interests[i]}': {result}")
                elif result:
                    results_by_interest[interests[i]] = result
            
            if results_by_interest:
                queues = list(results_by_interest.values())
                max_len = max(len(q) for q in queues)
                for round_idx in range(max_len):
                    for queue in queues:
                        if round_idx < len(queue):
                            all_articles.append(queue[round_idx])
            
            logger.info(f"[{correlation_id}] GNews fetched {len(all_articles)} articles (interleaved)")
        
        else:
            # Fallback to Google News RSS if no GNews API key
            logger.warning(f"[{correlation_id}] No GNews API key — falling back to RSS")
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = asyncio.get_event_loop()
            
            rss_pool = ThreadPoolExecutor(max_workers=len(interests))
            
            async def fetch_rss(interest):
                return await loop.run_in_executor(
                    rss_pool, self._fetch_rss_feed, interest, items_per_interest
                )
            
            tasks = [fetch_rss(interest) for interest in interests]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            rss_pool.shutdown(wait=False)
            
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"[{correlation_id}] RSS error '{interests[i]}': {result}")
                elif result:
                    for item in result:
                        all_articles.append({
                            "title": item.get("title", ""),
                            "description": item.get("snippet", ""),
                            "image": self._get_category_image_url(item.get("category", "General"), item.get("title", "")),
                            "url": item.get("link", ""),
                            "publishedAt": item.get("pubDate", ""),
                            "source": "",
                            "category": item.get("category", "General")
                        })
        
        if not all_articles:
            return {
                "success": False,
                "error": "Unable to fetch news. Please check your connection.",
                "topics": []
            }
        
        # Cap total
        all_articles = all_articles[:max_total]
        
        # --- Deduplicate by title similarity ---
        seen_titles = set()
        unique = []
        for item in all_articles:
            raw = item.get("title", "").lower().strip()
            normalized = _re.sub(r'\s*[-|–—]\s*[^-|–—]+$', '', raw).strip()
            key = _re.sub(r'[^\w\s]', '', normalized).strip()
            if key and key not in seen_titles:
                seen_titles.add(key)
                unique.append(item)
        
        logger.info(f"[{correlation_id}] Dedup: {len(all_articles)} -> {len(unique)}")
        all_articles = unique
        
        # Shuffle if requested
        if shuffle:
            import random
            random.shuffle(all_articles)
        
        # --- Build topic cards ---
        topics = []
        for idx, a in enumerate(all_articles):
            category = a.get("category", "General")
            desc = a.get("description", "").strip()
            summary = desc if desc and len(desc) > 20 else f"Latest {category} update — tap to read the full story."
            
            topics.append({
                "id": idx + 1,
                "title": a.get("title", ""),
                "summary": summary,
                "category": category,
                "sourceUrl": a.get("url", ""),
                "pubDate": a.get("publishedAt", ""),
                "imageUrl": a.get("image", ""),
                "source": a.get("source", ""),
                "hashtags": [],
                "platforms": []
            })
        
        elapsed = time.time() - t_start
        logger.info(f"[{correlation_id}] FAST fetch complete: {len(topics)} topics in {elapsed:.1f}s")
        
        # Cache for instant next load
        self._set_cache(cache_key, topics)
        
        return {
            "success": True,
            "topics": topics,
            "cached": False
        }



    async def generate_trending_topics(
        self,
        user_id: str,
        interests: List[str],
        correlation_id: str = "unknown",
        force_refresh: bool = False,
        count: int = 10
    ) -> Dict[str, Any]:
        """
        Generate trending topics based on user interests
        
        Args:
            user_id: User identifier
            interests: List of user's interests (e.g., ["Technology", "AI", "Startups"])
            correlation_id: Request correlation ID for tracing
            force_refresh: If True, bypass cache and generate fresh content
            count: Number of trending topics to generate
            
        Returns:
            Dict with success status and list of trending topics
        """
        logger.info(f"[{correlation_id}] Generating trending topics for user {user_id}")
        logger.info(f"[{correlation_id}] Interests: {interests}")
        
        if not interests:
            return {
                "success": False,
                "error": "No interests provided. Please select your interests in Settings.",
                "topics": []
            }
        
        # Check cache first (unless force refresh)
        cache_key = self._get_cache_key(interests)
        
        if force_refresh:
            # Clear ALL cache entries to force complete regeneration
            global _trending_cache
            old_count = len(_trending_cache)
            _trending_cache = {}
            logger.info(f"[{correlation_id}] FORCE REFRESH: Cleared {old_count} cache entries")
        else:
            cached = self._get_cached(cache_key)
            if cached:
                logger.info(f"[{correlation_id}] SERVING FROM CACHE (key: {cache_key[:8]})")
                # Log the first image URL from cache to debug
                if cached and len(cached) > 0:
                    first_url = cached[0].get('imageUrl', 'None')
                    logger.info(f"[{correlation_id}] First cached imageUrl: {first_url[:50] if first_url else 'None'}...")
                return {
                    "success": True,
                    "topics": cached,
                    "cached": True,
                    "cache_key": cache_key[:8]
                }
        
        logger.info(f"[{correlation_id}] GENERATING FRESH TOPICS (no cache)")
        try:
            # STEP 1: Fetch real news from Google News RSS for each interest
            all_news = []
            items_per_interest = max(3, 15 // len(interests))  # Distribute evenly
            
            logger.info(f"[{correlation_id}] Fetching RSS for {len(interests)} interests: {interests}")
            
            for interest in interests:
                try:
                    news_items = self._fetch_rss_feed(interest, items_per_interest)
                    logger.info(f"[{correlation_id}] Got {len(news_items)} items for '{interest}'")
                    all_news.extend(news_items)
                except Exception as e:
                    logger.error(f"[{correlation_id}] Failed to fetch '{interest}': {e}")
            
            logger.info(f"[{correlation_id}] Total fetched: {len(all_news)} news items from RSS")
            
            # If RSS fetch failed, show error (no AI fallback - always real news only)
            if not all_news:
                logger.error(f"[{correlation_id}] RSS fetch returned 0 items!")
                return {
                    "success": False,
                    "error": "Unable to fetch news. Please check your connection and try again.",
                    "topics": []
                }
            
            # STEP 2: Pass real news to AI for formatting/enrichment
            system_prompt = self._build_system_prompt()
            user_prompt = self._build_user_prompt(all_news, count)
            
            logger.info(f"[{correlation_id}] Calling OpenAI API to format {len(all_news)} news items...")
            logger.info(f"[{correlation_id}] User prompt length: {len(user_prompt)} chars")
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                max_tokens=16000,  # GPT-4o max is 16,384 - need high for detailed summaries
                response_format={"type": "json_object"}
            )
            
            result_text = response.choices[0].message.content
            logger.info(f"[{correlation_id}] OpenAI response received, length: {len(result_text)} chars")
            logger.info(f"[{correlation_id}] Raw response preview: {result_text[:500]}...")
            
            # Parse the JSON response
            try:
                result = json.loads(result_text)
                topics = result.get("topics", [])
                logger.info(f"[{correlation_id}] Parsed {len(topics)} topics from AI response")
            except json.JSONDecodeError as e:
                logger.error(f"[{correlation_id}] Failed to parse JSON response: {e}")
                logger.error(f"[{correlation_id}] Raw response: {result_text[:1000]}")
                return {
                    "success": False,
                    "error": "Failed to parse AI response",
                    "topics": []
                }
            
            # Check if AI returned empty topics
            if not topics:
                logger.error(f"[{correlation_id}] AI returned empty topics array!")
                logger.error(f"[{correlation_id}] Full response: {result_text}")
                return {
                    "success": False,
                    "error": "AI returned no topics. Please try again.",
                    "topics": []
                }
            
            # Validate and enrich topics (add images)
            enriched_topics = self._enrich_topics(topics)
            logger.info(f"[{correlation_id}] Enriched {len(enriched_topics)} topics with images")
            
            # Cache the results
            self._set_cache(cache_key, enriched_topics)
            
            return {
                "success": True,
                "topics": enriched_topics,
                "cached": False,
                "generated_at": datetime.now().isoformat(),
                "source": "google_news_rss"
            }
            
        except Exception as e:
            logger.error(f"[{correlation_id}] Error generating trending topics: {e}")
            return {
                "success": False,
                "error": str(e),
                "topics": []
            }
    
    async def _generate_ai_topics_fallback(self, interests: List[str], count: int, correlation_id: str, cache_key: str) -> Dict[str, Any]:
        """Fallback: Generate topics via AI when RSS fetch fails"""
        logger.info(f"[{correlation_id}] Using AI fallback to generate topics")
        
        interests_str = ", ".join(interests)
        fallback_prompt = f"""Generate {count} engaging trending social media topics based on these interests: {interests_str}

For each topic, provide:
- id: unique identifier (string, like "trend_1")
- title: catchy headline (max 80 chars)
- summary: detailed 3-4 paragraph summary (150-250 words)
- category: which interest it relates to
- platformId: one of "linkedin", "twitter", "instagram", "facebook"
- metrics: object with likes, comments, shares as formatted strings
- imageUrl: null
- hashtags: array of 3-5 relevant hashtags

Respond with JSON: {{"topics": [...]}}"""

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a social media trending topics expert. Generate engaging, current topics."},
                    {"role": "user", "content": fallback_prompt}
                ],
                temperature=0.8,
                max_tokens=4000,
                response_format={"type": "json_object"}
            )
            
            result = json.loads(response.choices[0].message.content)
            topics = result.get("topics", [])
            enriched_topics = self._enrich_topics(topics)
            self._set_cache(cache_key, enriched_topics)
            
            return {
                "success": True,
                "topics": enriched_topics,
                "cached": False,
                "source": "ai_fallback"
            }
        except Exception as e:
            logger.error(f"[{correlation_id}] AI fallback error: {e}")
            return {"success": False, "error": str(e), "topics": []}
    
    def _build_system_prompt(self) -> str:
        """Build the system prompt for formatting real news into trending topics"""
        return """You are a social media content curator. Your job is to take REAL news items and format them into engaging social media trending topics.

IMPORTANT: You must base your content ONLY on the news items provided. Do NOT invent or hallucinate any information.

For each topic you create:
1. Use the REAL headline as inspiration but make it catchy and social-media friendly
2. Write an engaging 2-3 paragraph summary based on the news snippet provided
3. Keep the original source link (sourceUrl) in your response
4. Assign appropriate hashtags based on the actual content
5. Choose the best platform (LinkedIn for professional, Twitter for quick takes, etc.)

Always respond with valid JSON containing a "topics" array."""
    
    def _build_user_prompt(self, news_items: List[Dict], count: int) -> str:
        """Build the user prompt with real news items to format"""
        
        # Format news items for the AI
        news_text = "\n\n".join([
            f"NEWS ITEM {i+1}:\n- Title: {item['title']}\n- Snippet: {item.get('snippet', 'No snippet available')}\n- Link: {item['link']}\n- Category: {item.get('category', 'General')}"
            for i, item in enumerate(news_items)
        ])
        
        return f"""Here are {len(news_items)} REAL news items. Select the best {count} and format them as trending social media topics:

{news_text}

---

For each selected topic, provide:
- id: unique identifier (string, like "trend_1")
- title: catchy headline based on the REAL news (max 80 chars)
- summary: A DETAILED 3-4 paragraph summary (150-250 words). Structure it as:
  * Paragraph 1: What happened? (the core news)
  * Paragraph 2: Why does it matter? (context and implications)
  * Paragraph 3: What's next? (future outlook or action items)
  * Optional Paragraph 4: Expert perspective or key quote if available
- category: the news category (e.g., Technology, Business, Sports)
- sourceUrl: the original news link (PRESERVE THIS FROM THE NEWS ITEM)
- platformId: one of "linkedin", "twitter", "instagram", "facebook" (choose based on content type)
- metrics: object with likes (10K-500K), comments (1K-50K), shares (500-10K) as formatted strings
- imageUrl: null (we'll handle images separately)
- hashtags: array of 3-5 relevant hashtags based on the ACTUAL content

CRITICAL: Base everything on the REAL news provided. Do not invent stories. Write LONGER, more detailed summaries.

Respond with JSON: {{"topics": [...]}}"""
    
    def _generate_image_url(self, title: str) -> str:
        """Generate a reliable image URL using Lorem Picsum for dashboard thumbnails.
        Note: Pollinations.ai is used for regenerate buttons (on-demand, one at a time)
        but NOT for initial dashboard load to avoid rate limits."""
        if not title:
            logger.warning("[IMAGE-GEN] No title provided, returning None")
            return None
        
        import hashlib
        import random
        
        # Generate a unique but consistent seed from the title
        # This ensures different topics get different images
        title_hash = int(hashlib.md5(title.encode()).hexdigest()[:8], 16)
        # Add random component to ensure variety on refresh
        random_offset = random.randint(0, 500)
        seed = (title_hash + random_offset) % 1000 + 1  # Picsum IDs 1-1000
        
        # Lorem Picsum - 100% reliable, no rate limits
        # Using /id/ for specific consistent images
        url = f"https://picsum.photos/id/{seed}/800/400"
        
        logger.info(f"[IMAGE-GEN] Title: '{title[:30]}...' -> Picsum ID: {seed}")
        logger.info(f"[IMAGE-GEN] URL: {url}")
        
        return url
    
    def _get_category_image_url(self, category: str, title: str) -> str:
        """Generate a relevant image URL based on topic category.
        Uses curated Unsplash photo IDs mapped to categories for reliable, relevant images."""
        import hashlib
        
        # Map categories to curated Unsplash photo IDs
        # 8-10 images per category for maximum variety
        category_images = {
            "technology": [
                "https://images.unsplash.com/photo-1518770660439-4636190af475",  # Circuit board
                "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5",  # Matrix code
                "https://images.unsplash.com/photo-1550751827-4bd374c3f58b",  # Cybersecurity
                "https://images.unsplash.com/photo-1531297484001-80022131f5a1",  # Laptop setup
                "https://images.unsplash.com/photo-1485827404703-89b55fcc595e",  # Robot
                "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb",  # Code
                "https://images.unsplash.com/photo-1451187580459-43490279c0fa",  # Data center
                "https://images.unsplash.com/photo-1558494949-ef010cbdcc31",  # Server
                "https://images.unsplash.com/photo-1519389950473-47ba0277781c",  # Team tech
                "https://images.unsplash.com/photo-1535378917042-10a22c95931a",  # AI brain
            ],
            "cricket": [
                "https://images.unsplash.com/photo-1531415074968-036ba1b575da",  # Cricket batsman
                "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e",  # Cricket stadium
                "https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972",  # Cricket bat ball
                "https://images.unsplash.com/photo-1580674684081-7617fbf3d745",  # Cricket ground
                "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1",  # Cricket match
                "https://images.unsplash.com/photo-1587385789097-0197a7e4a88d",  # Cricket stumps
                "https://images.unsplash.com/photo-1594470117722-de4b9a02ebed",  # Batsman shot
                "https://images.unsplash.com/photo-1631196061438-2c6c20b73731",  # Cricket field
            ],
            "football": [
                "https://images.unsplash.com/photo-1574629810360-7efbbe195018",  # Soccer ball
                "https://images.unsplash.com/photo-1508098682722-e99c43a406b2",  # Football field
                "https://images.unsplash.com/photo-1553778263-73a83bab9b0c",  # Football match
                "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d",  # Soccer player
                "https://images.unsplash.com/photo-1522778119026-d647f0596c20",  # Stadium night
                "https://images.unsplash.com/photo-1579952363873-27f3bade9f55",  # Football crowd
                "https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9",  # Football boots
                "https://images.unsplash.com/photo-1560272564-c83b66b1ad12",  # Goal net
            ],
            "tennis": [
                "https://images.unsplash.com/photo-1554068865-24cecd4e34b8",  # Tennis court
                "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0",  # Tennis ball
                "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6",  # Tennis racket
                "https://images.unsplash.com/photo-1531315396756-905d68d21b56",  # Tennis match
                "https://images.unsplash.com/photo-1545151414-8a948e1ea54f",  # Tennis serve
                "https://images.unsplash.com/photo-1587280501835-76f5bfb3b4d0",  # Tennis player
            ],
            "basketball": [
                "https://images.unsplash.com/photo-1546519638-68e109498ffc",  # Basketball court
                "https://images.unsplash.com/photo-1579952363873-27f3bade9f55",  # Basketball game
                "https://images.unsplash.com/photo-1574623452334-1e0ac2b3ccb4",  # Basketball hoop
                "https://images.unsplash.com/photo-1519861531473-9200262188bf",  # Basketball
                "https://images.unsplash.com/photo-1504450758481-7338bbe75005",  # Basketball dunk
            ],
            "formula1": [
                "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7",  # Race car
                "https://images.unsplash.com/photo-1541744573515-478c4a0a8f1b",  # F1 track
                "https://images.unsplash.com/photo-1503376780353-7e6692767b70",  # Sports car
                "https://images.unsplash.com/photo-1583121274602-3e2820c69888",  # Racing
                "https://images.unsplash.com/photo-1552519507-da3b142c6e3d",  # Fast car
                "https://images.unsplash.com/photo-1553440569-bcc63803a83d",  # Motorsport
            ],
            "sports": [
                "https://images.unsplash.com/photo-1461896836934-ffe607ba8211",  # Stadium
                "https://images.unsplash.com/photo-1517649763962-0c623066013b",  # Running
                "https://images.unsplash.com/photo-1552674605-db6ffd4facb5",  # Training
                "https://images.unsplash.com/photo-1530549387789-4c1017266635",  # Swimming
                "https://images.unsplash.com/photo-1535131749006-b7f58c99034b",  # Golf
                "https://images.unsplash.com/photo-1461896836934-ffe607ba8211",  # Olympic
            ],
            "entertainment": [
                "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba",  # Cinema
                "https://images.unsplash.com/photo-1598899134739-24c46f58b8c0",  # Stage lights
                "https://images.unsplash.com/photo-1514525253161-7a46d19cd819",  # Concert
                "https://images.unsplash.com/photo-1485846234645-a62644f84728",  # Movie
                "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3",  # Show
                "https://images.unsplash.com/photo-1478720568477-152d9b164e26",  # Film reel
                "https://images.unsplash.com/photo-1440404653325-ab127d49abc1",  # Netflix
                "https://images.unsplash.com/photo-1536440136628-849c177e76a1",  # Cinema seats
                "https://images.unsplash.com/photo-1594909122845-11baa439b7bf",  # Popcorn
                "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c",  # Movie theater
            ],
            "gaming": [
                "https://images.unsplash.com/photo-1538481199705-c710c4e965fc",  # Gaming setup
                "https://images.unsplash.com/photo-1542751371-adc38448a05e",  # Esports
                "https://images.unsplash.com/photo-1511512578047-dfb367046420",  # Gaming controller
                "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8",  # Console
                "https://images.unsplash.com/photo-1509198397868-475647b2a1e5",  # VR gaming
                "https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf",  # RGB keyboard
                "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3",  # Gaming room
                "https://images.unsplash.com/photo-1625805866449-3589fe3f71a3",  # Gamer
            ],
            "music": [
                "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4",  # Guitar
                "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f",  # Concert
                "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae",  # Headphones
                "https://images.unsplash.com/photo-1470225620780-dba8ba36b745",  # DJ
                "https://images.unsplash.com/photo-1459749411175-04bf5292ceea",  # Piano
                "https://images.unsplash.com/photo-1510915361894-db8b60106cb1",  # DJ controller
                "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad",  # Singing
                "https://images.unsplash.com/photo-1507838153414-b4b713384a76",  # Sheet music
                "https://images.unsplash.com/photo-1477233534935-f5e6fe7c1159",  # Violin
                "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0",  # Piano keys
            ],
            "business": [
                "https://images.unsplash.com/photo-1444653614773-995cb1ef9efa",  # Office
                "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab",  # Skyscraper
                "https://images.unsplash.com/photo-1507679799987-c73779587ccf",  # Suit
                "https://images.unsplash.com/photo-1460925895917-afdab827c52f",  # Analytics
                "https://images.unsplash.com/photo-1556761175-4b46a572b786",  # Meeting
                "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40",  # Laptop work
                "https://images.unsplash.com/photo-1573164713988-8665fc963095",  # Team meeting
                "https://images.unsplash.com/photo-1553877522-43269d4ea984",  # Charts
                "https://images.unsplash.com/photo-1542744173-8e7e53415bb0",  # Presentation
            ],
            "healthcare": [
                "https://images.unsplash.com/photo-1576091160399-112ba8d25d1f",  # Medical
                "https://images.unsplash.com/photo-1559757175-7b21e7862a56",  # Hospital
                "https://images.unsplash.com/photo-1530026405186-ed1f139313f8",  # Stethoscope
                "https://images.unsplash.com/photo-1579684385127-1ef15d508118",  # DNA
                "https://images.unsplash.com/photo-1551076805-e1869033e561",  # Pills
                "https://images.unsplash.com/photo-1584515933487-779824d29309",  # Doctor
                "https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7",  # Doctor consult
            ],
            "science": [
                "https://images.unsplash.com/photo-1507413245164-6160d8298b31",  # Laboratory
                "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa",  # Space NASA
                "https://images.unsplash.com/photo-1451187580459-43490279c0fa",  # Globe data
                "https://images.unsplash.com/photo-1462331940025-496dfbfc7564",  # Nebula
                "https://images.unsplash.com/photo-1532094349884-543bc11b234d",  # DNA helix
                "https://images.unsplash.com/photo-1576086213369-97a306d36557",  # Microscope
                "https://images.unsplash.com/photo-1614935151651-0bea6508db6b",  # Space shuttle
                "https://images.unsplash.com/photo-1581093458791-9d42e3c8e3bd",  # Physics
            ],
            "art": [
                "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5",  # Gallery
                "https://images.unsplash.com/photo-1547891654-e66ed7ebb968",  # Painting
                "https://images.unsplash.com/photo-1561214115-f2f134cc4912",  # Abstract
                "https://images.unsplash.com/photo-1513364776144-60967b0f800f",  # Creative
                "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b",  # Art studio
                "https://images.unsplash.com/photo-1499892477393-f675706cbe6e",  # Brush
                "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9",  # Sculpture
                "https://images.unsplash.com/photo-1541961017774-22349e4a1262",  # Artist
            ],
            "food": [
                "https://images.unsplash.com/photo-1504674900247-0877df9cc836",  # Gourmet
                "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327",  # Food platter
                "https://images.unsplash.com/photo-1414235077428-338989a2e8c0",  # Fine dining
                "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38",  # Pizza
                "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe",  # Colorful food
                "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445",  # Pancakes
                "https://images.unsplash.com/photo-1555939594-58d7cb561ad1",  # BBQ
            ],
            "travel": [
                "https://images.unsplash.com/photo-1488646953014-85cb44e25828",  # Travel bag
                "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800",  # Road trip
                "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1",  # Lake mountain
                "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",  # Beach
                "https://images.unsplash.com/photo-1530789253388-582c481c54b0",  # Adventure
                "https://images.unsplash.com/photo-1501785888041-af3ef285b470",  # Landscape
            ],
            "education": [
                "https://images.unsplash.com/photo-1503676260728-1c00da094a0b",  # Classroom
                "https://images.unsplash.com/photo-1523050854058-8df90110c476",  # Books
                "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8",  # Study
                "https://images.unsplash.com/photo-1434030216411-0b793f4b4173",  # Notes
                "https://images.unsplash.com/photo-1509062522246-3755977927d7",  # Students
                "https://images.unsplash.com/photo-1497633762265-9d179a990aa6",  # Books stack
            ],
            "lifestyle": [
                "https://images.unsplash.com/photo-1484154218962-a197022b5858",  # Home interior
                "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136",  # Modern home
                "https://images.unsplash.com/photo-1513694203232-719a280e022f",  # Cozy room
                "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92",  # Home design
                "https://images.unsplash.com/photo-1558618666-fcd25c85f82e",  # DIY tools
                "https://images.unsplash.com/photo-1450778869180-41d0601e046e",  # Pets dog
            ],
            "general": [
                "https://images.unsplash.com/photo-1504384308090-c894fdcc538d",  # Workspace
                "https://images.unsplash.com/photo-1557804506-669a67965ba0",  # Creative desk
                "https://images.unsplash.com/photo-1497215728101-856f4ea42174",  # Modern office
                "https://images.unsplash.com/photo-1521737604893-d14cc237f11d",  # Team
                "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4",  # Discussion
                "https://images.unsplash.com/photo-1498050108023-c5249f4df085",  # Mac keyboard
                "https://images.unsplash.com/photo-1496181133206-80ce9b88a853",  # Laptop
                "https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a",  # Coffee work
                "https://images.unsplash.com/photo-1522202176988-66273c2fd55f",  # Collaboration
                "https://images.unsplash.com/photo-1516321318423-f06f85e504b3",  # Meeting room
            ]
        }
        
        # Normalize category to lowercase
        cat = category.lower().strip() if category else "general"
        
        # Map EXACT interest strings from INTEREST_CATEGORIES to image categories
        # These are the actual values that come through as category from RSS
        category_map = {
            # Sports subcategories
            "cricket": "cricket",
            "football": "football",
            "tennis": "tennis",
            "basketball": "basketball",
            "formula 1": "formula1",
            "badminton": "sports",
            "athletics": "sports",
            # Technology subcategories
            "artificial intelligence": "technology",
            "cybersecurity": "technology",
            "gadgets": "technology",
            "software": "technology",
            "cloud computing": "technology",
            "blockchain": "technology",
            # Entertainment subcategories
            "movies": "entertainment",
            "tv shows": "entertainment",
            "bollywood": "entertainment",
            "hollywood": "entertainment",
            "anime": "entertainment",
            "web series": "entertainment",
            # Gaming subcategories
            "video games": "gaming",
            "esports": "gaming",
            "mobile gaming": "gaming",
            "pc gaming": "gaming",
            "console gaming": "gaming",
            # Music subcategories
            "pop music": "music",
            "hip hop": "music",
            "bollywood music": "music",
            "classical": "music",
            "rock": "music",
            "electronic": "music",
            # Business & Finance subcategories
            "startups": "business",
            "stock market": "business",
            "cryptocurrency": "business",
            "investing": "business",
            "economy": "business",
            "entrepreneurship": "business",
            # Science subcategories
            "space exploration": "science",
            "astrophysics": "science",
            "environmental science": "science",
            "biology": "science",
            "physics": "science",
            # Health & Wellness subcategories
            "fitness": "healthcare",
            "nutrition": "healthcare",
            "mental health": "healthcare",
            "yoga": "healthcare",
            "medical research": "healthcare",
            # Art & Culture subcategories
            "photography": "art",
            "literature": "art",
            "fashion": "art",
            "history": "art",
            "design": "art",
            "architecture": "art",
            # Food & Travel subcategories
            "cooking": "food",
            "street food": "food",
            "travel destinations": "travel",
            "food reviews": "food",
            "adventure travel": "travel",
            # Education subcategories
            "language learning": "education",
            "online courses": "education",
            "career development": "education",
            "study tips": "education",
            "scholarships": "education",
            # Lifestyle subcategories
            "diy/home improvement": "lifestyle",
            "home design": "lifestyle",
            "volunteering": "lifestyle",
            "podcasts": "lifestyle",
            "pets": "lifestyle",
        }
        
        # Find matching category
        if cat in category_map:
            cat = category_map[cat]
        elif cat not in category_images:
            cat = "general"
        
        # Get images for this category
        images = category_images.get(cat, category_images["general"])
        
        # Select image based purely on title hash for consistency
        # Each unique title will always get the same image
        title_hash = int(hashlib.md5(title.encode()).hexdigest()[:8], 16)
        idx = title_hash % len(images)
        
        # Use Unsplash's image transformation for consistent size
        base_url = images[idx]
        url = f"{base_url}?w=800&h=400&fit=crop"
        
        logger.info(f"[IMAGE-GEN] Category: '{cat}' -> Selected image {idx+1}/{len(images)}")
        logger.info(f"[IMAGE-GEN] URL: {url[:60]}...")
        
        return url

    def _enrich_topics(self, topics: List[Dict]) -> List[Dict]:
        """Validate and enrich topic data"""
        platform_icons = {
            "linkedin": "Linkedin",
            "twitter": "Twitter", 
            "instagram": "Instagram",
            "facebook": "Facebook"
        }
        
        enriched = []
        logger.info(f"[ENRICH] Starting to enrich {len(topics)} topics")
        
        for i, topic in enumerate(topics):
            title = topic.get("title", "Trending Topic")[:80]
            category = topic.get("category", "General")
            logger.info(f"[ENRICH] Topic {i+1}: '{title}' (Category: {category})")
            
            # Generate image URL based on category (more reliable than title)
            image_url = self._get_category_image_url(category, title)
            logger.info(f"[ENRICH] Topic {i+1} imageUrl: {image_url[:60] if image_url else 'None'}...")

            enriched_topic = {
                "id": topic.get("id", f"trend_{i+1}"),
                "title": title,
                "summary": topic.get("summary", ""),
                "category": category,
                "sourceUrl": topic.get("sourceUrl", ""),  # Original news article link
                "platformId": topic.get("platformId", "linkedin"),
                "metrics": topic.get("metrics", {
                    "likes": "10K",
                    "comments": "1K", 
                    "shares": "500"
                }),
                "imageUrl": image_url,
                "hashtags": topic.get("hashtags", []),
                "icon": platform_icons.get(topic.get("platformId", "linkedin"), "Zap")
            }
            enriched.append(enriched_topic)
        
        logger.info(f"[ENRICH] Completed enriching {len(enriched)} topics")
        return enriched
