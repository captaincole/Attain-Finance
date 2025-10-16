/**
 * Mock Plaid client for testing
 * Implements the same interface as PlaidApi but returns fake data
 */

export class MockPlaidClient {
  // Store mock connections for stateful testing
  private mockConnections: Map<string, any> = new Map();

  async linkTokenCreate(config: any) {
    return {
      data: {
        link_token: "link-sandbox-test-token-12345",
        expiration: new Date(Date.now() + 3600000).toISOString(),
        request_id: "mock-request-id",
      },
    };
  }

  async itemPublicTokenExchange(request: any) {
    const accessToken = `access-sandbox-${Date.now()}`;
    const itemId = `item-sandbox-${Date.now()}`;

    // Store connection for later retrieval
    this.mockConnections.set(accessToken, {
      itemId,
      accounts: [
        {
          account_id: "acc_checking_123",
          name: "Mock Checking Account",
          type: "depository",
          subtype: "checking",
          mask: "0000",
        },
        {
          account_id: "acc_savings_456",
          name: "Mock Savings Account",
          type: "depository",
          subtype: "savings",
          mask: "1111",
        },
      ],
    });

    return {
      data: {
        access_token: accessToken,
        item_id: itemId,
        request_id: "mock-request-id",
      },
    };
  }

  async accountsGet(request: any) {
    const connection = this.mockConnections.get(request.access_token);

    return {
      data: {
        accounts: [
          {
            account_id: "acc_checking_123",
            name: "Mock Checking Account",
            official_name: "Mock Bank Checking Account",
            type: "depository",
            subtype: "checking",
            mask: "0000",
            balances: {
              current: 1000.0,
              available: 950.0,
              iso_currency_code: "USD",
              limit: null,
            },
          },
          {
            account_id: "acc_savings_456",
            name: "Mock Savings Account",
            official_name: "Mock Bank Savings Account",
            type: "depository",
            subtype: "savings",
            mask: "1111",
            balances: {
              current: 5000.0,
              available: 5000.0,
              iso_currency_code: "USD",
              limit: null,
            },
          },
        ],
        item: {
          item_id: connection?.itemId || "item-sandbox-mock",
          institution_name: "Mock Bank",
        },
        request_id: "mock-request-id",
      },
    };
  }

  async transactionsGet(request: any) {
    return {
      data: {
        transactions: [
          {
            transaction_id: "txn_mock_1",
            date: "2024-01-15",
            name: "Mock Coffee Shop",
            amount: 4.5,
            category: ["Food and Drink", "Restaurants"],
            account_id: "acc_checking_123",
            pending: false,
          },
          {
            transaction_id: "txn_mock_2",
            date: "2024-01-14",
            name: "Mock Grocery Store",
            amount: 45.23,
            category: ["Food and Drink", "Groceries"],
            account_id: "acc_checking_123",
            pending: false,
          },
        ],
        total_transactions: 2,
        accounts: [
          {
            account_id: "acc_checking_123",
            name: "Mock Checking Account",
            type: "depository",
            subtype: "checking",
          },
        ],
        request_id: "mock-request-id",
      },
    };
  }

  async transactionsSync(request: any) {
    const accountId = request.options?.account_id;

    // Generate different mock transactions based on account
    const mockTransactions = accountId === "acc_checking_123"
      ? [
          {
            transaction_id: "txn_sync_checking_1",
            account_id: "acc_checking_123",
            date: "2024-01-15",
            name: "Starbucks Coffee",
            amount: 5.75,
            pending: false,
            personal_finance_category: {
              primary: "FOOD_AND_DRINK",
              detailed: "FOOD_AND_DRINK_COFFEE",
            },
          },
          {
            transaction_id: "txn_sync_checking_2",
            account_id: "acc_checking_123",
            date: "2024-01-14",
            name: "Whole Foods Market",
            amount: 87.32,
            pending: false,
            personal_finance_category: {
              primary: "FOOD_AND_DRINK",
              detailed: "FOOD_AND_DRINK_GROCERIES",
            },
          },
          {
            transaction_id: "txn_sync_checking_3",
            account_id: "acc_checking_123",
            date: "2024-01-13",
            name: "Shell Gas Station",
            amount: 45.00,
            pending: false,
            personal_finance_category: {
              primary: "TRANSPORTATION",
              detailed: "TRANSPORTATION_GAS",
            },
          },
        ]
      : [
          {
            transaction_id: "txn_sync_savings_1",
            account_id: "acc_savings_456",
            date: "2024-01-10",
            name: "Interest Payment",
            amount: -2.50, // Negative = income
            pending: false,
            personal_finance_category: {
              primary: "INCOME",
              detailed: "INCOME_INTEREST_EARNED",
            },
          },
        ];

    return {
      data: {
        added: mockTransactions,
        modified: [],
        removed: [],
        next_cursor: "mock-cursor-end",
        has_more: false,
        accounts: [
          {
            account_id: accountId || "acc_checking_123",
            name: accountId === "acc_savings_456" ? "Mock Savings Account" : "Mock Checking Account",
            type: "depository",
            subtype: accountId === "acc_savings_456" ? "savings" : "checking",
            balances: {
              current: accountId === "acc_savings_456" ? 5000.0 : 1000.0,
              available: accountId === "acc_savings_456" ? 5000.0 : 950.0,
            },
          },
        ],
        transactions_update_status: "HISTORICAL_UPDATE_COMPLETE",
        request_id: "mock-request-id",
      },
    };
  }
}
