"""Quick test to verify Google News RSS feed output for different interests"""
import urllib.request
import xml.etree.ElementTree as ET
from html import unescape
import re

def fetch_news(interest, max_items=5):
    query = urllib.request.quote(interest)
    url = f"https://news.google.com/rss/search?q={query}&hl=en-IN&gl=IN&ceid=IN:en"
    
    print(f"\n{'='*60}")
    print(f"INTEREST: '{interest}'")
    print(f"URL: {url}")
    print(f"{'='*60}")
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            xml_data = response.read().decode('utf-8')
        
        root = ET.fromstring(xml_data)
        channel = root.find('channel')
        items = channel.findall('item')[:max_items]
        
        print(f"Found {len(items)} articles:\n")
        for i, item in enumerate(items):
            title = unescape(item.find('title').text) if item.find('title') is not None else "No title"
            pubdate = item.find('pubDate').text if item.find('pubDate') is not None else "No date"
            link = item.find('link').text if item.find('link') is not None else ""
            print(f"{i+1}. {title}")
            print(f"   Date: {pubdate}")
            print()
    except Exception as e:
        print(f"ERROR: {e}")

# Test with different queries
fetch_news("Sports")
fetch_news("Cricket T20 World Cup 2026")
fetch_news("Cricket")
