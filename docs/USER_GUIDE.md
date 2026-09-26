# Block CAD quick guide

## Start with an example

Open **Shapes → Example projects**, choose the nameplate, section demo, or eight-hole flange, and click **Load example**. Loading an example replaces the model; **Undo** restores your previous work. All example shapes remain editable.

## Build a model

1. Add shapes from the palette. Choose a camera face or drag to orbit in Perspective.
2. Click a shape to select it; Shift+click adds or removes shapes. Box select draws a selection rectangle.
3. Drag Move/Rotate/Scale handles or enter precise inspector values. Units are millimeters.
4. Use Join for a union, Intersect for shared volume, and Separate to recover combined source shapes.
5. Turn a shape into a Hole and select its target solid. Overlap it with the solid to cut it. Group a solid and its linked holes to hide cutter wireframes.
6. Use alignment, distribution, mirror, linear/radial arrays, and proportional resizing for repeated or precisely placed features.

## Find tools

Use the sidebar's **Shapes**, **Place**, **Objects**, **Combine**, **Arrange**, and **Inspect** buttons to jump to a tool group. Shapes, Place, Combine, and Arrange collapse with their headings. Objects and common selection actions stay visible; on desktop the canvas stays alongside the tools as you scroll.

## Position precisely

- **Place → Ruler / reference origin:** enter origin coordinates and choose **Set reference origin**, or choose **Origin at selection**. Select Minimum, Center, or Maximum of the finished selection bounds. The three offsets show its position relative to that origin. Edit the offsets and **Apply reference position** to translate the selection together. A colored axis marker shows the origin. Coordinates are in world X/Y/Z; readouts round to 0.001 mm.
- **Place → Workplane:** enter a horizontal height or choose **Pick face workplane**, then click a solid face. New primitives, lettering, imports, cutout examples, and inserted parts start at the picked point, oriented outward from the face. **Drop to workplane** moves existing bodies along the plane normal without rotating them. The grid shows the current plane. Escape cancels picking; **Reset to 0** restores the base plane.
- **Place → Drop onto body:** select the moving solids, position them over a separate target in X/Z, select that target in the dropdown, then **Drop onto body**. Each selected body moves in world Y to its first contact when lowered from above. Finished cutouts, pockets, joins, slopes, and imported triangles determine contact. A body already intersecting the target may move upward. Other bodies are not obstacles.

Placement carries every linked hole and is one Undo step. Hidden or locked selected bodies or linked holes must be shown/unlocked first. A locked target can support a drop. A missing overlapping footprint cancels the whole operation. Very detailed surface drops report a limit; a face workplane is the fallback.

Reference origins and workplanes are workspace aids: changing them does not move the model or add an Undo step, and they are not saved/exported. New, Load, and examples reset them. A face workplane stays fixed if its source is moved or deleted, and extends beyond the face. Curved meshes supply their picked triangle's plane. Picking skips cutters and clipped-away surfaces; an open section has no pickable cap. Snapping, gizmos, and inspector coordinates continue to use world axes.

## Reuse custom shapes

Open **Shapes → Custom shapes** and choose Tube, Rounded box, or L bracket. Set the dimensions, wall thickness, or corner radius, then **Add custom shape**. The shape starts on the current workplane. Select it and use **Edit custom shape → Apply custom parameters** to revise it in one Undo step while retaining its center, rotation, scale, color, and links. Parameter dimensions describe the unscaled source; inspector resizing applies scale afterward.

Tubes have a concentric opening. Rounded boxes round the four vertical corners, with flat tops and bottoms; this is not a general edge fillet tool. L brackets have a horizontal base and an upright leg with uniform wall thickness. Save a custom shape to **Parts library** for reuse; inserted copies retain editable parameters. Parameter dimensions accept 0.01–1,000 mm (corner radius can be zero). Wall thickness and radius must fit the shape.

## Drill hole patterns

Select a visible, unlocked solid or joined body. Open **Combine → Hole patterns**, choose Row, Grid, or Bolt circle, and set hole diameter, depth, counts, spacing, and offsets. **Add hole pattern** adds up to 200 linked cylinder cutters in one Undo step. Each cutter stays editable in the object list and is grouped with its target.

With a face workplane active, the pattern starts at its picked origin and cuts inward along its normal. Otherwise the pattern is centered above the target's finished bounds and cuts down from its highest Y. Spacing and offsets use the pattern plane's X/Z axes; the bolt-circle angle runs from +X toward +Z. Depth is measured inward from that plane. A 0.02 mm extension above the plane avoids a coincident entry surface. Holes outside the solid do not cut it; inspect the result. For through holes, choose sufficient depth to exit the body. Pattern settings generate individual editable cutters; there is no persistent pattern constraint.

## Align two faces

