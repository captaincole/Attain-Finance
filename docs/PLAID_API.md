================
CODE SNIPPETS
================
TITLE: Set up and Run Plaid Quickstart Backend (Non-Docker, Node.js)
DESCRIPTION: Instructions to clone the Plaid Quickstart repository, copy and configure the .env file with Plaid API keys, navigate to the Node.js backend directory, install npm dependencies, and start the backend application. Includes a note for Windows users regarding symlinks.

SOURCE: https://plaid.com/docs/quickstart

LANGUAGE: Shell
CODE:
```
# Note: If on Windows, run
# git clone -c core.symlinks=true https://github.com/plaid/quickstart
# instead to ensure correct symlink behavior

git clone https://github.com/plaid/quickstart.git

# Copy the .env.example file to .env, then fill
# out PLAID_CLIENT_ID and PLAID_SECRET in .env
cp .env.example .env

cd quickstart/node

# Install dependencies
npm install

# Start the backend app
./start.sh
```

--------------------------------

TITLE: Run Plaid Quickstart Frontend (Non-Docker)
DESCRIPTION: Commands to navigate to the frontend directory of the Plaid Quickstart, install npm dependencies, and start the frontend application. The application will be accessible at `http://localhost:3000`.

SOURCE: https://plaid.com/docs/quickstart

LANGUAGE: Shell
CODE:
```
# Install dependencies
cd quickstart/frontend
npm install

# Start the frontend app
npm start

# Go to http://localhost:3000
```

--------------------------------

TITLE: Set up and Run Plaid Quickstart with Docker
DESCRIPTION: Instructions to clone the Plaid Quickstart repository, configure the .env file with Plaid API keys, and use `make up` to start the Docker container for a specific language (e.g., Node.js). Includes a note for Windows users regarding symlinks and a reminder to ensure Docker is running.

SOURCE: https://plaid.com/docs/quickstart

LANGUAGE: Shell
CODE:
```
# Note: If on Windows, run
# git clone -c core.symlinks=true https://github.com/plaid/quickstart
# instead to ensure correct symlink behavior

git clone https://github.com/plaid/quickstart.git
cd quickstart

# Copy the .env.example file to .env, then fill
# out PLAID_CLIENT_ID and PLAID_SECRET in .env
cp .env.example .env

# start the container for one of these languages:
# node, python, java, ruby, or go

make up language=node

# Go to http://localhost:3000
```

--------------------------------

TITLE: APIDOC: Plaid /accounts/get Example Response
DESCRIPTION: This JSON structure provides an example of the data returned by the Plaid `/accounts/get` API endpoint. It details the structure of individual account objects, including balances, identifiers, names, and types.

SOURCE: https://plaid.com/docs/quickstart

LANGUAGE: APIDOC
CODE:
```
{
  "accounts": [
    {
      "account_id": "A3wenK5EQRfKlnxlBbVXtPw9gyazDWu1EdaZD",
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
      "account_id": "GPnpQdbD35uKdxndAwmbt6aRXryj4AC1yQqmd",
      "balances": {
        "available": 200,
        "current": 210,
        "iso_currency_code": "USD",
        "limit": null,
        "unofficial_currency_code": null
      },
      "mask": "1111",
      "name": "Plaid Saving",
      "official_name": "Plaid Silver Standard 0.1% Interest Saving",
      "subtype": "savings",
      "type": "depository"
    },
    {
      "account_id": "nVRK5AmnpzFGv6LvpEoRivjk9p7N16F6wnZrX",
      "balances": {
        "available": null,
        "current": 1000,
        "iso_currency_code": "USD",
        "limit": null,
        "unofficial_currency_code": null
      },
      "mask": "2222",

```

--------------------------------

TITLE: Plaid API Integration Flow Overview
DESCRIPTION: A step-by-step overview of the Plaid API integration process, from initiating the connection with a link token to obtaining a permanent access token for product requests.

SOURCE: https://plaid.com/docs/quickstart

LANGUAGE: APIDOC
CODE:
```
1. Call /link/token/create:
   - Purpose: Create a link_token.
   - Outcome: Temporary link_token passed to client.

2. Use link_token to open Link:
   - Purpose: Open Plaid Link for user authentication.
   - Outcome: Temporary public_token via onSuccess callback or /link/token/get (backend).

3. Call /item/public_token/exchange:
   - Purpose: Exchange public_token for permanent tokens.
   - Outcome: Permanent access_token and item_id for the new Item.

4. Store access_token:
   - Purpose: Enable future product requests.
   - Outcome: Ability to make product requests for user's Item.
```

--------------------------------

TITLE: Initialize Plaid Link (React Component Structure)
DESCRIPTION: Partial React component demonstrating the initial setup for integrating Plaid Link, including importing necessary hooks and setting up state for the link token.

