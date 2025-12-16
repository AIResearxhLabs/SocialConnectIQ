"""
Content Refinement Agent - AI-powered content enhancement
Uses OpenAI GPT-4o to refine and optimize social media content
"""
import logging
from typing import Dict, Any, Optional, List
from openai import AsyncOpenAI
import time

logger = logging.getLogger(__name__)


class ContentRefinementAgent:
    """
    AI agent for refining social media content
    Uses LLM to enhance clarity, engagement, and platform-specific optimization
    """
    
    def __init__(self, openai_api_key: str, model: str = "gpt-4o"):
        """
        Initialize Content Refinement Agent
        
        Args:
            openai_api_key: OpenAI API key
            model: OpenAI model to use (default: gpt-4o)
        """
        self.client = AsyncOpenAI(api_key=openai_api_key)
        self.model = model
        
        # Platform-specific constraints
        self.platform_limits = {
            "linkedin": {
                "max_length": 3000,
                "optimal_length": 150,
                "best_practices": [
                    "Use professional tone",
                    "Add relevant hashtags (3-5)",
                    "Include call-to-action",
                    "Structure with line breaks"
                ]
            },
            "twitter": {
                "max_length": 280,
                "optimal_length": 100,
                "best_practices": [
                    "Be concise and impactful",
                    "Use 1-2 relevant hashtags",
                    "Consider thread if longer",
                    "Add emojis for engagement"
                ]
            },
            "facebook": {
                "max_length": 63206,
                "optimal_length": 200,
                "best_practices": [
                    "Engage with storytelling",
                    "Ask questions to drive comments",
                    "Use emojis strategically",
                    "Keep paragraphs short"
                ]
            }
        }
        
        # Tone presets
        self.tone_prompts = {
            "professional": "professional, polished, and business-appropriate",
            "casual": "casual, friendly, and conversational",
            "humorous": "light-hearted, engaging, and humorous",
            "enthusiastic": "energetic, passionate, and enthusiastic",
            "informative": "clear, educational, and informative",
            "neutral": "balanced, objective, and neutral"
        }
    
    async def refine_content(
        self,
        original_content: str,
        user_id: str,
        correlation_id: str = "unknown",
        tone: Optional[str] = None,
        platform: Optional[str] = None,
        refinement_instructions: Optional[str] = None,
        generate_alternatives: bool = False
    ) -> Dict[str, Any]:
        """
        Refine content using LLM
        
        Args:
            original_content: User's original thought/content
            user_id: User identifier
            correlation_id: Request correlation ID for tracing
            tone: Desired tone (professional, casual, humorous, etc.)
            platform: Target platform (linkedin, twitter, facebook)
            refinement_instructions: Specific instructions for refinement
            generate_alternatives: Whether to generate alternative versions
            
        Returns:
            Dict containing refined content, suggestions, and metadata
        """
        start_time = time.time()
        
        logger.info(
            f"ContentAgent: Starting content refinement | "
            f"correlation_id={correlation_id} | user_id={user_id} | "
            f"tone={tone} | platform={platform}"
        )
        
        try:
            # Build system prompt
            system_prompt = self._build_system_prompt(tone, platform)
            
            # Build user prompt
            user_prompt = self._build_user_prompt(
                original_content,
                tone,
                platform,
                refinement_instructions
            )
            
            logger.info(
                f"ContentAgent: Calling OpenAI API | "
                f"correlation_id={correlation_id} | model={self.model}"
            )
            
            # Call OpenAI API
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,
                max_tokens=1000
            )
            
            refined_content = response.choices[0].message.content.strip()
            
            elapsed = time.time() - start_time
            
            logger.info(
                f"ContentAgent: Refinement completed | "
                f"correlation_id={correlation_id} | elapsed={elapsed:.2f}s | "
                f"original_length={len(original_content)} | "
                f"refined_length={len(refined_content)}"
            )
            
            # Generate platform-specific suggestions
            suggestions = self._generate_suggestions(
                refined_content,
                platform
            )
            
            # Generate alternatives if requested
            alternatives = []
            if generate_alternatives:
                alternatives = await self._generate_alternatives(
                    original_content,
                    tone,
                    platform,
                    correlation_id
                )
            
            return {
                "success": True,
                "refined_content": refined_content,
                "suggestions": suggestions,
                "alternatives": alternatives,
                "metadata": {
                    "original_length": len(original_content),
                    "refined_length": len(refined_content),
                    "processing_time": elapsed,
                    "model": self.model,
                    "tone": tone,
                    "platform": platform
                }
            }
            
        except Exception as e:
            logger.error(
                f"ContentAgent: Refinement failed | "
                f"correlation_id={correlation_id} | error={str(e)}"
            )
            
            return {
                "success": False,
                "error": str(e),
                "refined_content": original_content,  # Fallback to original
                "suggestions": ["An error occurred during refinement. Please try again."]
            }
    
    def _build_system_prompt(
        self,
        tone: Optional[str],
        platform: Optional[str]
    ) -> str:
        """Build system prompt for LLM"""
        
        tone_desc = self.tone_prompts.get(tone, "clear and engaging")
        
        system_prompt = f"""You are an expert social media content writer and editor.
Your task is to refine and enhance user-provided content for social media posts.

Guidelines:
1. Maintain the user's core message and intent
2. Use a {tone_desc} tone
3. Improve clarity, grammar, and flow
4. Make the content more engaging and impactful
5. Keep it concise yet meaningful"""
        
        # Add platform-specific guidelines
        if platform and platform in self.platform_limits:
            limits = self.platform_limits[platform]
            system_prompt += f"""
6. Platform: {platform.title()}
   - Optimal length: {limits['optimal_length']} characters
   - Maximum length: {limits['max_length']} characters
   - Best practices: {', '.join(limits['best_practices'])}"""
        
        system_prompt += """

Return ONLY the refined content without any explanations, meta-commentary, or quotation marks."""
        
        return system_prompt
    
    def _build_user_prompt(
        self,
        original_content: str,
        tone: Optional[str],
        platform: Optional[str],
        refinement_instructions: Optional[str]
    ) -> str:
        """Build user prompt with content and instructions"""
        
        user_prompt = f"Original content:\n{original_content}\n\n"
        
        if refinement_instructions:
            user_prompt += f"Additional instructions: {refinement_instructions}\n\n"
        
        user_prompt += "Please refine this content to make it more engaging and impactful"
        
        if platform:
            user_prompt += f" for {platform}"
        
        user_prompt += "."
        
        return user_prompt
    
    def _generate_suggestions(
        self,
        content: str,
        platform: Optional[str]
    ) -> List[str]:
        """Generate helpful suggestions based on content and platform"""
        
        suggestions = []
        content_length = len(content)
        
        # Platform-specific suggestions
        if platform and platform in self.platform_limits:
            limits = self.platform_limits[platform]
            
            if content_length > limits["max_length"]:
                suggestions.append(
                    f"⚠️ Content exceeds {platform} maximum length "
                    f"({content_length}/{limits['max_length']} characters)"
                )
            elif content_length > limits["optimal_length"] * 2:
                suggestions.append(
                    f"💡 Consider shortening for better engagement "
                    f"(current: {content_length}, optimal: ~{limits['optimal_length']} chars)"
                )
        
        # Check for hashtags
        if platform in ["linkedin", "twitter", "facebook"]:
            if "#" not in content:
                suggestions.append(
                    "🔖 Consider adding relevant hashtags to increase discoverability"
                )
        
        # Check for emojis (platform-dependent)
        if platform in ["twitter", "facebook"]:
            # Simple emoji check (not exhaustive)
            has_emoji = any(ord(char) > 127 for char in content)
            if not has_emoji:
                suggestions.append(
                    "😊 Adding emojis can increase engagement on this platform"
                )
        
        # General suggestions
        if content_length < 50:
            suggestions.append(
                "📝 Content seems brief. Consider adding more context or details."
            )
        
        if suggestions:
            return suggestions
        else:
            return ["✅ Content looks great! Ready to post."]
    
    async def _generate_alternatives(
        self,
        original_content: str,
        tone: Optional[str],
        platform: Optional[str],
        correlation_id: str
    ) -> List[str]:
        """Generate alternative versions of the content"""
        
        try:
            logger.info(
                f"ContentAgent: Generating alternatives | "
                f"correlation_id={correlation_id}"
            )
            
            system_prompt = """You are an expert social media content writer.
Generate 2 alternative versions of the provided content with different approaches.
Each version should maintain the core message but vary in style or emphasis.
Return each version on a new line, numbered 1. and 2."""
            
            user_prompt = f"Original content:\n{original_content}\n\n"
            user_prompt += "Generate 2 alternative versions of this content."
            
            if tone:
                user_prompt += f" Maintain a {tone} tone."
            if platform:
                user_prompt += f" Optimize for {platform}."
            
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.8,
                max_tokens=800
            )
            
            alternatives_text = response.choices[0].message.content.strip()
            
            # Parse alternatives (expecting numbered list)
            alternatives = []
            for line in alternatives_text.split('\n'):
                line = line.strip()
                if line and (line.startswith('1.') or line.startswith('2.')):
                    # Remove number prefix
                    alt = line[2:].strip()
                    if alt:
                        alternatives.append(alt)
            
            logger.info(
                f"ContentAgent: Generated {len(alternatives)} alternatives | "
                f"correlation_id={correlation_id}"
            )
            
            return alternatives
            
        except Exception as e:
            logger.error(
                f"ContentAgent: Failed to generate alternatives | "
                f"correlation_id={correlation_id} | error={str(e)}"
            )
            return []
