# Test Suite

Automated tests for the Personal Finance MCP Server's analysis tools.

## Running Tests

```bash
# Run all tests
npm test

# Run only analysis tests
npm run test:analysis
```

## Test Files

### Analysis Tests

- **[run-analysis-tests.js](run-analysis-tests.js)** - Test runner for subscription detection
- **[sample_chase.csv](sample_chase.csv)** - Sample transaction data with known recurring subscriptions

### Expected Results

The sample Chase CSV contains **10 recurring subscriptions**:

| Subscription | Monthly Cost | Occurrences |
|--------------|-------------|-------------|
| AUTOMATIC PAYMENT - THANK | $2,078.50 | 3 |
| Tectra Inc | $500.00 | 3 |
| KFC | $500.00 | 3 |
| Madison Bicycle Shop | $500.00 | 3 |
| SparkFun | $89.40 | 3 |
| Touchstone Climbing | $78.50 | 3 |
| McDonald's | $12.00 | 3 |
| Uber 072515 SF**POOL** | $6.33 | 3 |
| Uber 063015 SF**POOL** | $5.40 | 3 |
| Starbucks | $4.33 | 3 |

**Total Monthly**: $3,774.46
**Annual Projection**: $45,293.52

## Adding New Tests

To add a new test case:

1. Add a new CSV file to the `test/` directory
2. Add a test case to the `tests` array in [run-analysis-tests.js](run-analysis-tests.js):

```javascript
{
  name: 'Test Case Name',
  file: 'your-test-file.csv',
  description: 'What this test validates'
}
```

3. Run `npm test` to verify

## CSV Format

Test CSV files must follow this format:

```csv
date,description,amount,category,account_name,pending
2025-01-15,"Netflix",15.99,"Entertainment","",false
2025-02-15,"Netflix",15.99,"Entertainment","",false
```

Required columns:
- `date` - Transaction date (YYYY-MM-DD)
- `description` - Merchant/description
- `amount` - Transaction amount (positive number)
- `category` - Category (can be empty)
- `account_name` - Account identifier (can be empty)
- `pending` - Boolean flag (true/false)
