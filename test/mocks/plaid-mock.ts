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
          {
            account_id: "acc_401k_789",
            name: "Mock 401k Account",
            official_name: "Mock Retirement 401(k)",
            type: "investment",
            subtype: "401k",
            mask: "9999",
            balances: {
              current: 52580.11,
              available: null,
              iso_currency_code: "USD",
              limit: null,
            },
          },
          {
            account_id: "acc_brokerage_101",
            name: "Mock Brokerage Account",
            official_name: "Mock Individual Brokerage",
            type: "investment",
            subtype: "brokerage",
            mask: "8888",
            balances: {
              current: 25000.00,
              available: null,
              iso_currency_code: "USD",
              limit: null,
            },
          },
          {
            account_id: "acc_credit_card_202",
            name: "Mock Credit Card",
            official_name: "Mock Platinum Credit Card",
            type: "credit",
            subtype: "credit card",
            mask: "1234",
            balances: {
              current: 1250.50,
              available: 3749.50,
              iso_currency_code: "USD",
              limit: 5000.00,
            },
          },
          {
            account_id: "acc_mortgage_303",
            name: "Mock Mortgage",
            official_name: "Mock Home Mortgage Loan",
            type: "loan",
            subtype: "mortgage",
            mask: "5678",
            balances: {
              current: 285000.00,
              available: null,
              iso_currency_code: "USD",
              limit: null,
            },
          },
          {
            account_id: "acc_student_loan_404",
            name: "Mock Student Loan",
            official_name: "Mock Federal Student Loan",
            type: "loan",
            subtype: "student",
            mask: "9012",
            balances: {
              current: 32500.00,
              available: null,
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

  async investmentsHoldingsGet(request: any) {
    return {
      data: {
        accounts: [
          {
            account_id: "acc_401k_789",
            name: "Mock 401k Account",
            official_name: "Mock Retirement 401(k)",
            type: "investment",
            subtype: "401k",
            mask: "9999",
            balances: {
              current: 52580.11,
              available: null,
              iso_currency_code: "USD",
              limit: null,
            },
          },
          {
            account_id: "acc_brokerage_101",
            name: "Mock Brokerage Account",
            official_name: "Mock Individual Brokerage",
            type: "investment",
            subtype: "brokerage",
            mask: "8888",
            balances: {
              current: 25000.00,
              available: null,
              iso_currency_code: "USD",
              limit: null,
            },
          },
        ],
        holdings: [
          // 401k holdings
          {
            account_id: "acc_401k_789",
            security_id: "sec_vtsax_123",
            quantity: 100.5,
            institution_price: 120.50,
            institution_price_as_of: "2024-10-29",
            institution_value: 12110.25,
            cost_basis: 10000.00,
            iso_currency_code: "USD",
            unofficial_currency_code: null,
          },
          {
            account_id: "acc_401k_789",
            security_id: "sec_vtiax_456",
            quantity: 50.25,
            institution_price: 250.00,
            institution_price_as_of: "2024-10-29",
            institution_value: 12562.50,
            cost_basis: 11000.00,
            iso_currency_code: "USD",
            unofficial_currency_code: null,
          },
          {
            account_id: "acc_401k_789",
            security_id: "sec_vbtlx_789",
            quantity: 300.0,
            institution_price: 11.50,
            institution_value: 3450.00,
            cost_basis: 3200.00,
            iso_currency_code: "USD",
            unofficial_currency_code: null,
          },
          {
            account_id: "acc_401k_789",
            security_id: "sec_cash_usd",
            quantity: 24457.36,
            institution_price: 1.00,
            institution_value: 24457.36,
            cost_basis: 24457.36,
            is_cash_equivalent: true,
            iso_currency_code: "USD",
            unofficial_currency_code: null,
          },
          // Brokerage holdings
          {
            account_id: "acc_brokerage_101",
            security_id: "sec_aapl_111",
            quantity: 10.0,
            institution_price: 180.00,
            institution_price_as_of: "2024-10-29",
            institution_value: 1800.00,
            cost_basis: 1500.00,
            iso_currency_code: "USD",
            unofficial_currency_code: null,
          },
          {
            account_id: "acc_brokerage_101",
            security_id: "sec_msft_222",
            quantity: 15.0,
            institution_price: 400.00,
            institution_price_as_of: "2024-10-29",
            institution_value: 6000.00,
            cost_basis: 5250.00,
            iso_currency_code: "USD",
            unofficial_currency_code: null,
          },
          {
            account_id: "acc_brokerage_101",
            security_id: "sec_tsla_333",
            quantity: 5.0,
            institution_price: 250.00,
            institution_price_as_of: "2024-10-29",
            institution_value: 1250.00,
            cost_basis: 1000.00,
            iso_currency_code: "USD",
            unofficial_currency_code: null,
          },
          {
            account_id: "acc_brokerage_101",
            security_id: "sec_vti_444",
            quantity: 20.0,
            institution_price: 230.00,
            institution_price_as_of: "2024-10-29",
            institution_value: 4600.00,
            cost_basis: 4400.00,
            iso_currency_code: "USD",
            unofficial_currency_code: null,
          },
          {
            account_id: "acc_brokerage_101",
            security_id: "sec_cash_usd",
            quantity: 17200.00,
            institution_price: 1.00,
            institution_value: 17200.00,
            cost_basis: 17200.00,
            is_cash_equivalent: true,
            iso_currency_code: "USD",
            unofficial_currency_code: null,
          },
        ],
        securities: [
          {
            security_id: "sec_vtsax_123",
            ticker_symbol: "VTSAX",
            name: "Vanguard Total Stock Market Index Fund",
            type: "mutual fund",
            subtype: "mutual fund",
            close_price: 120.50,
            close_price_as_of: "2024-10-29",
            iso_currency_code: "USD",
            is_cash_equivalent: false,
          },
          {
            security_id: "sec_vtiax_456",
            ticker_symbol: "VTIAX",
            name: "Vanguard Total International Stock Index Fund",
            type: "mutual fund",
            subtype: "mutual fund",
            close_price: 250.00,
            close_price_as_of: "2024-10-29",
            iso_currency_code: "USD",
            is_cash_equivalent: false,
          },
          {
            security_id: "sec_vbtlx_789",
            ticker_symbol: "VBTLX",
            name: "Vanguard Total Bond Market Index Fund",
            type: "mutual fund",
            subtype: "mutual fund",
            close_price: 11.50,
            close_price_as_of: "2024-10-29",
            iso_currency_code: "USD",
            is_cash_equivalent: false,
          },
          {
            security_id: "sec_aapl_111",
            ticker_symbol: "AAPL",
            name: "Apple Inc.",
            type: "equity",
            subtype: "common stock",
            close_price: 180.00,
            close_price_as_of: "2024-10-29",
            iso_currency_code: "USD",
            is_cash_equivalent: false,
          },
          {
            security_id: "sec_msft_222",
            ticker_symbol: "MSFT",
            name: "Microsoft Corporation",
            type: "equity",
            subtype: "common stock",
            close_price: 400.00,
            close_price_as_of: "2024-10-29",
            iso_currency_code: "USD",
            is_cash_equivalent: false,
          },
          {
            security_id: "sec_tsla_333",
            ticker_symbol: "TSLA",
            name: "Tesla Inc.",
            type: "equity",
            subtype: "common stock",
            close_price: 250.00,
            close_price_as_of: "2024-10-29",
            iso_currency_code: "USD",
            is_cash_equivalent: false,
          },
          {
            security_id: "sec_vti_444",
            ticker_symbol: "VTI",
            name: "Vanguard Total Stock Market ETF",
            type: "etf",
            subtype: "etf",
            close_price: 230.00,
            close_price_as_of: "2024-10-29",
            iso_currency_code: "USD",
            is_cash_equivalent: false,
          },
          {
            security_id: "sec_cash_usd",
            ticker_symbol: "USD",
            name: "U S Dollar",
            type: "cash",
            subtype: "cash",
            close_price: 1.00,
            close_price_as_of: "2024-10-29",
            iso_currency_code: "USD",
            is_cash_equivalent: true,
          },
        ],
        item: {
          item_id: "item-sandbox-mock",
          institution_name: "Mock Bank",
        },
        request_id: "mock-request-id",
      },
    };
  }

  async liabilitiesGet(request: any) {
    return {
      data: {
        accounts: [
          {
            account_id: "acc_credit_card_202",
            balances: {
              available: 3749.50,
              current: 1250.50,
              iso_currency_code: "USD",
              limit: 5000.00,
            },
            mask: "1234",
            name: "Mock Credit Card",
            official_name: "Mock Platinum Credit Card",
            subtype: "credit card",
            type: "credit",
          },
          {
            account_id: "acc_mortgage_303",
            balances: {
              current: 285000.00,
              iso_currency_code: "USD",
            },
            mask: "5678",
            name: "Mock Mortgage",
            official_name: "Mock Home Mortgage Loan",
            subtype: "mortgage",
            type: "loan",
          },
          {
            account_id: "acc_student_loan_404",
            balances: {
              current: 32500.00,
              iso_currency_code: "USD",
            },
            mask: "9012",
            name: "Mock Student Loan",
            official_name: "Mock Federal Student Loan",
            subtype: "student",
            type: "loan",
          },
        ],
        item: {
          item_id: "item-sandbox-mock",
          institution_name: "Mock Bank",
        },
        liabilities: {
          credit: [
            {
              account_id: "acc_credit_card_202",
              aprs: [
                {
                  apr_percentage: 15.24,
                  apr_type: "purchase_apr",
                  balance_subject_to_apr: 1250.50,
                  interest_charge_amount: 18.75,
                },
                {
                  apr_percentage: 24.99,
                  apr_type: "cash_apr",
                  balance_subject_to_apr: 0,
                  interest_charge_amount: 0,
                },
              ],
              is_overdue: false,
              last_payment_amount: 50.00,
              last_payment_date: "2024-10-01",
              last_statement_balance: 1300.50,
              last_statement_issue_date: "2024-10-05",
              minimum_payment_amount: 35.00,
              next_payment_due_date: "2024-11-01",
            },
          ],
          mortgage: [
            {
              account_id: "acc_mortgage_303",
              account_number: "1234567890",
              current_late_fee: null,
              escrow_balance: 3500.00,
              has_pmi: true,
              has_prepayment_penalty: false,
              interest_rate: {
                percentage: 3.75,
                type: "fixed",
              },
              last_payment_amount: 1850.00,
              last_payment_date: "2024-10-01",
              loan_term: "30 year",
              loan_type_description: "conventional",
              maturity_date: "2053-10-01",
              next_monthly_payment: 1850.00,
              next_payment_due_date: "2024-11-01",
              origination_date: "2023-10-01",
              origination_principal_amount: 300000.00,
              past_due_amount: null,
              property_address: {
                city: "San Francisco",
                country: "US",
                postal_code: "94102",
                region: "CA",
                street: "123 Main Street",
              },
              ytd_interest_paid: 10500.00,
              ytd_principal_paid: 4200.00,
            },
          ],
          student: [
            {
              account_id: "acc_student_loan_404",
              account_number: "9876543210",
              disbursement_dates: ["2018-09-01", "2019-09-01"],
              expected_payoff_date: "2028-09-01",
              guarantor: "DEPT OF ED",
              interest_rate_percentage: 4.5,
              is_overdue: false,
              last_payment_amount: 250.00,
              last_payment_date: "2024-10-01",
              last_statement_balance: 32500.00,
              last_statement_issue_date: "2024-10-05",
              loan_name: "Direct Unsubsidized Loan",
              loan_status: {
                end_date: "2028-09-01",
                type: "repayment",
              },
              minimum_payment_amount: 250.00,
              next_payment_due_date: "2024-11-01",
              origination_date: "2018-09-01",
              origination_principal_amount: 40000.00,
              outstanding_interest_amount: 2100.00,
              payment_reference_number: "9876543210",
              repayment_plan: {
                description: "Standard Repayment",
                type: "standard",
              },
              sequence_number: "1",
              servicer_address: {
                city: "Washington",
                country: "US",
                postal_code: "20001",
                region: "DC",
                street: "456 Federal Plaza",
              },
              ytd_interest_paid: 1400.00,
              ytd_principal_paid: 700.00,
            },
          ],
        },
        request_id: "mock-request-id",
      },
    };
  }
}
