================
CODE SNIPPETS
================
### Common Build and Start Commands

Source: https://render.com/docs/troubleshooting-deploys

Examples of typical commands used for installing dependencies, building projects, and starting applications in Node.js and Python environments.

```bash
npm install
```

```bash
pip install -r requirements.txt
```

```bash
npm start
```

```bash
gunicorn myapp:app
```

--------------------------------

### Ruby Build and Start Commands for Render

Source: https://render.com/docs/your-first-deploy

Details common commands for building and starting Ruby applications on Render. These commands are entered into the 'Build Command' and 'Start Command' fields.

```bash
bundle install
```

```bash
./bin/rails server
```

--------------------------------

### Static Site Build Commands

Source: https://render.com/docs/your-first-deploy

Examples of build commands for static site generators like Next.js, Create React App, Vue.js, and Jekyll. These commands are used to install dependencies and build static assets for deployment.

```bash
npm install && npm run build
```

```bash
bundle install && bundle exec jekyll build
```

--------------------------------

### Render Deploy Log - Success

Source: https://render.com/docs/your-first-deploy

Example log output indicating a successful deployment of a web service or a static site on Render. It shows the deploy process, including running build or start commands, and the final status indicating the service is live.

```bash
# Web service
==> Deploying...
==> Running 'npm start' # (or your start command)
==> Your service is live 🎉


# Static site
==> Uploading build...
==> Your site is live 🎉
```

--------------------------------

### Example Build Commands for Runtimes

Source: https://render.com/docs/deploys

Examples of build commands for various programming language runtimes. These commands are used during the build step of a Render deployment to compile code and install dependencies.

```shell
yarn
npm install
```

```shell
pip install -r requirements.txt
```

```shell
bundle install
```

```shell
go build -tags netgo -ldflags '-s -w' -o app
```

```shell
cargo build --release
```

```shell
mix phx.digest
```

--------------------------------

### Python Build and Start Commands

Source: https://render.com/docs/migrate-from-heroku

Example commands for building and starting a Python application on Render, using pip for dependency management and gunicorn for serving.

```bash
pip install -r requirements.txt
```

```bash
gunicorn your_application.wsgi
```

--------------------------------

### Node.js Web Service Build and Start Commands

Source: https://render.com/docs/web-services

This snippet shows typical build and start commands for a Node.js web service on Render. The build command installs dependencies, and the start command runs the application.

```bash
npm install
```

```bash
npm start
```

--------------------------------

### Node.js Build and Start Commands

Source: https://render.com/docs/migrate-from-heroku

Example commands for building and starting a Node.js application on Render. Assumes standard Node.js project structure and package management.

```bash
npm install
```

```bash
npm run start
```

--------------------------------

### Start Command Examples (Node.js, Python)

Source: https://render.com/docs/blueprint-spec

Specifies the command to start non-Docker services. Examples include starting a Node.js application or a Python WSGI server.

```bash
npm start
```

```bash
gunicorn your_application.wsgi
```

--------------------------------

### FastAPI Build and Start Commands for Render

Source: https://render.com/docs/deploy-fastapi

This snippet shows the essential commands needed to build and run a FastAPI application when deploying to Render. The build command installs project dependencies, and the start command launches the FastAPI server.

```bash
pip install -r requirements.txt
```

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

--------------------------------

### Phoenix App Setup and Dependency Installation

Source: https://render.com/docs/deploy-phoenix

Commands to install the Phoenix archive and create a new Phoenix project without Ecto, fetching and installing dependencies. It also includes changing the directory into the new project.

```shell
mix archive.install hex phx_new
mix phx.new phoenix_hello --no-ecto # also fetch and install dependencies
cd phoenix_hello
```

--------------------------------

### Database Configuration Example

Source: https://render.com/docs/deploy-rails-8

Shows an example of the `config/database.yml` file for a local PostgreSQL setup. It includes settings for development and a commented-out option for using environment variables for the password.

```yaml
development:
  <<: *default
  database: mysite_development
  username: postgres
  password: abc123


  # To provide a secure password via environment variable,
  # uncomment and use this format in place of the hardcoded
  # value above.
  #
  # password: <%= ENV["DATABASE_PASSWORD"] %>
```

--------------------------------

### Example render.yaml for Rails Deployment

Source: https://render.com/docs/deploy-rails-6-7

A sample render.yaml file demonstrating how to configure a Rails application for deployment on Render. This includes specifying the build command, start command, and environment variables.

```yaml
services:
  - type: web
    name: my-rails-app
    env: ruby
    buildCommand: "./bin/render-build.sh"
    startCommand: "bundle exec puma -C config/puma.rb"
    envVars:
      - key: RAILS_ENV
        value: "production"
      - key: DATABASE_URL
        fromValue: DATABASE_URL
```

--------------------------------

### Example Release Build Output

Source: https://render.com/docs/deploy-phoenix-distillery

Shows an example of the output generated when building a production release with Distillery, indicating the steps involved in assembling and packaging the release.

```bash
==> Assembling release..
==> Building release phoenix_distillery:0.1.0 using environment prod
==> Including ERTS 10.4.4 from /usr/local/Cellar/erlang/22.0.7/lib/erlang/erts-10.4.4
==> Packaging release..
Release successfully built!
To start the release you havenewBuilder

```

--------------------------------

### Install Render CLI with Script

Source: https://render.com/docs/cli

