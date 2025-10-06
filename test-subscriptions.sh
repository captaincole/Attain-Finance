#!/bin/bash

# Test script for subscription analysis
# This simulates what Claude would do when the user calls track-subscriptions

echo "Testing subscription analysis workflow..."
echo ""

# Test the analysis script with sample data
echo "Running: node public/analyze-subscriptions.js test/sample_chase.csv"
echo ""

node public/analyze-subscriptions.js test/sample_chase.csv