SOURCE: https://plaid.com/docs/quickstart

LANGUAGE: React
CODE:
```
// APP COMPONENT
// Upon rendering of App component, make a request to create and
// obtain a link token to be used in the Link component
import React, { useEffect, useState } from 'react';
```

--------------------------------

TITLE: Install Plaid Node.js Client Library
DESCRIPTION: This command installs the official Plaid Node.js client library using npm, enabling your application to interact with the Plaid API.

SOURCE: https://plaid.com/docs/income/add-to-app

LANGUAGE: Node
CODE:
```
npm install --save plaid
```

--------------------------------

TITLE: View Plaid Quickstart Docker Container Logs
DESCRIPTION: Command to display the real-time logs of the running Plaid Quickstart Docker container for a specified language.

SOURCE: https://plaid.com/docs/quickstart

LANGUAGE: Shell
CODE:
```
$ make logs language=node
```

--------------------------------

TITLE: Plaid API Account and Item Data Structure Example
DESCRIPTION: This JSON snippet illustrates a typical response structure from the Plaid API, showcasing details for an account (e.g., 'Plaid CD' with its official name, subtype, and type) and an item (including available and billed products, institution ID, item ID, and webhook URL). It provides insight into how Plaid structures financial data returned from its APIs.

SOURCE: https://plaid.com/docs/quickstart

LANGUAGE: JSON
CODE:
```
{
  "accounts": [
    {
      "name": "Plaid CD",
      "official_name": "Plaid Bronze Standard 0.2% Interest CD",
      "subtype": "cd",
      "type": "depository"
    }
  ],
  "item": {
    "available_products": [
      "assets",
      "balance",
      "identity",
      "investments",
      "transactions"
    ],
    "billed_products": ["auth"],
    "consent_expiration_time": null,
    "error": null,
    "institution_id": "ins_12",
    "item_id": "gVM8b7wWA5FEVkjVom3ri7oRXGG4mPIgNNrBy",
    "webhook": "https://requestb.in"
  },
  "request_id": "C3IZlexgvNTSukt"
}
```

--------------------------------

TITLE: Plaid Sandbox Test Credentials
DESCRIPTION: Credentials for simulating successful user logins within the Plaid Sandbox environment to test the integration flow.

SOURCE: https://plaid.com/docs/quickstart

LANGUAGE: text
CODE:
```
username: user_good
password: pass_good
If prompted to enter a 2FA code: 1234
```

--------------------------------

TITLE: Install Plaid Link JavaScript Library
DESCRIPTION: This HTML snippet demonstrates how to include the Plaid Link JavaScript library in your web application's `head` section. It's essential for initializing the Link UI.

SOURCE: https://plaid.com/docs/income/add-to-app

LANGUAGE: HTML
CODE:
```
<head>
  <title>Connect a bank</title>
  <script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"></script>
</head>
```

--------------------------------

TITLE: Install Plaid Node.js Client Library
DESCRIPTION: This snippet demonstrates how to install the official Plaid Node.js client library using npm.

SOURCE: https://plaid.com/docs/payment-initiation/add-to-app

LANGUAGE: Node
CODE:
```
npm install --save plaid
```

--------------------------------

TITLE: Install Plaid Link JavaScript Library (HTML)
DESCRIPTION: This HTML snippet shows how to include the Plaid Link JavaScript library in the `<head>` section of a web page. This library is essential for initializing and interacting with the Plaid Link flow on the client-side.

SOURCE: https://plaid.com/docs/income/add-to-app

LANGUAGE: HTML
CODE:
```
<head>
  <title>Connect a bank</title>
  <script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"></script>
</head>
```

--------------------------------

TITLE: Create Plaid Link Token (Node.js)
DESCRIPTION: Node.js server-side endpoint (`/api/create_link_token`) to generate a `link_token` using the Plaid API's `/link/token/create` endpoint. This token is essential for initializing Plaid Link on the client-side.

SOURCE: https://plaid.com/docs/quickstart

LANGUAGE: Node
CODE:
```
app.post('/api/create_link_token', async function (request, response) {
  // Get the client_user_id by searching for the current user
  const user = await User.find(...);
  const clientUserId = user.id;
  const request = {
    user: {
      // This should correspond to a unique id for the current user.
      client_user_id: clientUserId,
    },
    client_name: 'Plaid Test App',
    products: ['auth'],
    language: 'en',
    webhook: 'https://webhook.example.com',
    redirect_uri: 'https://domainname.com/oauth-page.html',
    country_codes: ['US'],
  };
  try {
    const createTokenResponse = await client.linkTokenCreate(request);
    response.json(createTokenResponse.data);
  } catch (error) {
    // handle error
  }
});
```

