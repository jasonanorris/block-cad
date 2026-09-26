# Block CAD quick guide

## Start with an example

Open **Create → Example projects**, choose the nameplate, section demo, or eight-hole flange, and click **Load example**. Loading an example replaces the model; **Undo** restores your previous work. All example shapes remain editable.

## Build a model

1. Add shapes from the palette. Choose a camera face or drag to orbit in Perspective.
2. Click a shape to select it; Shift+click adds or removes shapes. Box select draws a selection rectangle.
3. Drag Move/Rotate/Scale handles or enter precise inspector values. Units are millimeters.
4. Use Join for a union, Intersect for shared volume, and Separate to recover combined source shapes.
5. Turn a shape into a Hole and select its target solid. Overlap it with the solid to cut it. Group a solid and its linked holes to hide cutter wireframes.
6. Use alignment, distribution, mirror, linear/radial arrays, and proportional resizing for repeated or precisely placed features.

## Find tools

The right sidebar shows one tool tab at a time:

| Tab | Tools |
| --- | --- |
| Create | Basic shapes, text, custom shapes, imports, examples |
| Edit | Selected shape properties, duplicate/delete, copy/paste, fillet/chamfer edges, Combine, hole patterns |
| Objects | Object list, search, selection, hide/show, lock/unlock |
| Place | Reference origin, workplanes, face alignment, dropping, Arrange (mirror, resize, arrays, align, distribute) |
| Inspect | Section view/splitting, measurements, shortcut help |
| Library | Parts, snapshots, library backups |

The selection summary and **Edit selection** shortcut stay above the tabs. Switching tabs preserves unfinished inputs, expanded groups, selection, and each tab's scroll position. It does not add an Undo step. On desktop the active panel scrolls beneath the tabs; narrow screens keep the sidebar below the canvas. Focus the tabs and use Left/Right arrows or Home/End to switch with the keyboard.

The object list shows up to 50 rows per page. Use **Previous objects**, **Next objects**, search, and filters to find shapes. **Show selected page** jumps to a selected row that is visible under the current filters and expanded assemblies.

## Position precisely

- **Place → Ruler / reference origin:** enter origin coordinates and choose **Set reference origin**, or choose **Origin at selection**. Select Minimum, Center, or Maximum of the finished selection bounds. The three offsets show its position relative to that origin. Edit the offsets and **Apply reference position** to translate the selection together. A colored axis marker shows the origin. Coordinates are in world X/Y/Z; readouts round to 0.001 mm.
- **Place → Workplane:** enter a horizontal height or choose **Pick face workplane**, then click a solid face. New primitives, lettering, imports, cutout examples, and inserted parts start at the picked point, oriented outward from the face. **Drop to workplane** moves existing bodies along the plane normal without rotating them. The grid shows the current plane. Escape cancels picking; **Reset to 0** restores the base plane.
- **Place → Drop onto body:** select the moving solids, position them over a separate target in X/Z, select that target in the dropdown, then **Drop onto body**. Each selected body moves in world Y to its first contact when lowered from above. Finished cutouts, pockets, joins, slopes, and imported triangles determine contact. A body already intersecting the target may move upward. Other bodies are not obstacles.

Placement carries every linked hole and is one Undo step. Hidden or locked selected bodies or linked holes must be shown/unlocked first. A locked target can support a drop. A missing overlapping footprint cancels the whole operation. Very detailed surface drops report a limit; a face workplane is the fallback.

Reference origins and workplanes are workspace aids: changing them does not move the model or add an Undo step, and they are not saved/exported. New, Load, and examples reset them. A face workplane stays fixed if its source is moved or deleted, and extends beyond the face. Curved meshes supply their picked triangle's plane. Picking skips cutters and clipped-away surfaces; an open section has no pickable cap. Snapping, gizmos, and inspector coordinates continue to use world axes.

## Reuse custom shapes

Open **Create → Custom shapes** and choose Tube, Rounded box, or L bracket. Set the dimensions, wall thickness, or corner radius, then **Add custom shape**. The shape starts on the current workplane. Select it and use **Edit custom shape → Apply custom parameters** to revise it in one Undo step while retaining its center, rotation, scale, color, and links. Parameter dimensions describe the unscaled source; inspector resizing applies scale afterward.

Tubes have a concentric opening. For Rounded box, choose **Round → Sides only (2D)** for rounded vertical corners with flat tops/bottoms, or **All edges (3D)** to round all twelve edges and eight corners. All-edge radius must be at most half the smallest width, depth, or height; sides-only radius is limited by width/depth. Radius 0 makes a plain box. Outside dimensions stay as entered. Existing boxes can switch modes in **Edit → Edit custom shape**; Undo restores the previous mode. This is not a general edge fillet tool. L brackets have a horizontal base and an upright leg with uniform wall thickness. Save a custom shape to **Parts library** for reuse; inserted copies retain editable parameters. Parameter dimensions accept 0.01–1,000 mm (corner radius can be zero). Wall thickness and radius must fit the shape.

