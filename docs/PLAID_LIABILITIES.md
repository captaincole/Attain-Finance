Liabilities
API reference for Liabilities endpoints and webhooks
For how-to guidance, see the Liabilities documentation.

Endpoints	
/liabilities/get	Fetch liabilities data
Webhooks	
DEFAULT_UPDATE	New or updated liabilities available
Endpoints
/liabilities/get
Retrieve Liabilities data
The /liabilities/get endpoint returns various details about an Item with loan or credit accounts. Liabilities data is available primarily for US financial institutions, with some limited coverage of Canadian institutions. Currently supported account types are account type credit with account subtype credit card or paypal, and account type loan with account subtype student or mortgage. To limit accounts listed in Link to types and subtypes supported by Liabilities, you can use the account_filters parameter when creating a Link token.
The types of information returned by Liabilities can include balances and due dates, loan terms, and account details such as original loan amount and guarantor. Data is refreshed approximately once per day; the latest data can be retrieved by calling /liabilities/get.

Example Response:

{
  "accounts": [
    {
      "account_id": "BxBXxLj1m4HMXBm9WZZmCWVbPjX16EHwv99vp",
      "balances": {
        "available": 100,
        "current": 110,
        "iso_currency_code": "USD",
        "limit": null,
        "unofficial_currency_code": null
      },
      "mask": "0000",
      "name": "Plaid Checking",
      "official_name": "Plaid Gold Standard 0% Interest Checking",
      "subtype": "checking",
      "type": "depository"
    },
    {
      "account_id": "dVzbVMLjrxTnLjX4G66XUp5GLklm4oiZy88yK",
      "balances": {
        "available": null,
        "current": 410,
        "iso_currency_code": "USD",
        "limit": 2000,
        "unofficial_currency_code": null
      },
      "mask": "3333",
      "name": "Plaid Credit Card",
      "official_name": "Plaid Diamond 12.5% APR Interest Credit Card",
      "subtype": "credit card",
      "type": "credit"
    },
    {
      "account_id": "Pp1Vpkl9w8sajvK6oEEKtr7vZxBnGpf7LxxLE",
      "balances": {
        "available": null,
        "current": 65262,
        "iso_currency_code": "USD",
        "limit": null,
        "unofficial_currency_code": null
      },
      "mask": "7777",
      "name": "Plaid Student Loan",
      "official_name": null,
      "subtype": "student",
      "type": "loan"
    },
    {
      "account_id": "BxBXxLj1m4HMXBm9WZJyUg9XLd4rKEhw8Pb1J",
      "balances": {
        "available": null,
        "current": 56302.06,
        "iso_currency_code": "USD",
        "limit": null,
        "unofficial_currency_code": null
      },
      "mask": "8888",
      "name": "Plaid Mortgage",
      "official_name": null,
      "subtype": "mortgage",
      "type": "loan"
    }
  ],
  "item": {
    "available_products": [
      "balance",
      "investments"
    ],
    "billed_products": [
      "assets",
      "auth",
      "identity",
      "liabilities",
      "transactions"
    ],
    "consent_expiration_time": null,
    "error": null,
    "institution_id": "ins_3",
    "institution_name": "Chase",
    "item_id": "eVBnVMp7zdTJLkRNr33Rs6zr7KNJqBFL9DrE6",
    "update_type": "background",
    "webhook": "https://www.genericwebhookurl.com/webhook",
    "auth_method": "INSTANT_AUTH"
  },
  "liabilities": {
    "credit": [
      {
        "account_id": "dVzbVMLjrxTnLjX4G66XUp5GLklm4oiZy88yK",
        "aprs": [
          {
            "apr_percentage": 15.24,
            "apr_type": "balance_transfer_apr",
            "balance_subject_to_apr": 1562.32,
            "interest_charge_amount": 130.22
          },
          {
            "apr_percentage": 27.95,
            "apr_type": "cash_apr",
            "balance_subject_to_apr": 56.22,
            "interest_charge_amount": 14.81
          },
          {
            "apr_percentage": 12.5,
            "apr_type": "purchase_apr",
            "balance_subject_to_apr": 157.01,
            "interest_charge_amount": 25.66
          },
          {
            "apr_percentage": 0,
            "apr_type": "special",
            "balance_subject_to_apr": 1000,
            "interest_charge_amount": 0
          }
        ],
        "is_overdue": false,
        "last_payment_amount": 168.25,
        "last_payment_date": "2019-05-22",
        "last_statement_issue_date": "2019-05-28",
        "last_statement_balance": 1708.77,
        "minimum_payment_amount": 20,
        "next_payment_due_date": "2020-05-28"
      }
    ],
    "mortgage": [
      {
        "account_id": "BxBXxLj1m4HMXBm9WZJyUg9XLd4rKEhw8Pb1J",
        "account_number": "3120194154",
        "current_late_fee": 25,
        "escrow_balance": 3141.54,
        "has_pmi": true,
        "has_prepayment_penalty": true,
        "interest_rate": {
          "percentage": 3.99,
          "type": "fixed"
        },
        "last_payment_amount": 3141.54,
        "last_payment_date": "2019-08-01",
        "loan_term": "30 year",
        "loan_type_description": "conventional",
        "maturity_date": "2045-07-31",
        "next_monthly_payment": 3141.54,
        "next_payment_due_date": "2019-11-15",
        "origination_date": "2015-08-01",
        "origination_principal_amount": 425000,
        "past_due_amount": 2304,
        "property_address": {
          "city": "Malakoff",
          "country": "US",
          "postal_code": "14236",
          "region": "NY",
          "street": "2992 Cameron Road"
        },
        "ytd_interest_paid": 12300.4,
        "ytd_principal_paid": 12340.5
      }
    ],
    "student": [
      {
        "account_id": "Pp1Vpkl9w8sajvK6oEEKtr7vZxBnGpf7LxxLE",
        "account_number": "4277075694",
        "disbursement_dates": [
          "2002-08-28"
        ],
        "expected_payoff_date": "2032-07-28",
        "guarantor": "DEPT OF ED",
        "interest_rate_percentage": 5.25,
        "is_overdue": false,
        "last_payment_amount": 138.05,
        "last_payment_date": "2019-04-22",
        "last_statement_issue_date": "2019-04-28",
        "last_statement_balance": 1708.77,
        "loan_name": "Consolidation",
        "loan_status": {
          "end_date": "2032-07-28",
          "type": "repayment"
        },
        "minimum_payment_amount": 25,
        "next_payment_due_date": "2019-05-28",
        "origination_date": "2002-08-28",
        "origination_principal_amount": 25000,
        "outstanding_interest_amount": 6227.36,
        "payment_reference_number": "4277075694",
        "pslf_status": {
          "estimated_eligibility_date": "2021-01-01",
          "payments_made": 200,
          "payments_remaining": 160
        },
        "repayment_plan": {
          "description": "Standard Repayment",
          "type": "standard"
        },
        "sequence_number": "1",
        "servicer_address": {
          "city": "San Matias",
          "country": "US",
          "postal_code": "99415",
          "region": "CA",
          "street": "123 Relaxation Road"
        },
        "ytd_interest_paid": 280.55,
        "ytd_principal_paid": 271.65
      }
    ]
  },
  "request_id": "dTnnm60WgKGLnKL"
}