Select one moving solid assembly, then open **Place → Align faces → Pick alignment faces**. Click its moving face, then a face on a separate target body. Set **Face offset** and **Apply face alignment**. The picked points align, and the outward normals face each other. A positive offset leaves a gap along the target normal; negative offsets overlap. Every joined member and linked cutter moves and rotates together. The target stays fixed and may be locked. Undo restores the complete move.

Faces use the clicked mesh triangle planes, including facets on curved surfaces. Alignment uses the smallest normal rotation without an additional twist control and does not check other collisions. Hidden/locked moving dependencies are rejected. Model or selection changes clear the picked faces; Escape cancels picking.

## Measure two points

Open **Point-to-point measurement** near the existing Measurements panel and choose **Measure two points**. Click two visible finished-solid surfaces. Markers and a line show the picks; the readout reports straight-line distance and signed world X/Y/Z differences (second minus first), rounded to 0.001 mm. Camera views can help you pick precisely. There is no vertex snapping or automatic nearest-surface measurement. Measurements do not change the model or Undo history, clear after model edits, and are not saved/exported. Escape cancels picking; **Clear point measurement** removes the result.

Surface picking skips cutter wireframes, pending Boolean source previews, hidden shapes, and clipped-away surfaces. Workplane, alignment, measurement, and box-selection modes are mutually exclusive.

## Make lettering

Open **Text shape**, enter wording, font size and extrusion, then **Add text**. The lettering lies flat on the current workplane and is one object. To engrave, select Hole and its target, then lower the lettering into the surface. To emboss, overlap a small part of its depth with the base and Join. **Edit text → Apply text** updates the wording while retaining placement and links. Changing wording can change its footprint; recheck placement afterward. Choose Helvetiker Regular, Helvetiker Bold, or Optimer Regular in the Font selector. Font changes preserve placement and links but can change the footprint. Fonts are bundled for offline use; unsupported characters are reported. Existing lettering from older projects uses Helvetiker Regular when edited.

## Inspect interiors

Enable **Section view** and choose an axis and plane position. Flip side changes the visible half. It is an uncapped visual cutaway: measurements and exports still use the entire model. Disable it to see the whole model again. The section-demo example has an enclosed cavity visible around Y=15 mm.

## Split a solid

Select a solid or joined assembly and open **Section view**. Enable the section, choose X/Y/Z, and enter a position through the model. **Split selected at section** replaces each selected finished body with two closed mesh solids, keeping their world positions and display color. The section preview turns off so both halves are visible. Select a half and move it to inspect the capped surface.

Split bakes the joins, holes, text, and primitive parameters into mesh geometry. The resulting pieces can be transformed, cut, joined, saved, and exported. **Undo** restores the original editable sources and selection in one step. All selected bodies must have material on both sides of the plane, and their linked shapes must be visible/unlocked; otherwise the whole action is rejected. Flip side only affects the preview, not which halves are kept.

## Background previews

Boolean previews calculate in a background worker. Unchanged bodies retain their meshes, while changed bodies show source geometry until the latest preview arrives. Progress appears under Shapes. Edits made during a calculation supersede its result; New/empty models cancel pending preview work. If a worker fails or a calculation exceeds 30 seconds, use **Retry previews** in the error message. Measurements, placement, splitting, imports, and exports still calculate on the main thread and can pause editing for complex models.

## Save your work

- **Save / Load** downloads or opens portable project JSON, including editable geometry and colors.
- Autosave keeps the current draft for this browser and exact site address.
- **Parts library** saves selected solid assemblies for reuse. Inserted copies get independent IDs and start at the current workplane origin.
- **Project snapshots** stores named checkpoints of the full project. Restore is undoable.

Open **Library backup / transfer → Export library backup** to download all saved parts and snapshots in one file. Import it on another browser/site with **Import library backup**. Import validates the whole file, then adds every entry in one transaction using fresh storage IDs. Existing entries and the open model stay unchanged; repeated imports create duplicates. Names, dates, fonts, colors, assemblies, and empty snapshots are preserved. Limits are 50 MB, 250 saved items, and 10,000 source shapes per file. Failed imports add nothing. Library import is separate from model Undo.

Local parts, snapshots, and autosave do not synchronize automatically across browsers or addresses. Clearing browser storage removes them. Keep downloaded project files as backups.

## Export for printing

Choose **All bodies** or **Selection**, then Export STL or Export 3MF. Review dimensions, empty bodies, and disconnected regions before downloading. A selected joined member exports the entire joined assembly and its cuts. Hidden shapes are included. Model colors are not currently exported. These checks do not measure wall thickness, overhangs, or printer fit.

Press **?** for the keyboard and mouse guide. Undo/Redo covers model edits; camera, filters, clipping, and library management are separate preferences/actions.
