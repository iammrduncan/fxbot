import { createClient } from "@fxbot/sdk/client";

// The page's own origin. The page holds no secrets: the model key stays on the server.
export const client = createClient();