--------------------------------

TITLE: React: Client-side Plaid Link Integration
DESCRIPTION: This section demonstrates the client-side implementation for integrating Plaid Link in a React application. It covers generating a link token from a backend and then using it to initialize the Plaid Link UI, handling the successful linking event by sending the public token to the server.

SOURCE: https://plaid.com/docs/quickstart

LANGUAGE: TypeScript
CODE:
```
import { usePlaidLink } from 'react-plaid-link';

const App = () => {
  const [linkToken, setLinkToken] = useState(null);

  const generateToken = async () => {
    const response = await fetch('/api/create_link_token', {
      method: 'POST',
    });
    const data = await response.json();
    setLinkToken(data.link_token);
  };

  useEffect(() => {
    generateToken();
  }, []);

  return linkToken != null ? <Link linkToken={linkToken} /> : <></>;
};

interface LinkProps {
  linkToken: string | null;
}

const Link: React.FC<LinkProps> = (props: LinkProps) => {
  const onSuccess = React.useCallback((public_token, metadata) => {
    // send public_token to server
    const response = fetch('/api/set_access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ public_token }),
    });
    // Handle response ...
  }, []);

  const config: Parameters<typeof usePlaidLink>[0] = {
    token: props.linkToken!,
    onSuccess,
  };

  const { open, ready } = usePlaidLink(config);

  return (
    <button onClick={() => open()} disabled={!ready}>
      Link account
    </button>
  );
};
```

--------------------------------

TITLE: Stop Plaid Quickstart Docker Container
DESCRIPTION: Command to stop the running Plaid Quickstart Docker container for a specified language, effectively shutting down the application.

SOURCE: https://plaid.com/docs/quickstart

LANGUAGE: Shell
CODE:
```
$ make stop language=node
```

--------------------------------

TITLE: Node.js: Retrieve Plaid Account Information
DESCRIPTION: This Node.js server-side endpoint illustrates how to make an API call to Plaid's `/accounts/get` endpoint using a stored access token. It retrieves basic information such as account names and balances for the accounts associated with a linked Item.

SOURCE: https://plaid.com/docs/quickstart

LANGUAGE: Node.js
CODE:
```
app.get('/api/accounts', async function (request, response, next) {
  try {
    const accountsResponse = await client.accountsGet({
      access_token: accessToken,
    });
    prettyPrintResponse(accountsResponse);
    response.json(accountsResponse.data);
  } catch (error) {
    prettyPrintResponse(error);
    return response.json(formatError(error.response));
  }
});
```

--------------------------------

TITLE: Example Plaid Payment Initiation Consent Get Response
DESCRIPTION: An example JSON object representing the response from the Plaid Payment Initiation Consent GET endpoint, illustrating the structure and typical values for consent details, constraints, and payer information.

SOURCE: https://plaid.com/docs/api/products/payment-initiation

LANGUAGE: JSON
CODE:
```
{
  "request_id": "4ciYuuesdqSiUAB",
  "consent_id": "consent-id-production-feca8a7a-5491-4aef-9298-f3062bb735d3",
  "status": "AUTHORISED",
  "created_at": "2021-10-30T15:26:48Z",
  "recipient_id": "recipient-id-production-9b6b4679-914b-445b-9450-efbdb80296f6",
  "reference": "ref-00001",
  "constraints": {
    "valid_date_time": {
      "from": "2021-12-25T11:12:13Z",
      "to": "2022-12-31T15:26:48Z"
    },
    "max_payment_amount": {
      "currency": "GBP",
      "value": 100
    },
    "periodic_amounts": [
      {
        "amount": {
          "currency": "GBP",
          "value": 300
        },
        "interval": "WEEK",
        "alignment": "CALENDAR"
      }
    ]
  },
  "type": "SWEEPING"
}
```

--------------------------------

TITLE: Initialize Plaid Node.js Client
DESCRIPTION: Initializes the Plaid API client with your `client_id` and `secret` from environment variables. It configures the client for the Sandbox environment, automatically including authentication headers in all subsequent requests.

SOURCE: https://plaid.com/docs/income/add-to-app

LANGUAGE: Node
CODE:
```
const express = require('express');
const app = express();
app.use(express.json());

const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

const configuration = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const client = new PlaidApi(configuration);
```

--------------------------------

TITLE: Plaid API Error: USER_SETUP_REQUIRED Response Example
DESCRIPTION: Example JSON response for the `USER_SETUP_REQUIRED` error, indicating that the user must log in directly to their financial institution to take action before Plaid can access accounts.

SOURCE: https://plaid.com/docs/errors/item/index.html

