#!/bin/bash
# Spending Categories Visualizer
# Generates a terminal bar chart of spending by custom category
# Usage: ./visualize-spending.sh transactions.csv

CSV_FILE="$1"

# Check if file exists
if [ ! -f "$CSV_FILE" ]; then
  echo "Error: CSV file not found: $CSV_FILE"
  echo "Usage: $0 <transactions.csv>"
  exit 1
fi

# Configuration (edit these to customize)
TOP_N=10
BAR_WIDTH=40  # Maximum bar width in characters
BAR_CHAR="█"
EXCLUDE_CATEGORIES="Income|Transfer|Payment"  # Categories to exclude (pipe-separated)

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          Spending by Category (AI Categorized)                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Process CSV: group by custom_category (column 5), sum amounts, sort by total
# CSV format: date,description,amount,category,custom_category,account_name,pending
# Skip header (tail -n +2), extract custom_category and amount
tail -n +2 "$CSV_FILE" | \
  awk -F',' -v exclude="$EXCLUDE_CATEGORIES" '{
    # Extract custom_category (column 5) and amount (column 3)
    custom_category = $5
    gsub(/"/, "", custom_category)
    amount = $3
    gsub(/[$"]/, "", amount)

    # Include only:
    # - Positive amounts (expenses, not credits)
    # - Valid categories (not empty)
    # - Not in exclude list (Income, Transfer, Payment)
    if (amount > 0 && custom_category != "" && custom_category !~ exclude) {
      print custom_category "," amount
    }
  }' | \
  awk -F',' '{
    # Sum by category
    categories[$1] += $2
    counts[$1]++
  }
  END {
    for (c in categories) {
      print categories[c], c, counts[c]
    }
  }' | \
  sort -rn | \
  head -n "$TOP_N" | \
  awk -v bar_width="$BAR_WIDTH" -v bar_char="$BAR_CHAR" '
  # First pass: find max and total
  NR == 1 { max_amount = $1 }
  {
    amount[NR] = $1
    # Reconstruct category name (everything after first field until last field)
    category[NR] = ""
    for (i = 2; i <= NF-1; i++) {
      category[NR] = category[NR] (i > 2 ? " " : "") $i
    }
    txns[NR] = $NF
    total += $1
  }
  END {
    # Second pass: print formatted output
    for (i = 1; i <= NR; i++) {
      amt = amount[i]
      cat = category[i]
      txn_count = txns[i]
      percent = (amt / total) * 100

      # Calculate bar length
      bar_len = int((amt / max_amount) * bar_width)
      if (bar_len < 1) bar_len = 1

      # Build bar
      bar = ""
      for (j = 0; j < bar_len; j++) bar = bar bar_char

      # Truncate long names
      display_cat = cat
      if (length(cat) > 25) {
        display_cat = substr(cat, 1, 22) "..."
      }

      # Print row
      printf "%d. %-25s  $%9.2f  %3.1f%%  (%d txns)\n", i, display_cat, amt, percent, txn_count
      printf "   %s\n\n", bar
    }

    # Summary
    print "─────────────────────────────────────────────────────────────────"
    printf "Total Spending: $%.2f\n", total
    print ""
  }'

exit 0
