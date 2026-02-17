"""Test: Compare decode speed with different concurrency levels."""
import asyncio
import time
import urllib.request
import xml.etree.ElementTree as ET
from html import unescape
from concurrent.futures import ThreadPoolExecutor

OUT = open("decode_benchmark.txt", "w", encoding="utf-8")
def log(msg):
    print(msg, flush=True)
    OUT.write(msg + "\n")

def get_gnews_urls(queries=None, max_per=5):
    if queries is None:
        queries = ["Cricket", "Bollywood", "Technology", "Football", "Startups", "Movies"]
    all_urls = []
    for q in queries:
        query = urllib.request.quote(q)
        url = f"https://news.google.com/rss/search?q={query}&hl=en-IN&gl=IN&ceid=IN:en"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                xml_data = resp.read().decode('utf-8')
            root = ET.fromstring(xml_data)
            channel = root.find('channel')
            for item in channel.findall('item')[:max_per]:
                link = item.find('link')
                if link is not None and link.text:
                    all_urls.append(link.text)
        except:
            pass
    return all_urls

def decode_one(url):
    t0 = time.time()
    try:
        from googlenewsdecoder import new_decoderv1
        result = new_decoderv1(url, interval=1)
        elapsed = time.time() - t0
        ok = bool(result and result.get("status") and result.get("decoded_url"))
        return elapsed, ok
    except:
        return time.time() - t0, False

async def test_concurrency(urls, max_workers):
    loop = asyncio.get_running_loop()
    pool = ThreadPoolExecutor(max_workers=max_workers)
    sem = asyncio.Semaphore(max_workers)
    
    async def decode_limited(url):
        async with sem:
            return await loop.run_in_executor(pool, decode_one, url)
    
    t_start = time.time()
    results = await asyncio.gather(*[decode_limited(u) for u in urls])
    total = time.time() - t_start
    
    ok = sum(1 for _, s in results if s)
    avg_time = sum(t for t, _ in results) / len(results) if results else 0
    max_time = max(t for t, _ in results) if results else 0
    min_time = min(t for t, _ in results) if results else 0
    
    pool.shutdown(wait=False)
    return total, ok, avg_time, min_time, max_time

async def main():
    urls = get_gnews_urls(max_per=5)
    log(f"Got {len(urls)} URLs")
    
    for workers in [5, 10, 15, 30]:
        log(f"\n--- {workers} concurrent workers ---")
        total, ok, avg, mn, mx = await test_concurrency(urls[:30], workers)
        log(f"  TOTAL: {total:.1f}s | OK: {ok}/30 | avg={avg:.1f}s min={mn:.1f}s max={mx:.1f}s")
    
    OUT.close()

if __name__ == "__main__":
    asyncio.run(main())
