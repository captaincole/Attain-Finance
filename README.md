# Personal Finance MCP Server

Model Context Protocol (MCP) server built with Express.js that provides personal finance tools and data.

## Getting Started

This readme is written by humans only, and is ment for human consumption. If you want to add documentation for the AI, please use the claude.md or agents.md files that exist.

Welcome to the project :) 

### Clone and run locally

```bash
git clone https://github.com/yourusername/personal-finance-mcp
npm install
npm run dev
```

You will also need to create a .env file and get credentials in order to run this application.

### Connect to an AI Client

To connect to a client like claude code, you can add this config to your .mcp.json file in a folder.

```json
  "mcpServers": {
    "pfinance": {
       "type":"http",
       "url": "http://localhost:3000/mcp"
    }
  }
```

To connect via ChatGPT, you need to expose your dev server using ngrok, or you can use the vercel live url: https://personal-finance-mcp.vercel.app

The steps are:

1) Turn on developer mode
2) Add a new connector, using the url https://personal-finance-mcp.vercel.app
3) Select Oauth for authentication

Then ChatGPT should do the rest.

### Testing

To run the automated tests, simply run

```bash
npm test
```

We have integration tests that mock the external services of plaid, clerk, and supabase so that we can run against our authenticated endpoints. 

## Architecture 

The MCP server is what serves the entire application. The entrypoint for this server is src/index.ts which is an express.js server that serves most of our mcp endpoints at /mcp 

The important routes are threefold, the authentication routes, the tool routes, and the resource routes.

## Services

We use three third party services

1) Plaid - This is our connection to financial data. We have a sandbox user and account that you can connect to as well that is easier to run tests with. 
2) Clerk - This is used to authenticate our users, and we went with this service specifically because it supports Oauth 2.1 Dynmaic Client Registration which is needed for a simple auth flow
3) Supabase - We store relatively little user data here but its necessary to manage connection status and simple account information of our users.

## Widgets

OpenAI now supports display widgets for mcp servers, and we have taken advantage of this. After some research the pattern is as follows

1) When you register your server, OpenAI makes a `tools/list` POST to our endpoint
2) OpenAI expects _meta tags to return a list of widget files as "resources" 
3) OpenAI then requests those resources so it can cache them on their end
4) When the user makes a tool call, the tool also returns a _meta object that tells chat which resources to show in collaboration to the response of the tool call.

