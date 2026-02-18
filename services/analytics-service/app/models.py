from pydantic import BaseModel
from typing import List, Dict, Optional
from datetime import datetime

class AudienceMetrics(BaseModel):
    age_groups: Dict[str, float]  # e.g., {"18-24": 0.3, "25-34": 0.4}
    locations: Dict[str, float]   # e.g., {"US": 0.5, "IN": 0.2}
    gender_split: Dict[str, float] # e.g., {"Male": 0.55, "Female": 0.45}

class EngagementMetrics(BaseModel):
    likes: int
    comments: int
    shares: int
    saves: int
    clicks: int
    engagement_rate: float

class PlatformStats(BaseModel):
    platform_id: str
    platform_name: str
    followers: int
    followers_growth: int
    engagement_rate: float
    total_posts: int
    top_post_id: Optional[str] = None

class DailyTrend(BaseModel):
    date: str  # ISO format "YYYY-MM-DD"
    followers_total: int
    engagement_rate: float
    impressions: int

class AnalyticsOverview(BaseModel):
    total_followers: int
    total_reach: int
    avg_engagement_rate: float
    followers_growth_pct: float
    last_updated: datetime
    platform_breakdown: List[PlatformStats]
    daily_trends: List[DailyTrend]
    audience: AudienceMetrics
