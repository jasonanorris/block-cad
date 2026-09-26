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

## Make lettering

Open **Text shape**, enter wording, font size and extrusion, then **Add text**. The lettering lies flat on the current workplane and is one object. To engrave, select Hole and its target, then lower the lettering into the surface. To emboss, overlap a small part of its depth with the base and Join. **Edit text → Apply text** updates the wording while retaining placement and links. Changing wording can change its footprint; recheck placement afterward. The bundled Helvetiker font supports a limited character set and reports unsupported characters.

## Inspect interiors

Enable **Section view** and choose an axis and plane position. Flip side changes the visible half. It is an uncapped visual cutaway: measurements and exports still use the entire model. Disable it to see the whole model again. The section-demo example has an enclosed cavity visible around Y=15 mm.

## Save your work

- **Save / Load** downloads or opens portable project JSON, including editable geometry and colors.
- Autosave keeps the current draft for this browser and exact site address.
- **Parts library** saves selected solid assemblies for reuse. Inserted copies get independent IDs and start at the current workplane origin.
- **Project snapshots** stores named checkpoints of the full project. Restore is undoable.

Local parts, snapshots, and autosave do not synchronize across browsers or addresses. Clearing browser storage removes them. Keep downloaded project files as backups.

## Export for printing

Choose **All bodies** or **Selection**, then Export STL or Export 3MF. Review dimensions, empty bodies, and disconnected regions before downloading. A selected joined member exports the entire joined assembly and its cuts. Hidden shapes are included. Model colors are not currently exported. These checks do not measure wall thickness, overhangs, or printer fit.

Press **?** for the keyboard and mouse guide. Undo/Redo covers model edits; camera, filters, clipping, and library management are separate preferences/actions.
