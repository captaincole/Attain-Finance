# Personal Finance MCP Server

Model Context Protocol (MCP) server built with Express.js that provides personal finance tools and data.

## Getting Started

This readme is written by humans only, and is ment for human consumption. If you want to add documentation for the AI, please use the claude.md or agents.md files that exist.

Welcome to the project :) 

### Clone and run locally

```bash
git clone ...
npm install
npm run dev
```

You will also need to create a .env file and get credentials in order to run this application.

### Connect to an AI Client

To connect to a client like claude code, you can add this config to your .mcp.json file in a folder.

```json
  "mcpServers": {
    "attainFinance": {
       "type":"http",
       "url": "http://localhost:3000/mcp"
    }
  }
```

To connect via ChatGPT, you need to expose your dev server using ngrok, or you can use the vercel live url: https://app.attainfinance.io/mcp

The steps are:

1) Turn on developer mode
2) Add a new connector, using the url https://app.attainfinance.io/mcp
3) Select Oauth for authentication

Then ChatGPT should do the rest.

## Testing
To run the automated tests, you will need to have docker desktop setup so you can create a local supabase db needed to run the integration tests. Once you start docker desktop, you should then be able to run

Reminder: You will need a .env.test file to run this as well. Please request that before you run the tests.

```bash
npm test
```

We have integration tests that mock the external services of plaid, clerk, and supabase so that we can run against our authenticated endpoints. 

### Manual Testing

Here is the setup I've been using to run manual testing locally. 

* First run the dev server via `npm run dev`
* Connect claude code to localhost:3000/mcp via .mcp.json config
* I copy paste the auth url generated into a chrome incognito tab, because the ability to "signout" of an session in clerk is inconvienient.
* After creating or singing into the user, I then run the connect-accounts tool by asking claude to connect a bank account. I copy paste that url as well into a incognito window
* That should get you started, then all the background tasks should start executing

* I have a reset-user tool that is accessible via `npm run reset-user -- --userId=` and will delete all the data in supabase so you can start over and not pollute the db. You don't have to delete your user in clerk and can just resign in. 

You can do the same thing locally to test with OpenAI, but you need to use ngrok to expose you local port, as OpenAI isn't running locally. I haven't tried this though...


## Architecture 

The MCP server is what serves the entire application. The entrypoint for this server is src/index.ts which is an express.js server that serves most of our mcp endpoints at /mcp 

The important routes are threefold, the authentication routes, the tool routes, and the resource routes.

## Authentication

Authentication in this project is probably one of the most complicated things. There are two parts to the authentication system, the original Oauth 2.1 handshake with the AI client to established a connection, and the authentication with supabase to validate that the appropriate user is accessing only their own data. 

### MCP Auth, DCR

Our service strongly follows the patterns outlined here [MCP Auth Scheme](https://modelcontextprotocol.io/specification/draft/basic/authorization)

The pattern is documented in the diagram that is in the link above, and involves multiple calls to URLs such as 

`/.well-known/oauth-authorization-serve`

You can see our implementation of it starts in `index.ts` here:

```ts
  registerMcpRoutes(app, server);
  registerOauthDiscoveryRoutes(app); // Discovery Routes
  registerDomainRoutes(app, plaidClient);
  registerDataRoutes(app);
  registerVisualizationRoutes(app);
```

Once the user and the users AI client is authenticated, that client now has a Clerk certifiable Oauth token, which it will pass with every request after, and we will catch and verify with our clerk middleware. 

```ts
  // index.ts
  app.use(clerkMiddleware());
  app.use(express.json());
```

We use Clerk as our authentication provider, because Supabase has yet to implement DCR. [See This Github Issue](https://github.com/orgs/supabase/discussions/38022#discussioncomment-14503663) - if this was available it could have greatly simplified our RLS architecture. 

### Supabase Auth, Row Level Security

To make sure that the user is only able to access the data that they are supposed to see, we have implemented RLS on certain tables. The customization we had to add to this is, because we don't have the full Clerk JWT, we can't use the pre built integration with Clerk and Supabase. Instead, we wrap the Clerk oauth token that we got in our own Supabase JWt so that it can provide userID to the db to verify access to the row. 

## Services

We use four third party services

1) Plaid - This is our connection to financial data. We have a sandbox user and account that you can connect to as well that is easier to run tests with. 
2) Clerk - This is used to authenticate our users, and we went with this service specifically because it supports Oauth 2.1 Dynmaic Client Registration which is needed for a simple auth flow
3) Supabase - We store relatively little user data here but its necessary to manage connection status and simple account information of our users.
4) Render - This is where our service is hosted, and it is connected to auto deploy off of pushes to `main`


## Widgets

OpenAI now supports display widgets for mcp servers, and we have taken advantage of this. After some research the pattern is as follows

1) When you register your server, OpenAI makes a `tools/list` POST to our endpoint
2) OpenAI expects _meta tags to return a list of widget files as "resources" 
3) OpenAI then requests those resources so it can cache them on their end
4) When the user makes a tool call, the tool also returns a _meta object that tells chat which resources to show in collaboration to the response of the tool call.

## Background Tasks
There are two background tasks that are triggered during the plaid account connection callback. Specifically we:

* Retrieve account status from Plaid, so that there is something really quick for the user to see
* Retrieve all the transactions for the account that was just connected, and start a Claude API based process for categorizing them.

There is an additional background task that is triggered when a user creates a budget, which goes and uses the Claude API to classify if a transaction should be in that budget or not. 