## Fillet or chamfer edges

Select one solid body and open **Edit → Fillet / chamfer edges → Select edges**. Eligible edges appear blue; hover highlights an edge orange. Click to toggle each edge green or blue; use **Clear edges** to start over. Choose Fillet or Chamfer, enter one size for the selection, and click **Preview edges**. Fillet size is the radius; chamfer size is the distance along each adjoining face. **Apply edges** commits the whole feature in one Undo step. **Cancel edge** or Escape restores the original. Changing size clears the previous preview; changing the model or selection cancels the tool. Camera view buttons let you inspect other sides.

Use separate straight outside edges with **15°–165° interior angles** on convex solids with flat, square ends. Examples include a box's vertical edges, a wedge's longitudinal edges, and a polygon prism's vertical edges. The selected-edge readout shows each interior angle and the maximum size for the chosen operation. Curved edges, inside corners, angled terminations, shared corners, and overlapping cuts are rejected. A chamfer measures equal distances along the two faces. A fillet uses a circular arc tangent to both faces; acute corners need more room for the same radius, so their radius limit is smaller. The tool reports a conservative size limit and supports inputs up to 5,000 triangles. Calculations run in a cancellable worker.

The **edge feature history** lists each applied operation, size, and edge count. **Edit** changes its size or switches Fillet/Chamfer; Preview rebuilds the history, then Apply commits it. **Remove → Preview removal → Apply removal** removes that feature and rebuilds later features. If a later feature becomes invalid, the entire change is rejected; remove dependent features first. Each edit/removal is undoable. Up to 32 features and 24 edges per feature are supported.

Feature history survives Save/Load, copies, arrays, and library reuse. The first application stores the finished body as a starting mesh; initial primitive parameters, joins, and cuts are baked into that mesh. Removing every feature restores the starting mesh; Undo of the initial application restores the original source objects. Subsequent moves, rotations, and scales preserve the history. Feature angles and sizes refer to the unscaled starting mesh, so nonuniform scaling also scales the rounding. Separate later joins and remove later linked cuts before editing or adding features on that body. Splitting produces baked pieces without this history.

Save/export use the committed model until Apply. STL/3MF export contains only the resulting geometry; project files preserve feature history. Edges applied before this update are already baked and cannot acquire editable history retroactively.

## Drill hole patterns

Select a visible, unlocked solid or joined body. Open **Edit → Combine → Hole patterns**, choose Row, Grid, or Bolt circle, and set hole diameter, depth, counts, spacing, and offsets. **Add hole pattern** adds up to 200 linked cylinder cutters in one Undo step. Each cutter stays editable in the object list and is grouped with its target.

With a face workplane active, the pattern starts at its picked origin and cuts inward along its normal. Otherwise the pattern is centered above the target's finished bounds and cuts down from its highest Y. Spacing and offsets use the pattern plane's X/Z axes; the bolt-circle angle runs from +X toward +Z. Depth is measured inward from that plane. A 0.02 mm extension above the plane avoids a coincident entry surface. Holes outside the solid do not cut it; inspect the result. For through holes, choose sufficient depth to exit the body. Pattern settings generate individual editable cutters; there is no persistent pattern constraint.

## Align two faces

Select one moving solid assembly, then open **Place → Align faces → Pick alignment faces**. Click its moving face, then a face on a separate target body. Set **Face offset** and **Apply face alignment**. The picked points align, and the outward normals face each other. A positive offset leaves a gap along the target normal; negative offsets overlap. Every joined member and linked cutter moves and rotates together. The target stays fixed and may be locked. Undo restores the complete move.

Faces use the clicked mesh triangle planes, including facets on curved surfaces. Alignment uses the smallest normal rotation without an additional twist control and does not check other collisions. Hidden/locked moving dependencies are rejected. Model or selection changes clear the picked faces; Escape cancels picking.

## Measure two points

Open **Inspect → Point-to-point measurement** and choose **Measure two points**. Click two visible finished-solid surfaces. Markers and a line show the picks; the readout reports straight-line distance and signed world X/Y/Z differences (second minus first), rounded to 0.001 mm. Camera views can help you pick precisely. There is no vertex snapping or automatic nearest-surface measurement. Measurements do not change the model or Undo history, clear after model edits, and are not saved/exported. Escape cancels picking; **Clear point measurement** removes the result.