Installs the Render CLI by downloading and executing an installation script from a GitHub URL. This method is suitable for Linux and macOS systems.

```shell
$ curl -fsSL https://raw.githubusercontent.com/render-oss/cli/refs/heads/main/bin/install.sh | sh
```

--------------------------------

### Build and Start Commands for Pgweb Deployment

Source: https://render.com/docs/deploy-pgweb

These commands are used to build and run the Pgweb application on Render. The build command compiles the Go source code, and the start command executes the compiled binary, binding it to all available network interfaces.

```bash
go build -o app
```

```bash
./app --bind=0.0.0.0
```

--------------------------------

### Node.js Start Commands

Source: https://render.com/docs/deploys

Common commands to start Node.js applications on Render using package managers.

```shell
yarn start
```

```shell
npm start
```

```shell
node index.js
```

--------------------------------

### Start Strapi in Development Mode

Source: https://render.com/docs/deploy-strapi

Command to install dependencies and start the Strapi server in development mode. This is typically run on a local machine before creating content types.

```shell
yarn install && yarn develop
```

--------------------------------

### Remix App Build and Start Commands (Node.js)

Source: https://render.com/docs/deploy-remix

These commands are used to build and start a basic Remix application on Render. 'npm ci --production=false' installs dependencies including devDependencies, 'npm run build' compiles the application, and 'npm prune --production' removes development dependencies before starting the server with 'npm start'.

```bash
npm ci --production=false && npm run build && npm prune --production
```

```bash
npm start
```

--------------------------------

### Go Start Command

Source: https://render.com/docs/deploys

Command to execute a compiled Go binary.

```shell
./app
```

--------------------------------

### Ruby Start Command

Source: https://render.com/docs/deploys

Command to start a Ruby application using Puma, a web server.

```shell
bundle exec puma
```

--------------------------------

### Go Web Server Build and Start Commands

Source: https://render.com/docs/deploy-go-nethttp

Commands to build and run a Go web server application. The build command compiles the Go application with specific tags and linker flags, creating an executable named 'app'. The start command executes this compiled application.

```Go
go build -tags netgo -ldflags '-s -w' -o app
```

```Go
./app
```

--------------------------------

### Beego Web App Build and Start Commands (Go)

Source: https://render.com/docs/deploy-beego

Commands to build and start a Beego web application on Render. The build command compiles the Go application into an executable named 'app'. The start command then runs this executable.

```Go
go build -o app
```

```Go
./app
```

--------------------------------

### Procfile Example for Node.js Apps

Source: https://render.com/docs/migrate-from-heroku

This snippet shows an example Procfile, commonly used in Heroku applications, to define startup commands for different processes like web, worker, and release phase commands. The same principles apply across various programming languages.

```bash
# Procfile

# web process
web: npm run start

# non-web process
worker: npm run worker

# release phase command
release: db-migrate -e prod up
```

--------------------------------

### Install Dependencies and Collect Static Files (Python)

Source: https://render.com/docs/deploy-django

Installs project dependencies from `requirements.txt` and collects static files for deployment. This is a common setup step for Python web applications.

```bash
pip install -r requirements.txt
python manage.py collectstatic --no-input
python manage.py migrate
```

--------------------------------

### Local Executable Setup for Render MCP Server

Source: https://render.com/docs/mcp-server

Configures an AI application to run the Render MCP server executable directly on the local machine. It specifies the command to execute the server and sets the Render API key. Users must first install the MCP server executable.

```json
{
  "mcpServers": {
    "render": {
      "command": "/path/to/render-mcp-server-executable",
      "env": {
        "RENDER_API_KEY": "<YOUR_API_KEY>"
      }
    }
  }
}
```

--------------------------------

### Elixir Start Command

Source: https://render.com/docs/deploys

Command to start an Elixir application using the Phoenix framework.

```shell
mix phx.server
```

--------------------------------

### Render Web Service Configuration for ElysiaJS/Bun

Source: https://render.com/docs/deploy-elysiajs

Configuration settings for deploying an ElysiaJS application with Bun on Render via the dashboard. Specifies Node.js as the language, 'bun install' as the build command, and 'bun start' as the start command.

```Text
Setting| Value
---|---
**Language**| `Node`
**Build Command**| `bun install`
**Start Command**| `bun start`
```

--------------------------------

### Python Start Command

Source: https://render.com/docs/deploys

Command to start a Python application using Gunicorn, a WSGI HTTP Server.

```shell
gunicorn your_application.wsgi
```

--------------------------------

### Build Command Examples (Node.js, Python)

Source: https://render.com/docs/blueprint-spec

Specifies the command to build non-Docker services. Examples include installing Node.js dependencies or Python requirements.

```bash
npm install
```

```bash
pip install -r requirements.txt
```

--------------------------------

### HTTP Header Examples

Source: https://render.com/docs/static-site-headers

Provides examples of common HTTP header names and their corresponding values used for static site configuration on Render.

```text
Examples include:
  * `Cache-Control`
  * `X-Frame-Options`
  * `Referrer-Policy`

Examples include:
  * `public, max-age=86400`
  * `DENY`
  * `same-origin`

The header key is normalized and the value is appended to it to form the response:
  * `cache-control: public, max-age=86400`
  * `x-frame-options: DENY`
  * `referrer-policy: same-origin`
```

--------------------------------

### Install Render MCP Server using Curl Script (macOS/Linux)

