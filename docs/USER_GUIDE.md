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

## Make lettering

Open **Text shape**, enter wording, font size and extrusion, then **Add text**. The lettering lies flat on X/Z and is one object. To engrave, select Hole and its target, then lower the lettering into the surface. To emboss, overlap a small part of its depth with the base and Join. **Edit text → Apply text** updates the wording while retaining placement and links. Changing wording can change its footprint; recheck placement afterward. The bundled Helvetiker font supports a limited character set and reports unsupported characters.

## Inspect interiors

Enable **Section view** and choose an axis and plane position. Flip side changes the visible half. It is an uncapped visual cutaway: measurements and exports still use the entire model. Disable it to see the whole model again. The section-demo example has an enclosed cavity visible around Y=15 mm.

## Save your work

- **Save / Load** downloads or opens portable project JSON, including editable geometry and colors.
- Autosave keeps the current draft for this browser and exact site address.
- **Parts library** saves selected solid assemblies for reuse. Inserted copies get independent IDs and start at the current workplane center.
- **Project snapshots** stores named checkpoints of the full project. Restore is undoable.

Local parts, snapshots, and autosave do not synchronize across browsers or addresses. Clearing browser storage removes them. Keep downloaded project files as backups.

## Export for printing

Choose **All bodies** or **Selection**, then Export STL or Export 3MF. Review dimensions, empty bodies, and disconnected regions before downloading. A selected joined member exports the entire joined assembly and its cuts. Hidden shapes are included. Model colors are not currently exported. These checks do not measure wall thickness, overhangs, or printer fit.

Press **?** for the keyboard and mouse guide. Undo/Redo covers model edits; camera, filters, clipping, and library management are separate preferences/actions.