Surface picking skips cutter wireframes, pending Boolean source previews, hidden shapes, and clipped-away surfaces. Workplane, alignment, measurement, and box-selection modes are mutually exclusive.

## Make lettering

Open **Text shape**, enter wording, font size and extrusion, then **Add text**. The lettering lies flat on the current workplane and is one object. To engrave, select Hole and its target, then lower the lettering into the surface. To emboss, overlap a small part of its depth with the base and Join. **Edit text → Apply text** updates the wording while retaining placement and links. Changing wording can change its footprint; recheck placement afterward. Choose Helvetiker Regular, Helvetiker Bold, or Optimer Regular in the Font selector. Font changes preserve placement and links but can change the footprint. Fonts are bundled for offline use; unsupported characters are reported. Existing lettering from older projects uses Helvetiker Regular when edited.

## Inspect interiors

Open **Inspect → Section view** and choose an axis and plane position. Flip side changes the visible half. It is an uncapped visual cutaway: measurements and exports still use the entire model. Disable it to see the whole model again. The section-demo example has an enclosed cavity visible around Y=15 mm.

## Split a solid

Select a solid or joined assembly and open **Inspect → Section view**. Enable the section, choose X/Y/Z, and enter a position through the model. **Split selected at section** replaces each selected finished body with two closed mesh solids, keeping their world positions and display color. The section preview turns off so both halves are visible. Select a half and move it to inspect the capped surface.

Split bakes the joins, holes, text, and primitive parameters into mesh geometry. The resulting pieces can be transformed, cut, joined, saved, and exported. **Undo** restores the original editable sources and selection in one step. All selected bodies must have material on both sides of the plane, and their linked shapes must be visible/unlocked; otherwise the whole action is rejected. Flip side only affects the preview, not which halves are kept.

## Background calculations

Boolean previews calculate in a background worker. Unchanged bodies retain their meshes, while changed bodies show source geometry until the latest preview arrives. Progress appears in Create. Edits made during a calculation supersede its result; New/empty models cancel pending preview work. If a worker fails or a calculation exceeds 30 seconds, use **Retry previews** in the error message. Measurements, reference bounds, splitting, export checks, and exports use separate background workers with a 60-second limit. Use the pending operation’s Cancel button to stop it; cancellation leaves the model intact and prevents a download. Retry measurements/checks after cancellation or failure. Changing the model invalidates old results. Placement and import validation still calculate on the main thread and can pause editing for complex models.

## Save your work

- **Save / Load** downloads or opens portable project JSON, including editable geometry and colors.
- Autosave keeps the current draft for this browser and exact site address.
- **Parts library** saves selected solid assemblies for reuse. Inserted copies get independent IDs and start at the current workplane origin.
- **Project snapshots** stores named checkpoints of the full project. Restore is undoable.

Open **Library backup / transfer → Export library backup** to download all saved parts and snapshots in one file. Import it on another browser/site with **Import library backup**. Import validates the whole file, then adds every entry in one transaction using fresh storage IDs. Existing entries and the open model stay unchanged; repeated imports create duplicates. Names, dates, fonts, colors, assemblies, and empty snapshots are preserved. Limits are 50 MB, 250 saved items, and 10,000 source shapes per file. Failed imports add nothing. Library import is separate from model Undo.

Project format 20 stores editable edge histories and their starting meshes; format 19 records the rounding mode and retains the shared mesh table introduced in format 18, storing repeated STL meshes once while preserving each copy’s transform and properties. Older project files still load.

Local parts, snapshots, and autosave do not synchronize automatically across browsers or addresses. Clearing browser storage removes them. Keep downloaded project files as backups.

## Export for printing

Choose **All bodies** or **Selection**, then Export STL or Export 3MF. Review dimensions, empty bodies, and disconnected regions before downloading. A selected joined member exports the entire joined assembly and its cuts. Hidden shapes are included. Model colors are not currently exported. Open **Print volume and feature checks** to set printer dimensions and a small-feature threshold, then **Apply print settings**. The volume is centered on world X/Z and extends upward from Y=0; moving a body outside that volume produces a warning. Defaults are X=220, Y=250, Z=220 mm and a 0.8 mm feature threshold. Settings reset for each new export review.

Small-feature warnings inspect source dimensions, custom walls, and narrow connected-region bounds. They do not measure wall thickness after cuts, bridges, overhangs, or minimum clearance. A threshold of 0 disables these warnings. Disconnected-region, volume, and feature warnings allow export; geometry errors block downloading. Use **Cancel checks** or **Cancel export** to stop pending work.

Press **?** for the keyboard and mouse guide. Undo/Redo covers model edits; camera, filters, clipping, and library management are separate preferences/actions.