Source: https://render.com/docs/mcp-server

This command downloads and executes an installation script for the Render MCP Server. It requires macOS or Linux and is the recommended method for local installation.

```shell
curl -fsSL https://raw.githubusercontent.com/render-oss/render-mcp-server/refs/heads/main/bin/install.sh | sh
```

--------------------------------

### Install Django and Freeze Requirements

Source: https://render.com/docs/deploy-django

Installs a specific version of Django using pip and then generates a `requirements.txt` file to record installed packages.

```shell
pip install django==5.0.1
pip freeze > requirements.txt
```

--------------------------------

### Verify Rails Installation

Source: https://render.com/docs/deploy-rails-8

Checks if Rails is installed and displays the installed version. This command is essential for confirming your development environment setup.

```shell
$ rails --version
  Rails 8.0.2
```

--------------------------------

### Node hapi App Deployment Configuration

Source: https://render.com/docs/deploy-node-hapi-app

Configuration values for deploying a Node.js hapi application on Render. This includes specifying the Node.js language, the npm install build command, and the node server.js start command.

```text
Language: Node
Build Command: npm install
Start Command: node server.js
```

--------------------------------

### Docker Setup for Render MCP Server

Source: https://render.com/docs/mcp-server

Configures an AI application to use the Render MCP server via a Docker container. It specifies the command to run the container, mounts a volume for configuration, and sets the Render API key as an environment variable. This method requires Docker to be installed.

```json
{
  "mcpServers": {
    "render": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "RENDER_API_KEY",
        "-v",
        "render-mcp-server-config:/config",
        "ghcr.io/render-oss/render-mcp-server"
      ],
      "env": {
        "RENDER_API_KEY": "<YOUR_API_KEY>"
      }
    }
  }
}
```

--------------------------------

### Example Render Deploy Hook URL with imgURL

Source: https://render.com/docs/deploy-an-image

An example of a complete Render deploy hook URL that includes an `imgURL` parameter. This URL, when accessed, will trigger a deployment using the specified image (`docker.io/library/nginx:1.26`) after proper URL encoding.

```text
https://api.render.com/deploy/srv-XXYYZZ?key=AABBCC&imgURL=docker.io%2Flibrary%2Fnginx%401.26
```

--------------------------------

### Example render.yaml Configuration

Source: https://render.com/docs/blueprint-spec

A comprehensive example of a `render.yaml` file demonstrating the usage of most supported fields for defining Render Blueprints. This file includes configurations for services, databases, and preview environments.

```yaml
#################################################################
# Example render.yaml                                           #
# Do not use this file directly! Consult it for reference only. #
#################################################################


previews:
  generation: automatic # Enable preview environments

```

--------------------------------

### Monorepo Structure Example

Source: https://render.com/docs/monorepo-support

Illustrates a typical monorepo structure with separate directories for a Python backend and a JavaScript frontend, demonstrating how multiple applications can coexist within a single repository.

```tree
📁 my-monorepo
|
├── README.md
├── 📁 backend
│   ├── app.py
│   ├── README.md
│   ├── requirements.txt
│   └── 📁 tests
│       └── test_app.py
└── 📁 frontend
    ├── 📁 components
    │   └── login.js
    ├── index.js
    ├── package.json
    ├── README.md
    └── 📁 src
        └── auth.js
```

--------------------------------

### Example PSQL Command for Terminal Connection

Source: https://render.com/docs/postgresql-creating-connecting

Provides an example command to initiate a psql session directly from a terminal. This is useful for quick command-line interaction with the database.

```shell
psql "postgresql://USER:PASSWORD@EXTERNAL_HOST:PORT/DATABASE"
```

--------------------------------

### Build Render CLI from Source

Source: https://render.com/docs/cli

Builds the Render CLI from its source code. This requires Go to be installed and involves cloning the repository and then compiling the executable.

```shell
$ git clone git@github.com:render-oss/cli.git
$ cd cli
$ go build -o render
```

--------------------------------

### Flask App Example (Python)

Source: https://render.com/docs/deploy-flask

This Python code defines a simple Flask application with a single route that returns 'Hello, World!'. It's a basic example demonstrating Flask's core functionality for web services.

```python
from flask import Flask
app = Flask(__name__)


@app.route('/')
def hello_world():
    return 'Hello, World!'

```

--------------------------------

### Example Docker Image URL with Digest

Source: https://render.com/docs/deploy-an-image

This example shows how to specify a Docker image using its SHA256 digest instead of a tag, ensuring the exact image version is used for deployment.

```docker
docker.io/library/alpine@sha256:c0669ef34cdc14332c0f1ab0c2c01acb91d96014b172f1a76f3a39e63d1f0bda
```

--------------------------------

### Build and Test Phoenix Release Locally

Source: https://render.com/docs/deploy-phoenix

Commands to build the Phoenix release using the `./build.sh` script and then start the server locally. It includes generating a secret key base for production and running the server, with instructions on how to connect remotely or stop the server.

```shell
$SECRET_KEY_BASE=`mix phx.gen.secret` _build/prod/rel/phoenix_hello/bin/server

# To start your system
# _build/prod/rel/phoenix_hello/bin/phoenix_hello start

# To connect to it remotely
# _build/prod/rel/phoenix_hello/bin/phoenix_hello remote

# To stop it gracefully (you may also send SIGINT/SIGTERM)
# _build/prod/rel/phoenix_hello/bin/phoenix_hello stop

# To list all commands:
# _build/prod/rel/phoenix_hello/bin/phoenix_hello
```

