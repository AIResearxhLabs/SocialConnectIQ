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
CACHE_DURATION_MINUTES = 30


class TrendingTopicsAgent:
    """
    AI agent for generating personalized trending topics.
    Uses GPT-4o to create engaging, relevant content based on user interests.
    Includes caching to optimize API costs.
    """
    
    def __init__(self, openai_api_key: str, model: str = "gpt-4o"):
        """
        Initialize Trending Topics Agent
        
        Args:
            openai_api_key: OpenAI API key
            model: OpenAI model to use (default: gpt-4o)
        """
        self.client = AsyncOpenAI(api_key=openai_api_key)
        self.model = model
        logger.info(f"TrendingTopicsAgent initialized with model: {model}")
    
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
            with urllib.request.urlopen(req, timeout=10) as response:
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
        # 10 images per category for maximum variety
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
            "sports": [
                "https://images.unsplash.com/photo-1461896836934- voices",  # Stadium (note: may be broken)
                "https://images.unsplash.com/photo-1579952363873-27f3bade9f55",  # Basketball
                "https://images.unsplash.com/photo-1574629810360-7efbbe195018",  # Soccer
                "https://images.unsplash.com/photo-1517649763962-0c623066013b",  # Running
                "https://images.unsplash.com/photo-1552674605-db6ffd4facb5",  # Training
                "https://images.unsplash.com/photo-1461896836934-ffe607ba8211",  # Running track
                "https://images.unsplash.com/photo-1546519638-68e109498ffc",  # Basketball court
                "https://images.unsplash.com/photo-1560272564-c83b66b1ad12",  # Tennis
                "https://images.unsplash.com/photo-1508098682722-e99c43a406b2",  # Football
                "https://images.unsplash.com/photo-1535131749006-b7f58c99034b",  # Golf
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
            "healthcare": [
                "https://images.unsplash.com/photo-1576091160399-112ba8d25d1f",  # Medical
                "https://images.unsplash.com/photo-1559757175-7b21e7862a56",  # Hospital
                "https://images.unsplash.com/photo-1530026405186-ed1f139313f8",  # Stethoscope
                "https://images.unsplash.com/photo-1579684385127-1ef15d508118",  # DNA
                "https://images.unsplash.com/photo-1551076805-e1869033e561",  # Pills
                "https://images.unsplash.com/photo-1584515933487-779824d29309",  # Doctor
                "https://images.unsplash.com/photo-1538108149393-fbbd81895907",  # Hospital bed
                "https://images.unsplash.com/photo-1581595220975-7c7b82c2d2a7",  # Lab
                "https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7",  # Doctor consult
                "https://images.unsplash.com/photo-1587854692152-cbe660dbde88",  # Pills bottle
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
                "https://images.unsplash.com/photo-1569172122301-bc5008bc09c5",  # Gallery wall
                "https://images.unsplash.com/photo-1482160549825-59d1b23cb208",  # Paint splatter
            ],
            "business": [
                "https://images.unsplash.com/photo-1444653614773-995cb1ef9efa",  # Office
                "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab",  # Skyscraper
                "https://images.unsplash.com/photo-1507679799987-c73779587ccf",  # Suit
                "https://images.unsplash.com/photo-1460925895917-afdab827c52f",  # Analytics
                "https://images.unsplash.com/photo-1556761175-4b46a572b786",  # Meeting
                "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40",  # Laptop work
                "https://images.unsplash.com/photo-1573164713988-8665fc963095",  # Team meeting
                "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d",  # Handshake
                "https://images.unsplash.com/photo-1553877522-43269d4ea984",  # Charts
                "https://images.unsplash.com/photo-1542744173-8e7e53415bb0",  # Presentation
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
        
        # Map common category variations
        category_map = {
            "tech": "technology", "ai": "technology", "science": "technology",
            "sport": "sports", "fitness": "sports", "gaming": "sports",
            "movie": "entertainment", "movies": "entertainment", "film": "entertainment", "cinema": "entertainment",
            "health": "healthcare", "medical": "healthcare", "medicine": "healthcare",
            "creative": "art", "design": "art", "artists": "art",
            "finance": "business", "economy": "business", "startup": "business",
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
