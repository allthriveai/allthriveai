"""
FastMCP Client Factory
Creates FastMCP clients for different MCP servers (Figma, etc.)
"""

import logging

from fastmcp import Client

logger = logging.getLogger(__name__)


class MCPClientFactory:
    """Factory for creating FastMCP clients with proper configuration."""

    def __init__(self, mcp_servers_config: dict):
        """
        Initialize the factory with MCP server configurations.

        Args:
            mcp_servers_config: Dict with server configs like:
                {
                    "figma": {"transport": "http", "url": "...", "env": {...}}
                }
        """
        self.config = mcp_servers_config

    def create_figma_client(self, user_token: str | None = None) -> Client:
        """
        Create FastMCP client connected only to Figma MCP server.

        Args:
            user_token: Optional user-specific Figma token. If provided, overrides
                       the global token from config. Use this for per-user analysis.

        Returns:
            Client instance configured for Figma MCP server
        """
        logger.debug('Creating Figma MCP client')

        # Start with base config
        figma_config = self.config['figma'].copy()

        # Override with user token if provided
        if user_token:
            logger.debug('Using user-specific Figma token')
            figma_config['env'] = {'FIGMA_ACCESS_TOKEN': user_token}

        config = {'mcpServers': {'figma': figma_config}}
        return Client(config)

    def create_multi_server_client(self, *server_names: str) -> Client:
        """
        Create FastMCP client connected to multiple MCP servers.

        Args:
            *server_names: Names of servers to connect to (e.g., 'figma')

        Returns:
            Client instance configured for specified servers

        Example:
            client = factory.create_multi_server_client('figma')
        """
        logger.debug(f'Creating multi-server MCP client for: {server_names}')
        config = {'mcpServers': {}}

        for server_name in server_names:
            if server_name not in self.config:
                raise ValueError(f'Unknown MCP server: {server_name}')
            config['mcpServers'][server_name] = self.config[server_name]

        return Client(config)

    def get_available_servers(self) -> list[str]:
        """
        Get list of available MCP server names.

        Returns:
            List of server names configured in this factory
        """
        return list(self.config.keys())
