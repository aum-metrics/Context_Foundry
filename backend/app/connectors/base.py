# backend/app/connectors/base.py
"""
Base Database Connector
Abstract base class for all database connectors
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional
import pandas as pd
from dataclasses import dataclass
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

@dataclass
class ConnectionConfig:
    """Database connection configuration"""
    host: str
    port: int
    database: str
    username: str
    password: str
    ssl: bool = False
    timeout: int = 30
    additional_params: Dict[str, Any] = None

@dataclass
class ConnectionStatus:
    """Connection status information"""
    connected: bool
    message: str
    latency_ms: Optional[float] = None
    server_version: Optional[str] = None
    timestamp: str = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow().isoformat()

class BaseDatabaseConnector(ABC):
    """
    Abstract base class for database connectors
    All database connectors must inherit from this class
    """
    
    def __init__(self, config: ConnectionConfig):
        self.config = config
        self.connection = None
        self.is_connected = False
        self.connector_type = "base"
        self.connector_name = "Base Connector"
        
    @abstractmethod
    def connect(self) -> ConnectionStatus:
        """
        Establish connection to the database
        Returns ConnectionStatus with connection details
        """
        pass
    
    @abstractmethod
    def disconnect(self) -> bool:
        """
        Close the database connection
        Returns True if successful
        """
        pass
    
    @abstractmethod
    def test_connection(self) -> ConnectionStatus:
        """
        Test the database connection without keeping it open
        Returns ConnectionStatus
        """
        pass
    
    @abstractmethod
    def execute_query(self, query: str, params: Optional[Dict[str, Any]] = None) -> pd.DataFrame:
        """
        Execute a SQL query and return results as DataFrame
        
        Args:
            query: SQL query string
            params: Optional query parameters for parameterized queries
            
        Returns:
            DataFrame with query results
        """
        pass
    
    @abstractmethod
    def get_tables(self) -> List[str]:
        """
        Get list of all tables in the database
        Returns list of table names
        """
        pass
    
    @abstractmethod
    def get_table_schema(self, table_name: str) -> List[Dict[str, Any]]:
        """
        Get schema information for a specific table
        
        Args:
            table_name: Name of the table
            
        Returns:
            List of column definitions with name, type, nullable, etc.
        """
        pass
    
    @abstractmethod
    def get_table_preview(self, table_name: str, limit: int = 100) -> pd.DataFrame:
        """
        Get preview of table data
        
        Args:
            table_name: Name of the table
            limit: Number of rows to return
            
        Returns:
            DataFrame with sample data
        """
        pass
    
    def get_table_row_count(self, table_name: str) -> int:
        """
        Get total row count for a table
        
        Args:
            table_name: Name of the table
            
        Returns:
            Number of rows
        """
        try:
            query = f"SELECT COUNT(*) as count FROM {table_name}"
            result = self.execute_query(query)
            return int(result.iloc[0]['count'])
        except Exception as e:
            logger.error(f"Failed to get row count for {table_name}: {e}")
            return 0
    
    def validate_query(self, query: str) -> Dict[str, Any]:
        """
        Validate SQL query syntax
        
        Args:
            query: SQL query to validate
            
        Returns:
            Dict with validation result
        """
        # Basic validation
        query_lower = query.lower().strip()
        
        # Check for dangerous operations
        dangerous_keywords = ['drop', 'delete', 'truncate', 'alter', 'create', 'insert', 'update']
        for keyword in dangerous_keywords:
            if keyword in query_lower:
                return {
                    'valid': False,
                    'error': f'Query contains dangerous keyword: {keyword}',
                    'suggestion': 'Only SELECT queries are allowed'
                }
        
        # Check if it's a SELECT query
        if not query_lower.startswith('select'):
            return {
                'valid': False,
                'error': 'Query must start with SELECT',
                'suggestion': 'Only SELECT queries are allowed'
            }
        
        return {
            'valid': True,
            'message': 'Query syntax looks valid'
        }
    
    def __enter__(self):
        """Context manager entry"""
        self.connect()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.disconnect()
