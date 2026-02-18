import random
from datetime import datetime, timedelta
from typing import List
from .models import AnalyticsOverview, PlatformStats, DailyTrend, AudienceMetrics, EngagementMetrics
from faker import Faker

fake = Faker()

def generate_mock_analytics() -> AnalyticsOverview:
    """Generate realistic mock analytics data for the dashboard"""
    
    # 1. Generate Platform Stats
    platforms = [
        {"id": "twitter", "name": "Twitter/X", "base_followers": 12500},
        {"id": "linkedin", "name": "LinkedIn", "base_followers": 8400},
        {"id": "instagram", "name": "Instagram", "base_followers": 15200}
    ]
    
    platform_stats = []
    total_followers = 0
    total_growth = 0
    
    for p in platforms:
        growth = random.randint(100, 500)
        followers = p["base_followers"] + growth
        total_followers += followers
        total_growth += growth
        
        platform_stats.append(PlatformStats(
            platform_id=p["id"],
            platform_name=p["name"],
            followers=followers,
            followers_growth=growth,
            engagement_rate=round(random.uniform(1.5, 4.5), 2),
            total_posts=random.randint(50, 150),
            top_post_id=f"post_{random.randint(1000, 9999)}"
        ))

    # 2. Generate Daily Trends (Last 30 Days)
    daily_trends = []
    current_date = datetime.now()
    base_trend_followers = total_followers - total_growth # Start from 30 days ago
    
    for i in range(30):
        date = (current_date - timedelta(days=29-i)).strftime("%Y-%m-%d")
        
        # Add some daily growth
        daily_growth = random.randint(5, 25) * len(platforms)
        base_trend_followers += daily_growth
        
        daily_trends.append(DailyTrend(
            date=date,
            followers_total=base_trend_followers,
            engagement_rate=round(random.uniform(2.0, 5.0) + (random.random() * 0.5), 2),
            impressions=random.randint(1000, 5000)
        ))

    # 3. Audience Metrics
    audience = AudienceMetrics(
        age_groups={"18-24": 0.15, "25-34": 0.45, "35-44": 0.25, "45+": 0.15},
        locations={"US": 0.40, "UK": 0.15, "IN": 0.20, "CA": 0.10, "Other": 0.15},
        gender_split={"Male": 0.52, "Female": 0.48}
    )

    return AnalyticsOverview(
        total_followers=total_followers,
        total_reach=sum(t.impressions for t in daily_trends),
        avg_engagement_rate=round(sum(p.engagement_rate for p in platform_stats) / len(platforms), 2),
        followers_growth_pct=round((total_growth / (total_followers - total_growth)) * 100, 1),
        last_updated=datetime.now(),
        platform_breakdown=platform_stats,
        daily_trends=daily_trends,
        audience=audience
    )