--------------------------------

### Install Dependencies and Freeze Requirements (Bash)

Source: https://render.com/docs/deploy-django

This bash command installs the 'dj-database-url' and 'psycopg2-binary' packages and then freezes the current project dependencies into a 'requirements.txt' file, essential for deployment.

```bash
$ pip install dj-database-url psycopg2-binary
$ pip freeze > requirements.txt
```

--------------------------------

### Ruby Sinatra Web Service Configuration

Source: https://render.com/docs/deploy-sidekiq-worker

Configuration for deploying a Ruby Sinatra web service on Render. This specifies the language, build command for dependency installation, and the start command to run the Sinatra application. It also includes the REDIS_URL environment variable for connecting to the Redis instance.

```yaml
type: "web"
name: "sinatra-web"
language: "ruby"

```

```text
Build Command: bundle install
Start Command: bundle exec ruby main.rb
Environment Variables:
  - key: "REDIS_URL"
    value: "<redis-connection-string>"
```

--------------------------------

### Database Connection String Configuration

Source: https://render.com/docs/troubleshooting-deploys

Example of configuring database connection settings, specifically addressing potential issues with SSL connections by setting `sslmode=require`.

```sql
postgresql://user:password@host:port/database?sslmode=require
```

--------------------------------

### Clone Repository and Build Render MCP Server from Source (Go)

Source: https://render.com/docs/mcp-server

This sequence of commands clones the Render MCP Server repository from GitHub and then builds the executable using the Go programming language. This method is recommended for users who need to make custom changes or if other installation methods fail.

```shell
git clone https://github.com/render-oss/render-mcp-server.git
cd render-mcp-server
go build
```

--------------------------------

### Render Log Explorer Wildcards and Regex Examples

Source: https://render.com/docs/logging

Provides examples of using wildcards and regular expressions in the Render Logs Explorer for advanced log searching and filtering.