LANGUAGE: json
CODE:
```
http code 400
{
 "error_type": "ITEM_ERROR",
 "error_code": "USER_SETUP_REQUIRED",
 "error_message": "the account has not been fully set up. prompt the user to visit the issuing institution's site and finish the setup process",
 "display_message": "The given account is not fully setup. Please visit your financial institution's website to setup your account.",
 "request_id": "HNTDNrA8F1shFEW"
}
```

--------------------------------

TITLE: Configure Plaid Link Client-Side Handler in JavaScript
DESCRIPTION: This JavaScript code configures the Plaid Link handler using `Plaid.create()`. It retrieves a `link_token` from the server and defines callbacks for success, exit, and events, then opens the Link UI.

SOURCE: https://plaid.com/docs/income/add-to-app

LANGUAGE: JavaScript
CODE:
```
const linkHandler = Plaid.create({
  token: (await $.post('/api/create_link_token_for_payroll_income')).link_token,
  onSuccess: (public_token, metadata) => {
    // Typically, you'd exchange the public_token for an access token.
    // While you can still do that here, it's not strictly necessary.
  },
  onExit: (err, metadata) => {
    // Optionally capture when your user exited the Link flow.
    // Storing this information can be helpful for support.
  },
  onEvent: (eventName, metadata) => {
    // Optionally capture Link flow events, streamed through
    // this callback as your users connect an Item to Plaid.
  },
});

linkHandler.open();
```

--------------------------------

TITLE: Handle Plaid Income Webhooks in Node.js
DESCRIPTION: This Node.js server-side code demonstrates how to set up an endpoint to listen for Plaid webhooks. It specifically checks for `INCOME: INCOME_VERIFICATION` webhooks to determine when a user's income data is ready for retrieval.

SOURCE: https://plaid.com/docs/income/add-to-app

LANGUAGE: Node.js
CODE:
```
app.post('/server/receive_webhook', async (req, res, next) => {
  const product = req.body.webhook_type;
  const code = req.body.webhook_code;
  if (product === 'INCOME' && code === 'INCOME_VERIFICATION') {
    const plaidUserId = req.body.user_id;
    const verificationStatus = req.body.verification_status;
    if (verificationStatus === 'VERIFICATION_STATUS_PROCESSING_COMPLETE') {
      await retrieveIncomeDataForUser(plaidUserId);
    } else {
      // Handle other cases
    }
  }
  // Handle other types of webhooks
});
```

--------------------------------

TITLE: Plaid API: Processor Token Permissions Get Response Example
DESCRIPTION: An illustrative JSON example of the successful response body returned by the `/processor/token/permissions/get` endpoint, showing typical `request_id` and `products` values.

SOURCE: https://plaid.com/docs/api/processors

LANGUAGE: JSON
CODE:
```
{
  "request_id": "xrQNYZ7Zoh6R7gV",
  "products": [
    "auth",
    "balance",
    "identity"
  ]
}
```

--------------------------------

TITLE: Plaid API: /link/token/get Endpoint
DESCRIPTION: This endpoint is used to obtain a public token, which is essential for initializing Plaid Link. It is the recommended method for consistency across Plaid products.

SOURCE: https://plaid.com/docs/income/add-to-app

LANGUAGE: APIDOC
CODE:
```
POST /link/token/get
  Request Body:
    link_token: string (required) - The Link token to retrieve session data for.
  Response:
    data: object - Contains session information.
```

--------------------------------

TITLE: Plaid API Accounts and Payment Risk Assessment Example
DESCRIPTION: An example JSON response object demonstrating the structure for Plaid API calls. It includes an array of `accounts` with their respective balances and details, and a `payment_risk_assessment` object providing risk levels, specific risk reasons, and various attributes related to transaction history and Plaid connection activity.

SOURCE: https://plaid.com/docs/balance/balance-plus

LANGUAGE: JSON
CODE:
```
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
    }
  ],
  "payment_risk_assessment": {
    "risk_level": "HIGH",
    "risk_reasons": [
      {
        "code": "PL03",
        "description": "High number of recent Plaid authentication attempts detected. Recommendation: Hold funds for 3-5 days or decline transactions at 'HIGH' risk level."
      },
      {
        "code": "PL05",
        "description": "Requested ACH transaction amount exceeds 90% of latest bank account balance. Recommendation: Hold funds for 3-5 days, or decline transactions at 'HIGH' risk level."
      }
    ],
    "exceeds_balance_threshold": true,
    "balance_last_updated": "2024-03-30T18:25:26Z",
    "attributes": {
      "unauthorized_transactions_count_7d": 0,
      "unauthorized_transactions_count_30d": 0,
      "unauthorized_transactions_count_60d": 1,
      "unauthorized_transactions_count_90d": 1,
      "nsf_overdraft_transactions_count_7d": 0,
      "nsf_overdraft_transactions_count_30d": 0,
      "nsf_overdraft_transactions_count_60d": 1,
      "nsf_overdraft_transactions_count_90d": 1,
      "days_since_first_plaid_connection": 380,
      "plaid_connections_count_7d": 2,
      "plaid_connections_count_30d": 5,
      "total_plaid_connections_count": 8,
      "plaid_non_oauth_authentication_attempts_count_3d": 3
    }
  }
}
```

