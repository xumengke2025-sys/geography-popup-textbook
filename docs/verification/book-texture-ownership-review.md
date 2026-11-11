# Book texture ownership review

Date: 2026-11-05. Scope: read-only source review of the active textbook renderer. No production code changed.

## Conclusion

The increasing texture count when first visiting previously unseen pages is consistent with a bounded whole-book page cache, not an indefinitely growing Popout leak. Repeated opening and closing on the same page remains stable. The existing runtime report `fullbook-resource-final.json` passes 11 checks, including two complete traversals of 60 models without a further increase in final texture count; it reports no browser errors or failures. This review inspected that report but did not rerun the browser experiment.

Routing decision: focused AUDIT, read-only. Gate recommendation: No Refactor / Reject Optimization for this delivery. A small fallback ownership fix can be considered separately if the engine is reused with multiple books in a persistent renderer.

## Ownership evidence

| Resource | Creation and ownership | Retention / release |
| --- | --- | --- |
| Per-page low-resolution map | `src/reference/engine.js:1723` creates a canvas and CanvasTexture; `:1732` constructs one for every left/right page. | Retained for the lifetime of the book; disposed at `:1783`. |
| High-resolution map | `:1756` builds queued focused pages. | `:1741` keeps the focus spread and immediate neighbors; `:1750` disposes distant high-resolution maps and switches material.map back to lo. Stable hiRes=6 is expected away from book boundaries. |
| Page uInk / uPrint white fallbacks | `:1308` creates a fresh 1x1 white DataTexture; `:1345` and `:1347` call it for every page material. | Three.js Material.dispose does not itself dispose uniform textures. The page-cache dispose at `:1783` does not explicitly dispose these original fallbacks. |
| Page uSpill black fallback | `:1312` creates a fresh 1x1 black DataTexture; `:1350` calls it per page. | Same ownership gap as the white fallbacks. |
| Shared paper normal | Passed directly into page material at `:1340`. | Not cloned by each page material. Do not mistake it for a per-page texture. |
| Active illustration | `src/textbook-book.ts:92` creates Popout; `:93` creates illustration. | `:112` disposes illustration resources; `:114`–`:118` dispose geometries, materials, print render targets, flip resources, and shadow depth material. Runtime repeated-close samples return to 12 geometries and zero active models. |

The page fragment shader samples all three custom texture uniforms at `src/reference/engine.js:1383`–`:1385`, even when their rectangles or alpha suppress visible output. New page materials can therefore upload these previously constructed textures when first rendered. GPU upload is lazy, so initialization object counts and renderer.info.memory.textures do not need to match initially.

## Current path versus original engine paths

`index.html:16` loads `src/textbook-main.ts`, which imports TextbookBook. The active `src/textbook-book.ts` never replaces page uInk / uPrint / uSpill with an external texture; `:95` explicitly uses the original textbook page as the printed image. The page fallbacks remain owned by the page materials in this path.

The general-purpose original lesson helper is different: `src/reference/engine.js:6652`–`:6655` assigns separately created CanvasTextures to page uInk, and `:6682` assigns `Popout.renderPrint()` to page uPrint. That renderPrint result is the texture owned by the Popout render target (`:6328`, `:6408`). Legacy `src/scene.ts:79` also binds a Popout print texture to the page, but the current HTML entry does not use that scene module.

Consequently, a generic engine cleanup must retain explicit references to its original fallback textures or otherwise track ownership. Disposing whatever texture happens to be stored in a page uniform can dispose a render target texture owned elsewhere. Replacing the current uniform also does not automatically release the previous fallback.

## Capacity and size estimates

The current catalog contains 67 spreads (`src/textbook-catalog.ts:7`), and TextbookBook requests hiPx=8 and loPx=.65 (`src/textbook-book.ts:26`). This gives 134 page objects, 134 lo maps, and 402 independent 1x1 fallbacks before adding the moving hi-resolution window and fixed scene resources. This is a capacity bound, not a claim that every page resource has already uploaded.

For 190x250 mm pages and RGBA8 storage, approximate pixel storage is:

- All lo maps: 124x163 pixels x 134 pages, about 10.3 MiB before mipmaps, about 13.8 MiB with a full mip chain.
- All 402 fallbacks: 1,608 bytes of pixel payload before driver/object overhead. They inflate texture counts much more than pixel storage.
- Six hi maps: 1520x2000 pixels each, about 69.6 MiB before mipmaps, about 92.8 MiB including mipmaps.

These are arithmetic estimates, not measured VRAM. Render targets, decoded source images, driver overhead, alignment, fixed stage assets, and transient overlapping focus during page turns are outside these estimates.

## Do not touch yet / future options

1. Do not rewrite Popout or reduce the visual behavior solely because texture counts rise during first visits. Both code ownership and the two-traversal report support bounded page retention.
2. Shared white/black fallback textures could reduce resource object counts, but require a clear book/renderer lifetime owner and safe reuse/disposal. They are not the first target for meaningful pixel-memory savings.
3. A smaller high-resolution pixel density or focus window affects more memory, but can reduce Chinese readability. Change only against actual device profiling and visual comparison.
4. GPU eviction of distant lo maps would be a separate cache-design change, not a minimal disposal patch. The existing whole-book lo cache has a known finite bound.

## Verification gaps and residual risk

This source review does not prove final book.dispose behavior under reuse of the same renderer, physically measure GPU memory, or validate every page of the 134-page cache. The existing runtime test covers all 60 interactive models twice and stable same-page reopen cycles. The missing explicit disposal of original page fallbacks remains a lifecycle gap for a persistent renderer that creates and destroys multiple books; it is separate from model-open/close stability in the delivered single-book application.