```markdown
Search| Description  
---|---  
`foo*bar` |  Returns logs that contain `foo` followed by `bar` using wildcard search.  
`/foo.*bar/` |  Returns logs that contain `foo` followed by `bar` using a regular expression.  
`/(foo|bar)/` |  Returns logs that contain `foo` or `bar`.  
`status_code:/4../` |  Returns request logs with a `4xx` status code.  
`method:/(GET|POST)/` |  Returns request logs with a `GET` or `POST` method.  
`path:api/resource/*/subresource` |  Returns request logs with a path that starts with `api/resource/` and ends with `/subresource`.  
`/responseTimeMS=d{3}d+/` |  Returns request logs with a response time greater than one second.   
```

--------------------------------

### Ruby Sidekiq Background Worker Configuration

Source: https://render.com/docs/deploy-sidekiq-worker

Configuration for deploying a Ruby Sidekiq background worker on Render. This includes the language, build command to install dependencies, and the start command to run the Sidekiq process. It also specifies the REDIS_URL environment variable required for Redis connectivity.

```yaml
type: "webworker"
name: "sidekiq-worker"
language: "ruby"

```

```text
Build Command: bundle install
Start Command: bundle exec sidekiq -r ./main.rb
Environment Variables:
  - key: "REDIS_URL"
    value: "<redis-connection-string>"
```

--------------------------------

### Render MCP Server Configuration

Source: https://render.com/docs/mcp-server

Configuration examples for integrating the Render MCP server with various AI applications. This includes setting up the server URL and authentication headers.

```APIDOC
## Render MCP Server Integration

### Description
This section provides configuration details for integrating the Render MCP server with popular AI applications. It includes examples for Cursor, Claude Code, Claude Desktop, and Windsurf, demonstrating how to specify the server URL and authentication headers.

### Configuration Examples

#### Cursor Setup
Add the following to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "render": {
      "url": "https://mcp.render.com/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_API_KEY>"
      }
    }
  }
}
```

Replace `<YOUR_API_KEY>` with your Render API key.

#### Claude Code Setup
Run the following command, replacing `<YOUR_API_KEY>`:

```bash
claude mcp add --transport http render https://mcp.render.com/mcp --header "Authorization: Bearer <YOUR_API_KEY>"
```

#### Claude Desktop Setup
Add the following to your Claude Desktop MCP settings (e.g., `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "render": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://mcp.render.com/mcp",
        "--header",
        "Authorization: Bearer ${RENDER_API_KEY}"
      ],
      "env": {
        "RENDER_API_KEY": "<YOUR_API_KEY>"
      }
    }
  }
}
```

Replace `<YOUR_API_KEY>` with your Render API key.

#### Windsurf Setup
Add the following to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "render": {
      "url": "https://mcp.render.com/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_API_KEY>"
      }
    }
  }
}
```

Replace `<YOUR_API_KEY>` with your Render API key.

### Additional Resources
For setup instructions for other tools like VS Code, Zed, Gemini CLI, Crush, and Warp, please refer to their respective documentation.
```

--------------------------------

### Connect to Render Key Value with ioredis using URL

Source: https://render.com/docs/connecting-to-redis-with-ioredis

Connects to a Render Key Value instance using its URL, which is typically stored in an environment variable. This example demonstrates basic set and get operations.

```javascript
const Redis = require('ioredis')


const { REDIS_URL } = process.env
// Internal URL example:
// "redis://red-xxxxxxxxxxxxxxxxxxxx:6379"
// External URL is slightly different:
// "rediss://red-xxxxxxxxxxxxxxxxxxxx:PASSWORD@HOST:6379"


const keyValueClient = new Redis(REDIS_URL)


keyValueClient.set('animal', 'cat')


keyValueClient.get('animal').then((result) => {
  console.log(result) // Prints "cat"
})
```

--------------------------------

### HTTP Request Log Format Example

Source: https://render.com/docs/logging

An example of an HTTP request log entry, showing key information like timestamp, method, client IP, and the request ID for tracing.

```log
Nov 2 2:47:04 PM [GET] 400 clientIP="34.105.23.229" requestID="542c7b8b-c833-4b3c" ...
```

--------------------------------

### Install Rails Gem

Source: https://render.com/docs/deploy-rails-6-7

Installs the Rails gem using the Ruby gem installer. Ensure Ruby and other dependencies are pre-installed.

```shell
$ gem install rails
```

--------------------------------

### Redirect Rule Example

Source: https://render.com/docs/redirects-rewrites

An example of a redirect rule where requests to '/home' are redirected to '/'. This is a basic configuration for redirecting a specific path.

```text
Source| Destination
---|---
/home| /
```

--------------------------------

### Run Custom Docker Command with Multiple Commands

Source: https://render.com/docs/docker

This example shows how to execute multiple commands within a Docker container on Render. It uses `/bin/bash -c` to chain commands, such as running Django database migrations followed by starting a Gunicorn web server.

```bash
/bin/bash -c "python manage.py migrate && gunicorn myapp.wsgi:application --bind 0.0.0.0:10000"
```

--------------------------------

### Rust Start Command

Source: https://render.com/docs/deploys

Command to run a Rust application in release mode using Cargo.

```shell
cargo run --release
```

--------------------------------

### Install psycopg2 and dj-database-url for PostgreSQL

Source: https://render.com/docs/deploy-django

Installs the necessary Python packages for connecting to a PostgreSQL database using DJ-Database-URL for configuration and psycopg2 for database interaction. Updates the requirements.txt file.

```bash
# Install psycopg2
$ pip install psycopg2-binary

# Install dj-database-url
$ pip install dj-database-url

# Update requirements.txt
$ pip freeze > requirements.txt
```

--------------------------------

### Example Docker Image URL Format

Source: https://render.com/docs/deploying-an-image

Illustrates the different ways to specify a Docker image URL, including the use of digests instead of tags for precise versioning. Supports default values for host, namespace, and tag.

```docker
docker.io/library/alpine:latest
docker.io/library/alpine
library/alpine
alpine
```

```docker
docker.io/library/alpine@sha256:c0669ef34cdc14332c0f1ab0c2c01acb91d96014b172f1a76f3a39e63d1f0bda
```

--------------------------------

### Install Render CLI with Homebrew

Source: https://render.com/docs/cli

Installs the Render CLI using the Homebrew package manager on Linux and macOS. This is a simple command-line operation.

```shell
$ brew update
$ brew install render
```

--------------------------------

### Performing a Sidekiq Job

Source: https://render.com/docs/key-value

Example of defining and performing a Sidekiq background job.

```APIDOC
## Performing a Sidekiq Job

### Description
Defines a Sidekiq job and demonstrates how to perform it asynchronously.

### Method
N/A (Example)

### Endpoint
N/A

### Parameters
N/A

### Request Example
```ruby
class HardJob
  include Sidekiq::Job

  def perform(name, count)
    # do something
  end
end

HardJob.perform_async("bob", 5)
```

### Response
N/A

### Error Handling
N/A
```

--------------------------------

### Rewrite Rule Example

Source: https://render.com/docs/redirects-rewrites

An example of a rewrite rule where requests to '/blog/index.html' are rewritten to '/blog'. This is useful for cleaning up URLs or handling specific file paths.

```text
Source| Destination
---|---
/blog/index.html| /blog
```

--------------------------------

### Render Deploy Commands Overview

Source: https://render.com/docs/deploys

Render services proceed through a series of commands during each deploy: Build, Pre-deploy, and Start. Each command has a specific timeout and purpose.

```APIDOC
## Deploy Steps

Render services go through the following deploy steps:

### Build Command
- **Description**: Performs compilation and dependency installation.
- **Timeout**: 120 minutes.
- **Example (Node.js)**: `npm install`
- **Example (Python)**: `pip install -r requirements.txt`
- **Note**: Not applicable for Docker services; Render builds or pulls the image.

### Pre-deploy Command
- **Description**: Runs after build, before deploy. Used for tasks like database migrations. Executes on a separate instance.
- **Timeout**: 30 minutes.
- **Availability**: Paid web services, private services, background workers.

### Start Command
- **Description**: Runs to start the service when it's ready to deploy.
- **Timeout**: 15 minutes.
```

--------------------------------

### Run Django Development Server

Source: https://render.com/docs/deploy-django

Starts the Django development server to test the project locally.

```shell
python manage.py runserver
```

--------------------------------

### Read DATABASE_URL in Go

Source: https://render.com/docs/configure-environment-variables

Provides an example of how to get the 'DATABASE_URL' environment variable in Go using the os.Getenv function. Values are always retrieved as strings.

```go
package main
import "os"


func main() {
	databaseURL := os.Getenv("DATABASE_URL")
}
```

--------------------------------

### Connect to Render Key Value with Ruby

Source: https://render.com/docs/key-value

This Ruby snippet shows the basic setup for connecting to a Render Key Value instance using the 'redis' gem. It leverages the REDIS_URL environment variable for the connection string. Further operations like setting and getting values would follow after establishing the connection.

```ruby
require "redis"


# Connect to your internal Key Value instance using the REDIS_URL environment variable
# The REDIS_URL is set to the internal connection URL e.g. redis://red-343245ndffg023:6379
redis = Redis.new(url: ENV["REDIS_URL"])



```

--------------------------------

### Node.js MongoDB Connection

Source: https://render.com/docs/connect-to-mongodb-atlas

Provides information on connecting Node.js applications to MongoDB Atlas and performing CRUD operations. Specific code examples are not provided in the text, but the guide points to resources for implementation.

```javascript
// Guide to CRUD operations for Interacting with the Database in Node Applications
// Example connection string format:
mongodb+srv://<username>:<password>@<cluster-url>/test?retryWrites=true&w=majority
```

--------------------------------

### Install Gunicorn and Uvicorn (Python)

Source: https://render.com/docs/deploy-django

Installs the Gunicorn and Uvicorn packages, which are necessary for running a Python web application with Uvicorn workers. The output is then saved to `requirements.txt`.

```bash
pip install gunicorn uvicorn
pip freeze > requirements.txt
```

--------------------------------

### render.yaml for ElysiaJS/Bun Deployment on Render

Source: https://render.com/docs/deploy-elysiajs

Example of a `render.yaml` file for Infrastructure as Code deployment of an ElysiaJS application with Bun. This file specifies the repository URL and service configuration.

```YAML
# Example render.yaml content
# Specify your repository URL here
# repo: "YOUR_GITHUB_REPO_URL"

```

--------------------------------

### Create and Activate Python Virtual Environment

Source: https://render.com/docs/deploy-django

Creates a new project directory, sets up a Python virtual environment using `venv`, and activates it for package installations.

```shell
mkdir mysite
cd mysite
python -m venv venv
source venv/bin/activate
```

--------------------------------

### Install PostgreSQL for Strapi

Source: https://render.com/docs/deploy-strapi

Installs the 'pg' npm package, which is required for Strapi to connect to a PostgreSQL database. This is a dependency for deployments using PostgreSQL.

```bash
npm install pg
```

--------------------------------

### Render Service Configuration for Phoenix App

Source: https://render.com/docs/deploy-phoenix

Instructions for configuring a new web service on Render for a Phoenix application. It specifies the Language as 'Elixir', the Build Command as './build.sh', and the Start Command as '_build/prod/rel/phoenix_hello/bin/server'. It also details adding the SECRET_KEY_BASE environment variable.

```text
Language: `Elixir`
Build Command: `./build.sh`
Start Command: `_build/prod/rel/phoenix_hello/bin/server`

Environment Variable:
Key: `SECRET_KEY_BASE`
Value: A sufficiently strong secret. Generate it locally by running `mix phx.gen.secret`
```

--------------------------------

### Header Path Matching Examples

Source: https://render.com/docs/static-site-headers

Illustrates different ways to match request paths for applying custom HTTP headers. Supports wildcard characters for flexible matching.

```text
Path| Effect  
---|---
`/*`| Matches all request paths.
`/blog/*`| Matches `/blog/`, `/blog/latest-post/`, and all other paths under `/blog/`
`/**/*`| Matches `/blog/`, `/assets/`, and all other paths with at least two slashes.
`/*.css`| Matches `/tokens.css` and `/mode.css`, but not `/assets/theme.css`
`/**/*.css`| Matches `/assets/theme.css` but not `/tokens.css`
```

