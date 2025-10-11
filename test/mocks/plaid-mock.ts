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
        accounts: connection?.accounts || [
          {
            account_id: "acc_checking_123",
            name: "Mock Checking Account",
            type: "depository",
            subtype: "checking",
            mask: "0000",
            balances: {
              current: 1000.0,
              available: 950.0,
            },
          },
          {
            account_id: "acc_savings_456",
            name: "Mock Savings Account",
            type: "depository",
            subtype: "savings",
            mask: "1111",
            balances: {
              current: 5000.0,
              available: 5000.0,
            },
          },
        ],
        item: {
          item_id: connection?.itemId || "item-sandbox-mock",
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
}
