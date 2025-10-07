# Build a Custom UX

Build custom UI components & app page.

## Overview

UI components turn structured tool results into a human-friendly UI. Apps SDK components are typically React components that run inside an iframe, talk to the host via the `window.openai` API, and render inline with the conversation.

## Understand the window.openai API

`window.openai` is the bridge between your iframe and ChatGPT. Use this quick reference to understand how to wire up data, state, and layout concerns.

### Key Concepts

- **Layout globals** exposed by the host: `displayMode`, `maxHeight`, `theme`, `locale`
- **Tool payloads** scoped to the current message: `toolInput`, `toolOutput`, and a host-persisted `widgetState`
- **Actions** you can call from the iframe: `setWidgetState`, `callTool`, `sendFollowupTurn`, `requestDisplayMode`
- **Events** you can listen to: `openai:set_globals` and `openai:tool_response`

### Access Tool Data

To access the `structuredContent` output of your MCP call result, read from `window.openai.toolOutput`. For the inputs, use `window.openai.toolInput`.

```typescript
const toolInput = window.openai?.toolInput as { city?: string } | undefined;
const toolOutput = window.openai?.toolOutput as PizzaListState | undefined;

const places = toolOutput?.places ?? [];
const favorites = toolOutput?.favorites ?? [];

useEffect(() => {
  if (!toolOutput) return;
  // keep analytics, caches, or derived data in sync with the latest tool response
}, [toolOutput]);
```

### Persist Component State

Use `window.openai.setWidgetState` when you want to remember UI decisions—favorites, filters, or drafts—across renders. Save a new snapshot after every meaningful change so the host can restore the component where the user left off.

Read from `widgetState` first on mount, and fall back to `toolOutput` when state isn't set yet.

```typescript
async function persistFavorites(favorites: string[]) {
  const places = window.openai?.toolOutput?.places ?? [];
  await window.openai?.setWidgetState?.({
    __v: 1,
    places,
    favorites,
  });
}

const initial: PizzaListState =
  window.openai?.widgetState ??
  window.openai?.toolOutput ?? {
    places: [],
    favorites: [],
  };
```

### Trigger Server Actions

`window.openai.callTool` lets the component directly make MCP tool calls. Use this for direct manipulations (refresh data, fetch nearby restaurants). Design tools to be idempotent where possible and return updated structured content that the model can reason over in subsequent turns.

**Note:** Your tool needs to be marked as able to be initiated by the component.

```typescript
async function refreshPlaces(city: string) {
  await window.openai?.callTool("refresh_pizza_list", { city });
}
```

### Send Conversational Follow-ups

Use `window.openai.sendFollowupTurn` to insert a message into the conversation as if the user asked it.

```typescript
await window.openai?.sendFollowupTurn({
  prompt: "Draft a tasting itinerary for the pizzerias I favorited.",
});
```

### Request Alternate Layouts

If the UI needs more space—like maps, tables, or embedded editors—ask the host to change the container. `window.openai.requestDisplayMode` negotiates inline, PiP, or fullscreen presentations.

```typescript
await window.openai?.requestDisplayMode({ mode: "fullscreen" });
// Note: on mobile, PiP may be coerced to fullscreen
```

### Respond to Host Updates

The host can change layout, theming, or locale at any point. Read the globals on `window.openai` and listen for `openai:set_globals` so you can resize, restyle, or re-render as conditions change.

Use the `window.openai` globals to respond to layout and theme changes:

- `window.openai.displayMode` tells you whether the component is inline, picture-in-picture, or fullscreen
- `window.openai.maxHeight` indicates how much vertical space you can use before scrollbars appear
- `window.openai.locale` returns the user's locale (BCP 47 tag) and matches the iframe's `lang` attribute
- Listen for the `openai:set_globals` window event if you need to react to theme or layout changes

### Subscribe to Tool Responses

Tool invocations can originate from the user, the assistant, or your own component. Subscribe to `openai:tool_response` when you want to refresh UI state whenever a background action completes. Remember to unsubscribe on unmount to avoid leaks.

```typescript
React.useEffect(() => {
  function onToolResponse(
    e: CustomEvent<{ tool: { name: string; args: Record<string, unknown> } }>
  ) {
    if (e.detail.tool.name === "refresh_pizza_list") {
      // Optionally update local UI after background tool calls
      // e.detail.tool.args.city contains the city that was refreshed
    }
  }
  window.addEventListener("openai:tool_response", onToolResponse as EventListener);
  return () => window.removeEventListener("openai:tool_response", onToolResponse as EventListener);
}, []);
```

### Use Host-Backed Navigation

Skybridge (the sandbox runtime) mirrors the iframe's history into ChatGPT's UI. Use standard routing APIs—such as React Router—and the host will keep navigation controls in sync with your component.

