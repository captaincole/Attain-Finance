The /transactions/sync endpoint retrieves transactions associated with an Item and can fetch updates using a cursor to track which updates have already been seen.
For important instructions on integrating with /transactions/sync, see the Transactions integration overview. If you are migrating from an existing integration using /transactions/get, see the Transactions Sync migration guide.
This endpoint supports credit, depository, and some loan-type accounts (only those with account subtype student). For investments accounts, use /investments/transactions/get instead.
When retrieving paginated updates, track both the next_cursor from the latest response and the original cursor from the first call in which has_more was true; if a call to /transactions/sync fails when retrieving a paginated update (e.g due to the TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION error), the entire pagination request loop must be restarted beginning with the cursor for the first page of the update, rather than retrying only the single request that failed.
If transactions data is not yet available for the Item, which can happen if the Item was not initialized with transactions during the /link/token/create call or if /transactions/sync was called within a few seconds of Item creation, /transactions/sync will return empty transactions arrays.
Plaid typically checks for new transactions data between one and four times per day, depending on the institution. To find out when transactions were last updated for an Item, use the Item Debugger or call /item/get; the item.status.transactions.last_successful_update field will show the timestamp of the most recent successful update. To force Plaid to check for new transactions, use the /transactions/refresh endpoint.
To be alerted when new transactions are available, listen for the SYNC_UPDATES_AVAILABLE webhook.

Request Example: 

curl -X POST https://sandbox.plaid.com/transactions/sync \
-H 'Content-Type: application/json' \
-d '{
  "client_id": "YOUR_CLIENT_ID",
  "secret": "YOUR_SECRET",
  "access_token": String,
  "cursor": String,
  "count": 250
}'

Request fields

Expand all
client_id
string
Your Plaid API client_id. The client_id is required and may be provided either in the PLAID-CLIENT-ID header or as part of a request body.
access_token
required
string
The access token associated with the Item data is being requested for.
secret
string
Your Plaid API secret. The secret is required and may be provided either in the PLAID-SECRET header or as part of a request body.
cursor
string
The cursor value represents the last update requested. Providing it will cause the response to only return changes after this update.
If omitted, the entire history of updates will be returned, starting with the first-added transactions on the Item. The cursor also accepts the special value of "now", which can be used to fast-forward the cursor as part of migrating an existing Item from /transactions/get to /transactions/sync. For more information, see the Transactions sync migration guide. Note that using the "now" value is not supported for any use case other than migrating existing Items from /transactions/get.
The upper-bound length of this cursor is 256 characters of base64.
count
integer
The number of transaction updates to fetch.

Default: 100 
Minimum: 1 
Maximum: 500 
Exclusive min: false 
options
object
An optional object to be used with the request. If specified, options must not be null.
Hide object
include_original_description
boolean
Include the raw unparsed transaction description from the financial institution.

Default: false 
days_requested
integer
This field only applies to calls for Items where the Transactions product has not already been initialized (i.e., by specifying transactions in the products, required_if_supported_products, or optional_products array when calling /link/token/create or by making a previous call to /transactions/sync or /transactions/get). In those cases, the field controls the maximum number of days of transaction history that Plaid will request from the financial institution. The more transaction history is requested, the longer the historical update poll will take. If no value is specified, 90 days of history will be requested by default.
If you are initializing your Items with transactions during the /link/token/create call (e.g. by including transactions in the /link/token/create products array), you must use the transactions.days_requested field in the /link/token/create request instead of in the /transactions/sync request.
If the Item has already been initialized with the Transactions product, this field will have no effect. The maximum amount of transaction history to request on an Item cannot be updated if Transactions has already been added to the Item. To request older transaction history on an Item where Transactions has already been added, you must delete the Item via /item/remove and send the user through Link to create a new Item.
Customers using Recurring Transactions should request at least 180 days of history for optimal results.

Minimum: 1 
Maximum: 730 
Default: 90 
account_id
string
If provided, the returned updates and cursor will only reflect the specified account's transactions. Omitting account_id returns updates for all accounts under the Item. Note that specifying an account_id effectively creates a separate incremental update stream—and therefore a separate cursor—for that account. If multiple accounts are queried this way, you will maintain multiple cursors, one per account_id.
If you decide to begin filtering by account_id after using no account_id, start fresh with a null cursor and maintain separate (account_id, cursor) pairs going forward. Do not reuse any previously saved cursors, as this can cause pagination errors or incomplete data.
Note: An error will be returned if a provided account_id is not associated with the Item.