--------------------------------

### Configure Celery Background Worker (Python)

Source: https://render.com/docs/deploy-celery

This section details the configuration for a Python-based Celery background worker on Render. It specifies the language, build command to install dependencies, and the start command to run the Celery worker process. An environment variable `CELERY_BROKER_URL` is crucial for connecting the worker to the message broker.

```Python
# Render Background Worker Configuration
Language: Python 3
Build Command: pip install -r requirements.txt
Start Command: celery --app tasks worker --loglevel info --concurrency 4

Environment Variables:
Key: CELERY_BROKER_URL
Value: <Internal Key Value URL>
```

--------------------------------

### Example Query for Performance Analysis

Source: https://render.com/docs/postgresql-performance-troubleshooting

An example SQL query used to demonstrate EXPLAIN and EXPLAIN ANALYZE functionalities. It selects recent databases, filters out deleted ones, and orders by creation date.

```sql
SELECT id, database_id, name
FROM postgres_dbs
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 200;
```

--------------------------------

### Start Rails Development Server

Source: https://render.com/docs/deploy-rails-8

Starts the local development server for your Rails application, allowing you to preview changes at `localhost:3000`.

```shell
$ bin/dev
```

--------------------------------

### Render Webhook Request Headers Example (YAML)

Source: https://render.com/docs/webhooks

This snippet shows an example of the headers included in a Render webhook notification request. These headers are essential for identifying and validating the notification.

```yaml
webhook-id: evt-cv4cjhnnoe9s73c9l7s0
webhook-timestamp: 1741212102
webhook-signature: v1,XcslFHBlNT6cZYDOJVYUJGZMCNZgTArfO34vTJmjrj4=
```

