# Advanced fillets

The staged OpenCascade integration was approved and implemented. Advanced CAD is available under **Edit → Fillet / chamfer edges → Edge tools → Advanced CAD**. Mesh tools retain their previous behavior.

## Implemented capabilities

- Fillets meeting at nonperpendicular corners, tested on a hexagonal prism.
- A later edge fillet ending in an existing rounded surface.
- Inside-edge fillets on rectangular pockets and circular blind holes.
- Different radii on meeting edges through **Selected edges and individual sizes**. Blank fields use the common size; overrides remain editable after Save/Load.
- Analytic chamfers, feature history editing/removal, Preview/Apply/Cancel, Undo/Redo, transformed bodies, joined/cut source bodies, library reuse, and STL/3MF exports.

## Architecture

`occtRuntime.ts` loads pinned `opencascade.js@2.0.0-beta.b5ff984` on demand inside the geometry worker. The bundled WASM identifies OCCT 7.6. `analyticKernel.ts` manages scoped WASM objects, primitive construction, Boolean operations, edge sampling, fillets/chamfers, BREP serialization, and tessellation. `analyticFeatures.ts` integrates selection and feature replay. `analyticData.ts` validates persistent analytic histories.

Analytic starting bodies are constructed from native boxes, wedges, prisms, cylinders, cones, spheres, tubes, rounded boxes, and L-brackets, including supported joins/intersections/linked cuts. Format 22 saves per-feature curve quality and retains an OCCT BREP starting body and ordered feature descriptions alongside the cached display mesh. Existing formats 1–21 still load; omitted quality defaults to Fine. Each geometric edge reference contains five sampled model-local curve points; it is independent of mesh triangle indices and normalizes reversed traversal. Replay requires a unique geometric match. Missing or ambiguous matches reject the whole edit; changing an earlier radius can require removing a dependent later feature.

Curved edges use sampled polylines for rendering and picking. The analytic curve remains in the kernel. Only Preview changes the displayed geometry; Apply commits once. Cancellation terminates the worker, and stale replies cannot replace a newer model. Production workers use ES modules to support dynamic loading. Analytic results are checked for valid topology and the presence of a solid before tessellation. Curve quality selects absolute linear/angular deflection: Standard uses 0.02 mm / 0.15 radians, Fine uses 0.005 mm / 0.075 radians, and Extra fine uses 0.00125 mm / 0.0375 radians. The finest setting requested in the body’s feature history controls the final tessellation. Fine is the default. Finer settings increase mesh detail without changing the analytic radii. A representative 30 mm hexagonal prism with three meeting 2 mm fillets grew from 529 to 1,639 triangles; preview generation after kernel initialization measured 88 ms versus 109 ms in one local comparison. These are illustrative measurements, not performance guarantees. Larger meshes increase storage and processing costs; the existing triangle limit remains in force.

Existing mesh histories remain on the mesh implementation. Applying a new advanced feature to a joined/cut analytic assembly bakes that assembly into a new analytic starting body; Undo restores the sources. Separate later joins/cuts to edit a source's earlier history. Split results and STL/3MF exports are baked meshes. Copies and library parts preserve the analytic history. Later moves/rotations/scales preserve history; edge sizes are measured in the stored body's coordinates before those later transforms.

## Resource measurements

Local measurements, not performance guarantees:

- Full WASM: 50,305,130 bytes; gzip: 13,955,447 bytes.
- Node initialization: approximately 3 seconds; initial WASM heap: 100 MiB. After 20 warmup operations, 100 repeated fillet/tessellation operations took about 1.1 seconds with the heap still at 100 MiB (this checks heap growth, not a proof of zero leaks).
- Production Firefox worker: prism, rounded termination, pocket, and circular blind-hole builds plus 3MF exports completed together in about 3.1 seconds on this workstation.
- The main page does not initialize or fetch this kernel until an advanced geometry request. Production browser checks load the separate worker and WASM successfully.
- Existing 60-second geometry timeout, 32-feature/24-edge limits, and 100,000-triangle result limit remain. Analytic starting BREP data is limited to 10 MB per body.

A smaller custom WASM build is a future optimization. This version uses the pinned prebuilt artifact for reproducibility. License text and upstream source links are included in `public/licenses/`.

## Verification

`tests/analyticFeatures.test.mjs` covers all four requested geometry cases, analytic cylinder radii for unequal-radius corners, expected volume for an outside fillet, expected material addition for pocket/hole fillets, impossible-radius rejection, format validation, transformed edits, joined sources, library reuse, removal, and watertight STL/3MF generation. The existing mesh regression suite remains enabled.

Production Firefox checks cover physical edge selection, per-edge radius fields, preview isolation, Apply, Undo/Redo, Save/Load, editing/removal, worker/WASM loading, and exports. A second worker check builds prism corners, a rounded termination, a pocket, and a circular blind hole through the production pipeline.

## Limits

This is a first analytic-body integration. Unsupported source types (including arbitrary imported STL, old baked meshes, and text/SVG) do not automatically gain analytic surfaces. Recreate an applicable body using the supported native sources to use Advanced CAD. Legacy mesh tools remain available for their supported cases.

Not every combination of corner topology and radii can be built. Preview reports failures and preserves the committed model. Per-edge radius overrides are supported; a radius varying along one individual edge is outside this implementation. Dense edge sets and repeated operations can reach existing resource limits. The app remains local; publishing is deferred.

## Upstream references

- [OpenCascade.js prebuilt modules](https://ocjs.org/docs/app-dev-workflow/pre-built)
- [OpenCascade.js custom builds](https://ocjs.org/docs/app-dev-workflow/custom-builds)
- [OCCT fillet API reference](https://occt3d.com/dev/doc/refman/html/class_b_rep_fillet_a_p_i___make_fillet.html) — current upstream reference; binding use is checked against the pinned package's declarations and executable tests rather than assumed to match the latest C++ release.

## Edge selection and failure feedback

Selected rows label straight/curved geometry and inside/outside/transition material boundaries. Boundary labels sample the solid around the curve midpoint at two distances and fall back to transition when ambiguous; they are hints, not eligibility guarantees. Outside edges are blue, inside edges purple, transitions gray, and selected edges green. Hovering or focusing a size field highlights its edge orange. Reopening a feature replays the preceding history to locate its input edges in stored order.

Failed fillet contours are mapped to selected edge references and entered sizes. These references survive the worker boundary, mark the corresponding fields invalid, and color the edges red. When the kernel supplies no contour diagnosis, feedback explicitly describes a failed combination without blaming a particular edge. Changing settings clears stale failure highlights; Cancel and model/selection changes clear all temporary references. No project format change is needed.

## Expanded native sources

Cones point along +Y, spheres remain centered, and custom sources use their validated parameters. Tubes use concentric analytic cylinders; L-brackets extrude the original L profile. Rounded boxes preserve sides-only and all-edge modes. They are assembled from exact boxes, cylinders, and spheres, including maximum-radius cases where the rectangular core loses one or more dimensions. Radius zero produces a box. This avoids requiring a fillet builder to solve a degenerate maximum-radius box.

Surface seams on cones, spheres, and cylinders are excluded from new selections. A smooth sphere alone reports that it has no sharp edges; joins and cuts can create selectable intersections. Existing saved edge references still replay through the original edge enumeration. Source parameters are baked into the analytic starting body on first Apply, consistent with the existing advanced workflow; Undo restores the editable sources.
