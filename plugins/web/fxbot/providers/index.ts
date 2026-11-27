import { brave } from "./brave.ts";
import { exa } from "./exa.ts";
import { firecrawl } from "./firecrawl.ts";
import { jina } from "./jina.ts";
import { keiro } from "./keiro.ts";
import { linkup } from "./linkup.ts";
import { parallel } from "./parallel.ts";
import { perplexity } from "./perplexity.ts";
import { searxng } from "./searxng.ts";
import { tavily } from "./tavily.ts";
import type { Adapter } from "./common.ts";

export * from "./common.ts";
export { freeSearch } from "./parallel.ts";

/** The adapters, in the order a job picks one when the owner hasn't: the first added that can do it. */
export const adapters: Adapter[] = [keiro, firecrawl, tavily, exa, brave, perplexity, parallel, jina, linkup, searxng];
export const adapterFor = (kind: string) => adapters.find((a) => a.kinds.includes(kind));