--------------------------------

### Deploy Bun HTTP Server with Docker (Dockerfile Example)

Source: https://render.com/docs/deploy-bun-docker

This snippet demonstrates the necessary Dockerfile configuration to deploy a Bun HTTP server. It assumes a basic Bun application structure and uses Docker to containerize the application for deployment on Render.

```dockerfile
FROM oven/bun:latest

WORKDIR /app

COPY package.json bun.lock* ./ 
RUN bun install

COPY . .

RUN bun build --public

EXPOSE 3000

CMD ["bun", "run", "start"]
```

--------------------------------

### SvelteKit Node Server Deployment Configuration

Source: https://render.com/docs/deploy-sveltekit

Configuration details for deploying a SvelteKit application as a Node Server on Render. This includes the language, build command, and start command required for the service.

```text
Language: `Node`
Build Command: `npm install && npm run build`
Start Command: `node build/index.js`
```

--------------------------------

### Run Project Locally with Gunicorn and Uvicorn (Python)

Source: https://render.com/docs/deploy-django

Starts the Django project locally using Gunicorn with Uvicorn workers. Replace `mysite` with your actual project name.

```bash
python -m gunicorn mysite.asgi:application -k uvicorn.workers.UvicornWorker
```

--------------------------------

### Install and Use Rust Toolchain in Build Command

Source: https://render.com/docs/rust-toolchain

If you override the toolchain in your build command using `cargo +<toolchain>...`, the specified toolchain must be installed. You can install new toolchains using `rustup` as part of your build command.

```bash
rustup install nightly-2020-03-15
cargo +nightly build
```

--------------------------------

### Run Shopify App in Development Mode

Source: https://render.com/docs/deploy-shopify-app

Starts the Shopify application in development mode. This command also sets up a local SQLite database and its migration schema. It prompts to associate the project with a Shopify app and creates a development store.

```bash
npm run dev
```

--------------------------------

### External Redirect Example

Source: https://render.com/docs/redirects-rewrites

An example of a redirect rule that sends requests from '/web-host' to an external URL 'https://render.com'. This is used when moving resources to a different domain.

```text
Source| Destination
---|---
/web-host| https://render.com
```

--------------------------------

### Node.js Syntax Error Example

Source: https://render.com/docs/troubleshooting-deploys

Illustrates a 'SyntaxError: Unexpected token' which typically occurs when the Node.js version used in the Render environment does not support a specific operator or method present in the code.

```javascript
SyntaxError: Unexpected token '??='

```

--------------------------------

### Shopify CLI Help Command

Source: https://render.com/docs/deploy-shopify-app

Displays a help message with an overview of available Shopify CLI commands, including options for managing apps.

```bash
npm run shopify app -- --help
```

--------------------------------

### Example Internal Address for Private Service

Source: https://render.com/docs/private-network

An example of an internal address for a private service on Render's private network. This format includes the service name and port.

```text
elasticsearch-2j3e:9200
```

--------------------------------

### Connect to ClickHouse using clickhouse-client

Source: https://render.com/docs/deploy-clickhouse

This command demonstrates how to connect to a ClickHouse instance using the `clickhouse-client` utility. It requires the host address of the ClickHouse service. The example shows connecting to a service named `clickhouse-xyz`.

```bash
$ clickhouse-client --host clickhouse-xyz
```

--------------------------------

### Install Formspree CLI with npm

Source: https://render.com/docs/formspree

Installs the Formspree CLI package as a project dependency using npm.

```shell
$ npm install -save @formspree/cli
```

--------------------------------

### Jekyll Build and Publish Configuration

Source: https://render.com/docs/deploy-jekyll

This configuration specifies the commands and directories required to build and publish a Jekyll static site on Render. It assumes a standard Jekyll setup.

```shell
bundle exec jekyll build
```

```text
_site
```

--------------------------------

### Create Phoenix App and Set Up Dependencies

Source: https://render.com/docs/deploy-elixir-cluster

Installs the Phoenix project generator and creates a new Phoenix application without a database, then navigates into the application directory. This sets the foundation for the Elixir cluster.

```shell
# install phx.new; feel free to change 1.4.9 to a different version
$ mix archive.install hex phx_new 1.4.9
  # create a new Phoenix app
$ mix phx.new elixir_cluster_demo --no-ecto # also fetch and install dependencies
$ cd elixir_cluster_demo

```

--------------------------------

### Build Release Locally Example

Source: https://render.com/docs/deploy-elixir-cluster

This shows the expected output when running the `build.sh` script locally to compile the Elixir release. It demonstrates the steps involved in preparing the application for deployment.

```bash
Generated elixir_cluster_demo app
* assembling elixir_cluster_demo-0.1.0 on MIX_ENV=prod
* using config/releases.exs to configure the release at runtime
* skipping elixir.bat for windows (bin/elixir.bat not found in the Elixir installation)
* skipping iex.bat for windows (bin/iex.bat not found in the Elixir installation)


Release created at _build/prod/rel/elixir_cluster_demo!


    # To start your system
    _build/prod/rel/elixir_cluster_demo/bin/elixir_cluster_demo start


Once the release is running: 


    # To connect to it remotely
    _build/prod/rel/elixir_cluster_demo/bin/elixir_cluster_demo remote


    # To stop it gracefully (you may also send SIGINT/SIGTERM)
    _build/prod/rel/elixir_cluster_demo/bin/elixir_cluster_demo stop


To list all commands:


    _build/prod/rel/elixir_cluster_demo/bin/elixir_cluster_demo

```