Response Example: 

{
  "accounts": [
    {
      "account_id": "BxBXxLj1m4HMXBm9WZZmCWVbPjX16EHwv99vp",
      "balances": {
        "available": 110.94,
        "current": 110.94,
        "iso_currency_code": "USD",
        "limit": null,
        "unofficial_currency_code": null
      },
      "mask": "0000",
      "name": "Plaid Checking",
      "official_name": "Plaid Gold Standard 0% Interest Checking",
      "subtype": "checking",
      "type": "depository"
    }
  ],
  "added": [
    {
      "account_id": "BxBXxLj1m4HMXBm9WZZmCWVbPjX16EHwv99vp",
      "account_owner": null,
      "amount": 72.1,
      "iso_currency_code": "USD",
      "unofficial_currency_code": null,
      "check_number": null,
      "counterparties": [
        {
          "name": "Walmart",
          "type": "merchant",
          "logo_url": "https://plaid-merchant-logos.plaid.com/walmart_1100.png",
          "website": "walmart.com",
          "entity_id": "O5W5j4dN9OR3E6ypQmjdkWZZRoXEzVMz2ByWM",
          "confidence_level": "VERY_HIGH"
        }
      ],
      "date": "2023-09-24",
      "datetime": "2023-09-24T11:01:01Z",
      "authorized_date": "2023-09-22",
      "authorized_datetime": "2023-09-22T10:34:50Z",
      "location": {
        "address": "13425 Community Rd",
        "city": "Poway",
        "region": "CA",
        "postal_code": "92064",
        "country": "US",
        "lat": 32.959068,
        "lon": -117.037666,
        "store_number": "1700"
      },
      "name": "PURCHASE WM SUPERCENTER #1700",
      "merchant_name": "Walmart",
      "merchant_entity_id": "O5W5j4dN9OR3E6ypQmjdkWZZRoXEzVMz2ByWM",
      "logo_url": "https://plaid-merchant-logos.plaid.com/walmart_1100.png",
      "website": "walmart.com",
      "payment_meta": {
        "by_order_of": null,
        "payee": null,
        "payer": null,
        "payment_method": null,
        "payment_processor": null,
        "ppd_id": null,
        "reason": null,
        "reference_number": null
      },
      "payment_channel": "in store",
      "pending": false,
      "pending_transaction_id": "no86Eox18VHMvaOVL7gPUM9ap3aR1LsAVZ5nc",
      "personal_finance_category": {
        "primary": "GENERAL_MERCHANDISE",
        "detailed": "GENERAL_MERCHANDISE_SUPERSTORES",
        "confidence_level": "VERY_HIGH"
      },
      "personal_finance_category_icon_url": "https://plaid-category-icons.plaid.com/PFC_GENERAL_MERCHANDISE.png",
      "transaction_id": "lPNjeW1nR6CDn5okmGQ6hEpMo4lLNoSrzqDje",
      "transaction_code": null,
      "transaction_type": "place"
    }
  ],
  "modified": [
    {
      "account_id": "BxBXxLj1m4HMXBm9WZZmCWVbPjX16EHwv99vp",
      "account_owner": null,
      "amount": 28.34,
      "iso_currency_code": "USD",
      "unofficial_currency_code": null,
      "check_number": null,
      "counterparties": [
        {
          "name": "DoorDash",
          "type": "marketplace",
          "logo_url": "https://plaid-counterparty-logos.plaid.com/doordash_1.png",
          "website": "doordash.com",
          "entity_id": "YNRJg5o2djJLv52nBA1Yn1KpL858egYVo4dpm",
          "confidence_level": "HIGH"
        },
        {
          "name": "Burger King",
          "type": "merchant",
          "logo_url": "https://plaid-merchant-logos.plaid.com/burger_king_155.png",
          "website": "burgerking.com",
          "entity_id": "mVrw538wamwdm22mK8jqpp7qd5br0eeV9o4a1",
          "confidence_level": "VERY_HIGH"
        }
      ],
      "date": "2023-09-28",
      "datetime": "2023-09-28T15:10:09Z",
      "authorized_date": "2023-09-27",
      "authorized_datetime": "2023-09-27T08:01:58Z",
      "location": {
        "address": null,
        "city": null,
        "region": null,
        "postal_code": null,
        "country": null,
        "lat": null,
        "lon": null,
        "store_number": null
      },
      "name": "Dd Doordash Burgerkin",
      "merchant_name": "Burger King",
      "merchant_entity_id": "mVrw538wamwdm22mK8jqpp7qd5br0eeV9o4a1",
      "logo_url": "https://plaid-merchant-logos.plaid.com/burger_king_155.png",
      "website": "burgerking.com",
      "payment_meta": {
        "by_order_of": null,
        "payee": null,
        "payer": null,
        "payment_method": null,
        "payment_processor": null,
        "ppd_id": null,
        "reason": null,
        "reference_number": null
      },
      "payment_channel": "online",
      "pending": true,
      "pending_transaction_id": null,
      "personal_finance_category": {
        "primary": "FOOD_AND_DRINK",
        "detailed": "FOOD_AND_DRINK_FAST_FOOD",
        "confidence_level": "VERY_HIGH"
      },
      "personal_finance_category_icon_url": "https://plaid-category-icons.plaid.com/PFC_FOOD_AND_DRINK.png",
      "transaction_id": "yhnUVvtcGGcCKU0bcz8PDQr5ZUxUXebUvbKC0",
      "transaction_code": null,
      "transaction_type": "digital"
    }
  ],
  "removed": [
    {
      "account_id": "BxBXxLj1m4HMXBm9WZZmCWVbPjX16EHwv99vp",
      "transaction_id": "CmdQTNgems8BT1B7ibkoUXVPyAeehT3Tmzk0l"
    }
  ],
  "next_cursor": "tVUUL15lYQN5rBnfDIc1I8xudpGdIlw9nsgeXWvhOfkECvUeR663i3Dt1uf/94S8ASkitgLcIiOSqNwzzp+bh89kirazha5vuZHBb2ZA5NtCDkkV",
  "has_more": false,
  "request_id": "Wvhy9PZHQLV8njG",
  "transactions_update_status": "HISTORICAL_UPDATE_COMPLETE"
}

