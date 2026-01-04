-- Migration: Add notes column to portfolio_history table
-- Run this SQL in phpMyAdmin or your MySQL client

USE crypto_portfolio;

ALTER TABLE portfolio_history 
ADD COLUMN notes TEXT DEFAULT NULL AFTER daily_low;