--------------------------------

TITLE: Install Plaid Node.js Client Library
DESCRIPTION: This snippet demonstrates how to install the official Plaid Node.js client library using npm. It is the first step to integrate Plaid's API into your application.

SOURCE: https://plaid.com/docs/layer/add-to-app

LANGUAGE: Node
CODE:
```
// Install via npm
npm install --save plaid
```

--------------------------------

TITLE: Plaid API Error: PRODUCT_NOT_READY Response Example
DESCRIPTION: Example JSON response for the `PRODUCT_NOT_READY` error, indicating that the requested product is not yet ready. This error suggests providing a webhook or retrying the request later.

SOURCE: https://plaid.com/docs/errors/item/index.html

LANGUAGE: json
CODE:
```
http code 400
{
 "error_type": "ITEM_ERROR",
 "error_code": "PRODUCT_NOT_READY",
 "error_message": "the requested product is not yet ready. please provide a webhook or try the request again later",
 "display_message": null,
 "request_id": "HNTDNrA8F1shFEW"
}
```

--------------------------------

TITLE: Open Plaid Link Flow
DESCRIPTION: Example demonstrating how to call the `open()` method on a Plaid Link handler to start the user flow. This is typically done after initializing the Plaid Link instance.

SOURCE: https://plaid.com/docs/link/maintain-legacy-integration

LANGUAGE: JavaScript
CODE:
```
const handler = Plaid.create({ ... });

// Open Link
handler.open();
```

--------------------------------

TITLE: Initialize Plaid Link for First Time (Webview)
DESCRIPTION: This URL demonstrates the initial setup for Plaid Link within a webview. It includes the "isWebview=true" parameter and a placeholder for the "token" generated from your backend, which is essential for starting the Link flow.

SOURCE: https://plaid.com/docs/link/oauth

LANGUAGE: URL
CODE:
```
https://cdn.plaid.com/link/v2/stable/link.html?isWebview=true
&token=GENERATED_LINK_TOKEN
```

--------------------------------

TITLE: Node.js Investments Transactions Get Request Example
DESCRIPTION: A partial Node.js code example demonstrating how to construct a request for the `/investments/transactions/get` endpoint.

SOURCE: https://plaid.com/docs/api/products/investments

LANGUAGE: Node
CODE:
```
1const request: InvestmentsTransactionsGetRequest = {
```

--------------------------------

TITLE: Node.js: Exchange Plaid Public Token for Access Token
DESCRIPTION: This server-side Node.js endpoint demonstrates how to exchange a public token, received from the client-side Plaid Link, for a persistent access token using the Plaid `/item/public_token/exchange` API. The obtained access token and item ID should be securely stored in a database for future API calls.

SOURCE: https://plaid.com/docs/quickstart

LANGUAGE: Node.js
CODE:
```
app.post('/api/exchange_public_token', async function (
  request,
  response,
  next,
) {
  const publicToken = request.body.public_token;
  try {
    const response = await client.itemPublicTokenExchange({
      public_token: publicToken,
    });

    // These values should be saved to a persistent database and
    // associated with the currently signed-in user
    const accessToken = response.data.access_token;
    const itemID = response.data.item_id;

    res.json({ public_token_exchange: 'complete' });
  } catch (error) {
    // handle error
  }
});
```

--------------------------------

TITLE: Plaid Beacon Integration Initial Setup
DESCRIPTION: Outlines the initial steps for integrating Plaid Beacon, including creating a Beacon program via the Dashboard, obtaining the program ID, and optionally backfilling existing user data. Emphasizes consistent use of `client_user_id` across API calls for user identification.

SOURCE: https://plaid.com/docs/beacon

LANGUAGE: APIDOC
CODE:
```
1. Create a Beacon program via the Dashboard: https://dashboard.plaid.com/sandbox/beacon/programs/new
   * Recommendation: Disable "auto flag reported user" for data breach hits unless specifically required.
2. Note the beacon program ID (e.g., `becprg_7Fn5XcPhXnJJyU`). This ID is required when calling `/beacon/user/create` and other endpoints.
3. (Optional) Backfill six months of existing data into Beacon by calling `/beacon/user/create` for each user, ensuring known instances of fraud are included in the `report` object.

Important: Always use the same `client_user_id` when referring to the same end user across calls to:
- `/beacon/user/create`
- `/beacon/user/update`
- `/link/token/create`
```