Response fields

Expand all
transactions_update_status
string
A description of the update status for transaction pulls of an Item. This field contains the same information provided by transactions webhooks, and may be helpful for webhook troubleshooting or when recovering from missed webhooks.
TRANSACTIONS_UPDATE_STATUS_UNKNOWN: Unable to fetch transactions update status for Item.
NOT_READY: The Item is pending transaction pull.
INITIAL_UPDATE_COMPLETE: Initial pull for the Item is complete, historical pull is pending.
HISTORICAL_UPDATE_COMPLETE: Both initial and historical pull for Item are complete.

Possible values: TRANSACTIONS_UPDATE_STATUS_UNKNOWN, NOT_READY, INITIAL_UPDATE_COMPLETE, HISTORICAL_UPDATE_COMPLETE
accounts
[object]
An array of accounts at a financial institution associated with the transactions in this response. Only accounts that have associated transactions will be shown. For example, investment-type accounts will be omitted.
View object…
added
[object]
Transactions that have been added to the Item since cursor ordered by ascending last modified time.
View object…
modified
[object]
Transactions that have been modified on the Item since cursor ordered by ascending last modified time.
View object…
removed
[object]
Transactions that have been removed from the Item since cursor ordered by ascending last modified time.
View object…
next_cursor
string
Cursor used for fetching any future updates after the latest update provided in this response. The cursor obtained after all pages have been pulled (indicated by has_more being false) will be valid for at least 1 year. This cursor should be persisted for later calls. If transactions are not yet available, this will be an empty string.
If account_id is included in the request, the returned cursor will reflect updates for that specific account.
has_more
boolean
Represents if more than requested count of transaction updates exist. If true, the additional updates can be fetched by making an additional request with cursor set to next_cursor. If has_more is true, it’s important to pull all available pages, to make it less likely for underlying data changes to conflict with pagination.
request_id
string
A unique identifier for the request, which can be used for troubleshooting. This identifier, like all Plaid identifiers, is case sensitive.