**Router setup (React Router's BrowserRouter):**

```typescript
export default function PizzaListRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PizzaListApp />}>
          <Route path="place/:placeId" element={<PizzaListApp />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

**Programmatic navigation:**

```typescript
const navigate = useNavigate();

function openDetails(placeId: string) {
  navigate(`place/${placeId}`, { replace: false });
}

function closeDetails() {
  navigate("..", { replace: true });
}
```

## Scaffold the Component Project

As best practice, keep the component code separate from your server logic. A common layout is:

```
app/
  server/            # MCP server (Python or Node)
  web/               # Component bundle source
    package.json
    tsconfig.json
    src/component.tsx
    dist/component.js   # Build output
```

Create the project and install dependencies (Node 18+ recommended):

```bash
cd app/web
npm init -y
npm install react@^18 react-dom@^18
npm install -D typescript esbuild
```

If your component requires drag-and-drop, charts, or other libraries, add them now. Keep the dependency set lean to reduce bundle size.

## Author the React Component

Your entry file should mount a component into a root element and read initial data from `window.openai.toolOutput` or persisted state.

### Example: Pizza List App

A "Pizza list" app (a list of pizza restaurants) does the following:

1. **Mount into the host shell** - The Skybridge HTML template exposes `div#pizzaz-list-root`. The component mounts with `createRoot(document.getElementById("pizzaz-list-root")).render(<PizzaListApp />)` so the entire UI stays encapsulated inside the iframe.

2. **Subscribe to host globals** - Inside `PizzaListApp`, hooks such as `useOpenAiGlobal("displayMode")` and `useOpenAiGlobal("maxHeight")` read layout preferences directly from `window.openai`. This keeps the list responsive between inline and fullscreen layouts without custom postMessage plumbing.

3. **Render from tool output** - The component treats `window.openai.toolOutput` as the authoritative source of places returned by your tool. `widgetState` seeds any user-specific state (like favorites or filters) so the UI restores after refreshes.

4. **Persist state and call host actions** - When a user toggles a favorite, the component updates React state and immediately calls `window.openai.setWidgetState` with the new favorites array. Optional buttons can trigger `window.openai.requestDisplayMode({ mode: "fullscreen" })` or `window.openai.callTool("refresh_pizza_list", { city })` when more space or fresh data is needed.

## Explore the Pizzaz Component Gallery

The Apps SDK provides example components as blueprints:

- **Pizzaz List** – ranked card list with favorites and call-to-action buttons
- **Pizzaz Carousel** – embla-powered horizontal scroller that demonstrates media-heavy layouts
- **Pizzaz Map** – Mapbox integration with fullscreen inspector and host state sync
- **Pizzaz Album** – stacked gallery view built for deep dives on a single place
- **Pizzaz Video** – scripted player with overlays and fullscreen controls

Each example shows how to bundle assets, wire host APIs, and structure state for real conversations.

## React Helper Hooks

Many Apps SDK projects wrap `window.openai` access in small hooks so views remain testable.

### useOpenAiGlobal Hook

This hook listens for host `openai:set_globals` events and lets React components subscribe to a single global value:

```typescript
export function useOpenAiGlobal<K extends keyof WebplusGlobals>(
  key: K
): WebplusGlobals[K] {
  return useSyncExternalStore(
    (onChange) => {
      const handleSetGlobal = (event: SetGlobalsEvent) => {
        const value = event.detail.globals[key];
        if (value === undefined) {
          return;
        }

        onChange();
      };

      window.addEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobal, {
        passive: true,
      });

      return () => {
        window.removeEventListener(SET_GLOBALS_EVENT_TYPE, handleSetGlobal);
      };
    },
    () => window.openai[key]
  );
}
```

### useWidgetState Hook

Keep host-persisted widget state aligned with your local React state:

```typescript
export function useWidgetState<T extends WidgetState>(
  defaultState: T | (() => T)
): readonly [T, (state: SetStateAction<T>) => void];
export function useWidgetState<T extends WidgetState>(
  defaultState?: T | (() => T | null) | null
): readonly [T | null, (state: SetStateAction<T | null>) => void];
export function useWidgetState<T extends WidgetState>(
  defaultState?: T | (() => T | null) | null
): readonly [T | null, (state: SetStateAction<T | null>) => void] {
  const widgetStateFromWindow = useWebplusGlobal("widgetState") as T;

  const [widgetState, _setWidgetState] = useState<T | null>(() => {
    if (widgetStateFromWindow != null) {
      return widgetStateFromWindow;
    }

    return typeof defaultState === "function"
      ? defaultState()
      : defaultState ?? null;
  });

  useEffect(() => {
    _setWidgetState(widgetStateFromWindow);
  }, [widgetStateFromWindow]);

  const setWidgetState = useCallback(
    (state: SetStateAction<T | null>) => {
      _setWidgetState((prevState) => {
        const newState = typeof state === "function" ? state(prevState) : state;

        if (newState != null) {
          window.openai.setWidgetState(newState);
        }

        return newState;
      });
    },
    [window.openai.setWidgetState]
  );

  return [widgetState, setWidgetState] as const;
}
```

The hooks above make it easy to read the latest tool output, layout globals, or widget state directly from React components while still delegating persistence back to ChatGPT.

## Bundle for the Iframe

Once you are done writing your React component, build it into a single JavaScript module that the server can inline:

```json
// package.json
{
  "scripts": {
    "build": "esbuild src/component.tsx --bundle --format=esm --outfile=dist/component.js"
  }
}
```

Run `npm run build` to produce `dist/component.js`. If esbuild complains about missing dependencies, confirm you ran `npm install` in the `web/` directory and that your imports match installed package names.

## Embed the Component in the Server Response

See the [Set up your server](./MCP_WIDGETS_SETUP.md) docs for how to embed the component in your MCP server response.

Component UI templates are the recommended path for production.

During development you can rebuild the component bundle whenever your React code changes and hot-reload the server.