--------------------------------

TITLE: Install Plaid Node.js Client Library via npm
DESCRIPTION: This snippet provides the command to install the official Plaid Node.js client library using npm. This library is crucial for interacting with the Plaid API from a Node.js application, enabling developers to integrate financial services functionalities.

SOURCE: https://plaid.com/docs/transactions/add-to-app

LANGUAGE: Node
CODE:
```
npm install --save plaid
```

--------------------------------

TITLE: Plaid Link Webview Initialization URL Example
DESCRIPTION: An example of the Plaid Link Webview initialization URL demonstrating how `isWebview`, `token`, and `receivedRedirectUri` parameters are appended as querystring arguments.

SOURCE: https://plaid.com/docs/link/webview

LANGUAGE: URL
CODE:
```
https://cdn.plaid.com/link/v2/stable/link.html
  ?isWebview=true
  &token="GENERATED_LINK_TOKEN"
  &receivedRedirectUri=
```

--------------------------------

TITLE: Plaid API Error: PRODUCTS_NOT_SUPPORTED Response Example
DESCRIPTION: Example JSON response for the `PRODUCTS_NOT_SUPPORTED` error, returned when a data request is made for an Item for a product it does not support.

SOURCE: https://plaid.com/docs/errors/item/index.html

LANGUAGE: json
CODE:
```
http code 400
{
 "error_type": "ITEM_ERROR",
 "error_code": "PRODUCTS_NOT_SUPPORTED",
 "error_message": "",
 "display_message": null,
 "request_id": "HNTDNrA8F1shFEW"
}
```

--------------------------------

TITLE: Plaid Product Access and Environment Details
DESCRIPTION: This section provides information on accessing Plaid products (Auth, Identity, Payment Initiation) across different environments. It clarifies that the Sandbox environment is for testing, while Production access requires specific requests or contact with Plaid sales/support.

SOURCE: https://plaid.com/docs/payment-initiation/user-onboarding-and-account-funding

LANGUAGE: APIDOC
CODE:
```
Plaid Products:
  - Auth
  - Identity
  - Payment Initiation

Environments:
  - Sandbox: Uses test data, does not interact with financial institutions.
  - Production: Requires product access request (dashboard.plaid.com/settings/team/products) or contact with Sales/Account Manager/Support.
```

--------------------------------

TITLE: Fetch Plaid Payroll and Document Income Data
DESCRIPTION: This Node.js snippet shows how to fetch a user's income data using the `/credit/payroll_income/get` endpoint after receiving a webhook. It uses `plaidClient.creditPayrollIncomeGet` and handles potential errors.

SOURCE: https://plaid.com/docs/income/add-to-app

LANGUAGE: Node.js
CODE:
```
try {
  const response = await plaidClient.creditPayrollIncomeGet({
    user_token: userToken,
  });
  const incomeData = response.data;
  // Do something interesting with the income data here.
} catch (error) {
  // Handle error
}
```

--------------------------------

TITLE: Plaid API Item and Account Data Structure Example
DESCRIPTION: A comprehensive JSON example demonstrating the data structure for Plaid API responses, including account-level metrics (authentication attempts, personal info changes, account status) and item-level details (available/billed products, institution info, item ID, webhook, auth method). This structure is typical for responses related to Plaid's Item and Account endpoints.

SOURCE: https://plaid.com/docs/balance/balance-plus

LANGUAGE: JSON
CODE:
```
{
  "account": {
    "plaid_non_oauth_authentication_attempts_count_7d": 5,
    "plaid_non_oauth_authentication_attempts_count_30d": 7,
    "failed_plaid_non_oauth_authentication_attempts_count_3d": 2,
    "failed_plaid_non_oauth_authentication_attempts_count_7d": 4,
    "failed_plaid_non_oauth_authentication_attempts_count_30d": 4,
    "phone_change_count_28d": 0,
    "phone_change_count_90d": 1,
    "email_change_count_28d": 0,
    "email_change_count_90d": 1,
    "address_change_count_28d": 0,
    "address_change_count_90d": 1,
    "is_savings_or_money_market_account": false,
    "is_account_closed": false,
    "is_account_frozen_or_restricted": false
  },
  "item": {
    "available_products": [
      "balance",
      "identity",
      "investments"
    ],
    "billed_products": [
      "assets",
      "auth",
      "liabilities",
      "transactions"
    ],
    "consent_expiration_time": null,
    "error": null,
    "institution_id": "ins_3",
    "institution_name": "Chase",
    "item_id": "eVBnVMp7zdTJLkRNr33Rs6zr7KNJqBFL9DrE6",
    "update_type": "background",
    "webhook": "https://www.example.com/webhook",
    "auth_method": "INSTANT_AUTH"
  },
  "request_id": "LhQf0THi8SH1yJk"
}
```

