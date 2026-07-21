import sqlite3
import os
import json
from datetime import datetime

DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "market_data.db")

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def initialize_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Table for tracked/fetched daily dates
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS daily_bhavcopy_dates (
            date TEXT PRIMARY KEY,
            fetched_at TEXT
        )
    """)
    
    # 2. Table for daily stocks traded information
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS daily_stocks (
            date TEXT,
            symbol TEXT,
            series TEXT,
            prev_close REAL,
            open_price REAL,
            high_price REAL,
            low_price REAL,
            last_price REAL,
            close_price REAL,
            avg_price REAL,
            volume INTEGER,
            turnover REAL,
            trades INTEGER,
            deliverable_qty INTEGER,
            deliverable_pct REAL,
            price_band TEXT,
            PRIMARY KEY (date, symbol, series)
        )
    """)
    
    # 3. Table for detailed 166-field stock info cache
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS stock_details_cache (
            symbol TEXT PRIMARY KEY,
            updated_at TEXT,
            info_json TEXT
        )
    """)
    
    # 4. Table for intraday 15m intervals cache
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS stock_intraday_cache (
            symbol TEXT,
            date TEXT,
            interval TEXT,
            intervals_json TEXT,
            PRIMARY KEY (symbol, date, interval)
        )
    """)
    
    # 5. Table for symbols master metadata (sector, industry, average volume)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS symbols_master (
            symbol TEXT PRIMARY KEY,
            company_name TEXT,
            sector TEXT,
            industry TEXT,
            avg_volume INTEGER
        )
    """)
    
    conn.commit()
    conn.close()
    print("Database initialized successfully at:", DB_FILE)

if __name__ == "__main__":
    initialize_db()
