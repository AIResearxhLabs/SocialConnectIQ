"""
LinkedIn OAuth Agent using LangGraph
Implements stateful OAuth workflow with AI-powered decision making
"""
import logging
from typing import Dict, Any, TypedDict, Annotated, Sequence
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from .mcp_client import MCPClient
from .config import settings

logger = logging.getLogger(__name__)


class LinkedInAgentState(TypedDict):
    """State for LinkedIn OAuth workflow"""
    user_id: str
    action: str  # 'get_auth_url', 'handle_callback', 'post_content'
    code: str | None  # OAuth authorization code
    content: str | None  # Content to post
    access_token: str | None  # LinkedIn access token
    auth_url: str | None  # OAuth authorization URL
    state: str | None  # OAuth state parameter
    result: Dict[str, Any] | None  # Final result
    error: str | None  # Error message if any
    messages: Annotated[Sequence[HumanMessage | AIMessage | SystemMessage], "messages"]


class LinkedInOAuthAgent:
    """AI Agent for managing LinkedIn OAuth workflow"""
    
    def __init__(self, mcp_client: MCPClient, openai_api_key: str):
        self.mcp_client = mcp_client
        self.llm = ChatOpenAI(
            model=settings.openai.model,
            temperature=settings.openai.temperature,
            api_key=openai_api_key
        )
        self.graph = self._build_graph()
    
    def _build_graph(self) -> StateGraph:
        """Build the LangGraph state machine"""
        workflow = StateGraph(LinkedInAgentState)
        
        # Add nodes
        workflow.add_node("analyze_request", self._analyze_request)
        workflow.add_node("get_auth_url", self._get_auth_url)
        workflow.add_node("handle_callback", self._handle_callback)
        workflow.add_node("post_content", self._post_content)
        workflow.add_node("finalize", self._finalize)
        
        # Define edges
        workflow.set_entry_point("analyze_request")
        
        # Conditional routing based on action
        workflow.add_conditional_edges(
            "analyze_request",
            self._route_action,
            {
                "get_auth_url": "get_auth_url",
                "handle_callback": "handle_callback",
                "post_content": "post_content",
                "error": "finalize"
            }
        )
        
        # All actions lead to finalize
        workflow.add_edge("get_auth_url", "finalize")
        workflow.add_edge("handle_callback", "finalize")
        workflow.add_edge("post_content", "finalize")
        workflow.add_edge("finalize", END)
        
        return workflow.compile()
    
    async def _analyze_request(self, state: LinkedInAgentState) -> LinkedInAgentState:
        """Analyze the request and determine the action"""
        logger.info(f"Analyzing request for user: {state['user_id']}, action: {state['action']}")
        
        # Use AI to validate and enhance the request
        prompt = ChatPromptTemplate.from_messages([
            SystemMessage(content="""You are an AI agent that manages LinkedIn OAuth workflows.
            Analyze the user's request and validate that all required parameters are present.
            Return 'valid' if the request can proceed, or explain what's missing."""),
            HumanMessage(content=f"""
            Action: {state['action']}
            User ID: {state['user_id']}
            OAuth Code: {state.get('code', 'Not provided')}
            Access Token: {state.get('access_token', 'Not provided')}
            Content: {state.get('content', 'Not provided')}
            
            Is this request valid for the specified action?
            """)
        ])
        
        try:
            response = await self.llm.ainvoke(prompt.format_messages())
            logger.info(f"AI Analysis: {response.content}")
            
            state["messages"] = [
                SystemMessage(content="LinkedIn OAuth workflow initialized"),
                HumanMessage(content=f"Requested action: {state['action']}"),
                AIMessage(content=response.content)
            ]
            
        except Exception as e:
            logger.error(f"Error in AI analysis: {str(e)}")
            state["error"] = f"AI analysis failed: {str(e)}"
        
        return state
    
    def _route_action(self, state: LinkedInAgentState) -> str:
        """Route to appropriate action based on state"""
        if state.get("error"):
            return "error"
        
        action = state.get("action", "").lower()
        if action == "get_auth_url":
            return "get_auth_url"
        elif action == "handle_callback":
            return "handle_callback"
        elif action == "post_content":
            return "post_content"
        else:
            state["error"] = f"Unknown action: {action}"
            return "error"
    
    async def _get_auth_url(self, state: LinkedInAgentState) -> LinkedInAgentState:
        """Get LinkedIn OAuth authorization URL from MCP server with correlation tracking"""
        correlation_id = state.get("correlation_id", "unknown")
        
        logger.info(
            f"LinkedInAgent: Executing get_auth_url node | "
            f"correlation_id={correlation_id} | user_id={state['user_id']}"
        )
        
        try:
            # Call MCP client with correlation_id
            result = await self.mcp_client.get_linkedin_auth_url(
                state["user_id"],
                correlation_id
            )
            
            state["auth_url"] = result.get("auth_url") or result.get("authUrl") or result.get("authorizationUrl")
            state["state"] = result.get("state")
            
            # If state not returned separately, extract it from the auth URL
            if not state["state"] and state["auth_url"]:
                from urllib.parse import urlparse, parse_qs
                parsed_url = urlparse(state["auth_url"])
                query_params = parse_qs(parsed_url.query)
                extracted_state = query_params.get('state', [None])[0]
                if extracted_state:
                    state["state"] = extracted_state
                    logger.info(
                        f"LinkedInAgent: Extracted state from auth URL | "
                        f"correlation_id={correlation_id} | state={extracted_state[:12]}...{extracted_state[-12:]}"
                    )
            
            state["result"] = result
            
            logger.info(
                f"LinkedInAgent: Auth URL obtained successfully | "
                f"correlation_id={correlation_id} | has_auth_url={bool(state['auth_url'])} | "
                f"has_state={bool(state['state'])}"
            )
            
        except Exception as e:
            logger.error(
                f"LinkedInAgent: Failed to get auth URL | "
                f"correlation_id={correlation_id} | error={str(e)}"
            )
            state["error"] = str(e)
        
        return state
    
    async def _handle_callback(self, state: LinkedInAgentState) -> LinkedInAgentState:
        """Handle LinkedIn OAuth callback and exchange code for tokens"""
        logger.info(f"Handling LinkedIn callback for user: {state['user_id']}")
        
        if not state.get("code"):
            state["error"] = "OAuth code is required for callback handling"
            return state
        
        try:
            # Call MCP server to exchange code for tokens
            result = await self.mcp_client.handle_linkedin_callback(
                code=state["code"],
                user_id=state["user_id"]
            )
            
            state["access_token"] = result.get("access_token") or result.get("accessToken")
            state["result"] = result
            
            logger.info(f"Successfully exchanged code for tokens")
            
        except Exception as e:
            logger.error(f"Error handling callback: {str(e)}")
            state["error"] = str(e)
        
        return state
    
    async def _post_content(self, state: LinkedInAgentState) -> LinkedInAgentState:
        """Post content to LinkedIn"""
        logger.info(f"Posting content to LinkedIn for user: {state['user_id']}")
        
        if not state.get("content"):
            state["error"] = "Content is required for posting"
            return state
        
        if not state.get("access_token"):
            state["error"] = "Access token is required for posting"
            return state
        
        try:
            # Call MCP server to post content
            result = await self.mcp_client.post_to_linkedin(
                content=state["content"],
                access_token=state["access_token"],
                user_id=state["user_id"]
            )
            
            state["result"] = result
            
            logger.info(f"Successfully posted content to LinkedIn")
            
        except Exception as e:
            logger.error(f"Error posting to LinkedIn: {str(e)}")
            state["error"] = str(e)
        
        return state
    
    async def _finalize(self, state: LinkedInAgentState) -> LinkedInAgentState:
        """Finalize the workflow and prepare the result"""
        logger.info("Finalizing LinkedIn OAuth workflow")
        
        if state.get("error"):
            logger.error(f"Workflow completed with error: {state['error']}")
        else:
            logger.info("Workflow completed successfully")
        
        return state
    
    async def execute(self, initial_state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the LinkedIn OAuth workflow
        Args:
            initial_state: Initial state containing action and parameters
        Returns: Final state with result or error
        """
        logger.info(f"Starting LinkedIn OAuth workflow: {initial_state.get('action')}")
        
        # Initialize state with messages
        initial_state["messages"] = []
        
        try:
            # Run the graph
            final_state = await self.graph.ainvoke(initial_state)
            
            # Return result
            return {
                "success": not bool(final_state.get("error")),
                "result": final_state.get("result"),
                "error": final_state.get("error"),
                "auth_url": final_state.get("auth_url"),
                "state": final_state.get("state")
            }
            
        except Exception as e:
            logger.error(f"Workflow execution failed: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