--------------------------------

TITLE: Plaid Income Get API Sample Response
DESCRIPTION: A JSON example demonstrating the data returned by the Plaid Income Get API. It includes details such as income streams with transactions, income sources with categories and frequencies, and metadata about the financial institution and item.

SOURCE: https://plaid.com/docs/api/products/income

LANGUAGE: json
CODE:
```
                {
                  "end_date": "2024-08-21",
                  "iso_currency_code": "USD",
                  "start_date": "2024-08-06",
                  "total_amount": 240.24,
                  "total_amounts": [
                    {
                      "amount": 240.24,
                      "iso_currency_code": "USD",
                      "unofficial_currency_code": null
                    }
                  ],
                  "transactions": [
                    {
                      "amount": 120.12,
                      "check_number": null,
                      "date": "2024-08-07",
                      "iso_currency_code": "USD",
                      "name": "TEXAS OAG CHILD SUPPORT",
                      "original_description": "TEXAS OAG CHILD SUPPORT",
                      "transaction_id": "EZMmvwREqlSGmlRam7bzFKyBll3kJjU4xKm1w",
                      "unofficial_currency_code": null
                    },
                    {
                      "amount": 120.12,
                      "check_number": null,
                      "date": "2024-08-21",
                      "iso_currency_code": "USD",
                      "name": "TEXAS OAG CHILD SUPPORT",
                      "original_description": "TEXAS OAG CHILD SUPPORT",
                      "transaction_id": "b7dkg6eQbPFQeRvVeZlxcqxZooa7nWSmb47dj",
                      "unofficial_currency_code": null
                    }
                  ],
                  "unofficial_currency_code": null
                }
              ],
              "income_category": "CHILD_SUPPORT",
              "income_description": "TEXAS OAG CHILD SUPPORT",
              "income_source_id": "c8e1576e-9de4-47b4-ad55-3f7b068cc863",
              "pay_frequency": "UNKNOWN",
              "start_date": "2024-08-07",
              "total_amount": 240.24,
              "transaction_count": 2
            }
          ],
          "institution_id": "ins_20",
          "institution_name": "Citizens Bank",
          "item_id": "L8EKo4GydxSKmJQGmXyPuDkeNn4rg9fP3MKLv",
          "last_updated_time": "2024-08-21T18:10:47.367335Z"
        }
      ]
    }
  ],
  "request_id": "MLM1fFu4fbVg7KR"
}
```

--------------------------------

TITLE: Example Plaid Processor Identity Get Response JSON
DESCRIPTION: An example JSON object demonstrating the structure of a successful `processor-identity-get-response` from the Plaid API, including detailed account, owner, email, and address information.

SOURCE: https://plaid.com/docs/api/processor-partners

LANGUAGE: JSON
CODE:
```
{
  "account": {
    "account_id": "XMGPJy4q1gsQoKd5z9R3tK8kJ9EWL8SdkgKMq",
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
    "owners": [
      {
        "addresses": [
          {
            "data": {
              "city": "Malakoff",
              "country": "US",
              "postal_code": "14236",
              "region": "NY",
              "street": "2992 Cameron Road"
            },
            "primary": true
          },
          {
            "data": {
              "city": "San Matias",
              "country": "US",
              "postal_code": "93405-2255",
              "region": "CA",
              "street": "2493 Leisure Lane"
            },
            "primary": false
          }
        ],
        "emails": [
          {
            "data": "accountholder0@example.com",
            "primary": true,
            "type": "primary"
          },
          {
            "data": "accountholder1@example.com",
            "primary": false,
            "type": "secondary"
          },
          {
            "data": "extraordinarily.long.email.username.123456@reallylonghostname.com",
            "primary": false,
            "type": "other"
          }
        ],
        "names": [
          "Alberta Bobbeth Charleson"
        ],
        "phone_numbers": [
          {
            "data": "2025550123",
            "primary": false,
            "type": "home"
          },
          {
            "data": "1112224444",
            "primary": false,
            "type": "work"
          },
          {
            "data": "1112225555",
            "primary": false,
            "type": "mobile1"
          }
        ]
      }
    ],
    "subtype": "checking",
    "type": "depository"
  },
  "request_id": "eOPkBl6t33veI2J"
}
```

--------------------------------

TITLE: Plaid Identity Verification: Create and Get Status Flow
DESCRIPTION: Describes the basic flow for initiating an identity verification session and subsequently retrieving its status. The `/identity_verification/create` endpoint is used to start a new session, returning a unique ID. This ID is then used with the `/identity_verification/get` endpoint to fetch the current status and details of the verification.

SOURCE: https://plaid.com/docs/identity-verification