--------------------------------

### Install Formspree CLI with yarn

Source: https://render.com/docs/formspree

Installs the Formspree CLI package as a project dependency using yarn.

```shell
$ yarn add @formspree/cli
```

--------------------------------

### Example Internal Address with Protocol

Source: https://render.com/docs/private-network

An example of an internal address for a private service that specifies the protocol. This is sometimes necessary for establishing connections.

```text
http://elastic-qeqj:10000
```

--------------------------------

### Example 1: Autoscaling Up (CPU)

Source: https://render.com/docs/scaling

Demonstrates how Render's autoscaling logic calculates an increase in instances when current CPU utilization exceeds the target CPU utilization. The service is scaled up immediately.

```text
new_instances = ceil[2 * (80% / 60%)] = 3
```

--------------------------------

### Python Build Command: Install Dependencies

Source: https://render.com/docs/troubleshooting-python-deploys

This snippet shows how to configure the build command in Render to install Python dependencies using either pip or Poetry. Ensure the correct dependency management file (requirements.txt or pyproject.toml/poetry.lock) is committed to your repository.

```shell
pip install -r requirements.txt
```

```shell
poetry install
```

--------------------------------

### PostgreSQL High Availability Setup

Source: https://render.com/docs/blueprint-spec

Enables high availability for a PostgreSQL instance by adding a standby replica. Requires specific workspace and instance type prerequisites.

```yaml
highAvailability:
  enabled: true
```

--------------------------------

### Render Blueprint Configuration (render.yaml)

Source: https://render.com/docs/deploy-rails-8

Defines a Render web service and a Render Postgres database using YAML. Includes runtime, plan, build/start commands, and environment variables, with an example for `render.yaml`.

```yaml
services:
  - type: web
    name: mysite
    runtime: ruby
    plan: free
    buildCommand: './bin/render-build.sh'
    # preDeployCommand: "bundle exec rails db:migrate" # preDeployCommand only available on paid instance types
    startCommand: './bin/rails server'
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: mysite-db
          property: connectionString
      - key: RAILS_MASTER_KEY
        sync: false # You'll provide this value on Blueprint creation
      - key: WEB_CONCURRENCY
        value: 2 # Recommended default
databases:
  - name: mysite-db
    plan: free

```

--------------------------------

### Run Phoenix App in Foreground with PostgreSQL

Source: https://render.com/docs/deploy-phoenix-distillery

Starts the Phoenix application in the foreground, requiring a PostgreSQL database to be running locally and configured via the DATABASE_URL environment variable.

```shell
export DATABASE_URL=postgresql://username:password@127.0.0.1:5432/phoenix_distillery
_build/prod/rel/phoenix_distillery/bin/phoenix_distillery foreground
```

--------------------------------

### SSH Connection Example

Source: https://render.com/docs/disks

Demonstrates the format of an SSH command to connect to a Render service. This is a prerequisite for using SCP to transfer files.

```shell
$ ssh YOUR_SERVICE@ssh.YOUR_REGION.render.com
```

--------------------------------

### Initialize Shopify App Project with npm

Source: https://render.com/docs/deploy-shopify-app

Creates a new Shopify app project using the Shopify CLI. This command prompts for project name, framework (Remix recommended), and language (JavaScript/TypeScript). It sets up the project directory and initializes the app.

```bash
npm init @shopify/app@latest
```

--------------------------------

### Install and Send File with Magic-Wormhole (Shell)

Source: https://render.com/docs/disks

Installs the magic-wormhole library on a Docker-backed service using apt and then sends a specified file. The wormhole code is outputted for receiving the file on another machine.

```shell
$ apt update && apt install magic-wormhole
$ wormhole send /path/to/filename.txt
  Sending 10.5 MB file named 'filename.txt'
  Wormhole code is: 4-forever-regain
```

--------------------------------

### Rails Web Service Configuration on Render

Source: https://render.com/docs/deploy-rails-sidekiq

Configuration for a Ruby Rails web service on Render. Includes build and start commands, and essential environment variables like REDIS_URL and RAILS_MASTER_KEY.

```Ruby
bundle install; bundle exec rake assets:precompile; bundle exec rake assets:clean;
```

```Ruby
bundle exec puma -t 5:5 -p ${PORT:-3000} -e ${RACK_ENV:-development}
```

```text
REDIS_URL
<Internal URL>, the internal Key Value URL from step 1.
RAILS_MASTER_KEY
Your Rails application's RAILS_MASTER_KEY
```

--------------------------------

### Render Blueprint Spec Example

Source: https://render.com/docs/deploy-redwood

This is a snippet of a `render.yaml` file, which defines the infrastructure for your RedwoodJS application on Render. It specifies services, environment variables (like `NODE_VERSION`), and potentially database configurations.

```yaml
services:
  - type: web
    name: my-redwood-app-api
    env: node
    buildCommand: yarn rw build
    startCommand: yarn rw start api
    envVars:
      - key: NODE_VERSION
        value: "18"
  - type: web
    name: my-redwood-app-web
    env: static
    buildCommand: yarn rw build
    buildPath: web/dist
    # Redirects/Rewrites will be configured post-deployment.
```