# backend/app/connectors/postgres.py
"""
PostgreSQL Database Connector
Production-ready connector for PostgreSQL databases
"""

import pandas as pd
from typing import Dict, List, Any, Optional
import logging
import time

try:
    import psycopg2
    from psycopg2 import sql
    from psycopg2.extras import RealDictCursor
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False

from app.connectors.base import BaseDatabaseConnector, ConnectionConfig, ConnectionStatus

logger = logging.getLogger(__name__)

class PostgreSQLConnector(BaseDatabaseConnector):
    """PostgreSQL database connector"""
    
    def __init__(self, config: ConnectionConfig):
        super().__init__(config)
        self.connector_type = "postgresql"
        self.connector_name = "PostgreSQL"
        
        if not PSYCOPG2_AVAILABLE:
            raise ImportError("psycopg2 is required for PostgreSQL connections. Install with: pip install psycopg2-binary")
    
    def connect(self) -> ConnectionStatus:
        """Establish connection to PostgreSQL"""
        try:
            start_time = time.time()
            
            conn_params = {
                'host': self.config.host,
                'port': self.config.port,
                'database': self.config.database,
                'user': self.config.username,
                'password': self.config.password,
                'connect_timeout': self.config.timeout
            }
            
            if self.config.ssl:
                conn_params['sslmode'] = 'require'
            
            if self.config.additional_params:
                conn_params.update(self.config.additional_params)
            
            self.connection = psycopg2.connect(**conn_params)
            self.is_connected = True
            
            latency = (time.time() - start_time) * 1000
            
            # Get server version
            cursor = self.connection.cursor()
            cursor.execute("SELECT version()")
            version = cursor.fetchone()[0]
            cursor.close()
            
            logger.info(f"✅ Connected to PostgreSQL: {self.config.host}:{self.config.port}/{self.config.database}")
            
            return ConnectionStatus(
                connected=True,
                message="Successfully connected to PostgreSQL",
                latency_ms=latency,
                server_version=version
            )
            
        except Exception as e:
            logger.error(f"Failed to connect to PostgreSQL: {e}")
            self.is_connected = False
            return ConnectionStatus(
                connected=False,
                message=f"Connection failed: {str(e)}"
            )
    
    def disconnect(self) -> bool:
        """Close PostgreSQL connection"""
        try:
            if self.connection:
                self.connection.close()
                self.is_connected = False
                logger.info("✅ Disconnected from PostgreSQL")
                return True
        except Exception as e:
            logger.error(f"Error disconnecting: {e}")
            return False
    
    def test_connection(self) -> ConnectionStatus:
        """Test PostgreSQL connection"""
        status = self.connect()
        if status.connected:
            self.disconnect()
        return status
    
    def execute_query(self, query: str, params: Optional[Dict[str, Any]] = None) -> pd.DataFrame:
        """Execute SQL query and return DataFrame"""
        if not self.is_connected:
            raise ConnectionError("Not connected to database. Call connect() first.")
        
        # Validate query
        validation = self.validate_query(query)
        if not validation['valid']:
            raise ValueError(validation['error'])
        
        try:
            df = pd.read_sql_query(query, self.connection, params=params)
            logger.info(f"✅ Query executed: {len(df)} rows returned")
            return df
        except Exception as e:
            logger.error(f"Query execution failed: {e}")
            raise
    
    def get_tables(self) -> List[str]:
        """Get list of all tables"""
        if not self.is_connected:
            raise ConnectionError("Not connected to database")
        
        query = """
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """
        
        try:
            cursor = self.connection.cursor()
            cursor.execute(query)
            tables = [row[0] for row in cursor.fetchall()]
            cursor.close()
            return tables
        except Exception as e:
            logger.error(f"Failed to get tables: {e}")
            return []
    
    def get_table_schema(self, table_name: str) -> List[Dict[str, Any]]:
        """Get table schema information"""
        if not self.is_connected:
            raise ConnectionError("Not connected to database")
        
        query = """
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default,
                character_maximum_length
            FROM information_schema.columns
            WHERE table_schema = 'public' 
            AND table_name = %s
            ORDER BY ordinal_position
        """
        
        try:
            cursor = self.connection.cursor(cursor_factory=RealDictCursor)
            cursor.execute(query, (table_name,))
            columns = []
            for row in cursor.fetchall():
                columns.append({
                    'name': row['column_name'],
                    'type': row['data_type'],
                    'nullable': row['is_nullable'] == 'YES',
                    'default': row['column_default'],
                    'max_length': row['character_maximum_length']
                })
            cursor.close()
            return columns
        except Exception as e:
            logger.error(f"Failed to get schema for {table_name}: {e}")
            return []
    
    def get_table_preview(self, table_name: str, limit: int = 100) -> pd.DataFrame:
        """Get preview of table data"""
        query = f"SELECT * FROM {table_name} LIMIT {limit}"
        return self.execute_query(query)