LANGUAGE: APIDOC
CODE:
```
/identity_verification/create:
  Description: Initiates a new identity verification session.
  Usage: Should only be used to create an initial session for users who have never been verified before.
  Returns: An ID for the created verification session.

/identity_verification/get:
  Description: Retrieves the status and details of an identity verification session.
  Parameters:
    id: string (The ID returned by /identity_verification/create).
  Returns: The current status of the verification.
```

--------------------------------

TITLE: Add Started and Internal Error Statuses to Credit Sessions Get
DESCRIPTION: The 'STARTED' and 'INTERNAL_ERROR' statuses have been added to the /credit/sessions/get endpoint, providing more granular status updates for credit sessions.

SOURCE: https://plaid.com/docs/changelog

LANGUAGE: APIDOC
CODE:
```
Endpoint: /credit/sessions/get
Status Additions:
  - STARTED
  - INTERNAL_ERROR
```

--------------------------------

TITLE: Example JSON Payload for PRODUCT_READY Webhook
DESCRIPTION: This JSON object provides an example of the payload structure for the `PRODUCT_READY` webhook, showing typical values for its properties.

SOURCE: https://plaid.com/docs/api/products/assets

LANGUAGE: APIDOC
CODE:
```
{
  "webhook_type": "ASSETS",
  "webhook_code": "PRODUCT_READY",
  "asset_report_id": "47dfc92b-bba3-4583-809e-ce871b321f05",
  "report_type": "FULL"
}
```

--------------------------------

TITLE: Plaid API Error Response: Item Get Rate Limit Exceeded
DESCRIPTION: Example JSON error response for the ITEM_GET_LIMIT error code, indicating that too many requests were made to the /item/get endpoint. The HTTP status code is 429 (Too Many Requests).

SOURCE: https://plaid.com/docs/errors/rate-limit-exceeded

LANGUAGE: JSON
CODE:
```
{
 "error_type": "RATE_LIMIT_EXCEEDED",
 "error_code": "ITEM_GET_LIMIT",
 "error_message": "rate limit exceeded for attempts to access this item. please try again later",
 "display_message": null,
 "request_id": "HNTDNrA8F1shFEW"
}
```

--------------------------------

TITLE: Plaid API: /credit/bank_income/get Endpoint
DESCRIPTION: This endpoint retrieves static bank income data associated with a user. The data is a snapshot from when the user ran Link and does not update over time.

SOURCE: https://plaid.com/docs/income/add-to-app

LANGUAGE: APIDOC
CODE:
```
POST /credit/bank_income/get
  Request Body:
    user_token: string (required) - The user token created during Link configuration.
    options: object (optional)
      count: integer (optional) - The number of income reports to retrieve (default: 1).
```

--------------------------------

TITLE: Initial Setup for Plaid Beacon Program
DESCRIPTION: This snippet covers the initial configuration steps for setting up a Beacon program, including Dashboard actions and optional data backfilling using specific API endpoints. It emphasizes disabling 'auto flag reported user' for data breach hits unless necessary.

SOURCE: https://plaid.com/docs/beacon

LANGUAGE: APIDOC
CODE:
```
1. Create Beacon program via Dashboard (disable 'auto flag reported user' for data breach hits).
2. Open Identity Verification template editor, select Beacon program under Setup > Beacon Fraud Screening, then 'publish'.
3. (Optional) Backfill existing data:
   - For users through Identity Verification: Call `/beacon/report/create` using `beacon_user_id` from `/identity_verification/get`.
   - For users not through Identity Verification: Call `/beacon/user/create` for each user.

Note: Always use the same `client_user_id` for the same end user across `/beacon/user/create`, `/beacon/user/update`, and `/link/token/create`.
```

--------------------------------

TITLE: Plaid Webhook Configuration and Best Practices
DESCRIPTION: Guidelines for configuring webhooks in Plaid, including the use of `/link/token/create` for setting webhook URLs and managing account-level webhooks via the Dashboard. Webhooks are essential for many Plaid products to receive asynchronous updates and ensure data consistency.

SOURCE: https://plaid.com/docs/launch-checklist

LANGUAGE: APIDOC
CODE:
```
Plaid Webhook Configuration:
  Endpoint: /link/token/create
    Description: Used to create a Link token and specify a webhook URL for receiving events.
    Parameters:
      webhook: string (Required) - Your URL for receiving webhooks.
  Account-level Webhooks:
    Configuration: Via Plaid Dashboard (dashboard.plaid.com/developers/webhooks)
    Purpose: For specific products like Identity Verification, Transfer, Payment Initiation, and optional Auth micro-deposit events.
  Webhook IPs:
    Description: Ensure your infrastructure can receive webhooks from Plaid's official IP addresses for security and reliability.
    Reference: /docs/api/webhooks/
```

