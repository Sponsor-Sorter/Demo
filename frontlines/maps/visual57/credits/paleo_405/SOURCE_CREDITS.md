# Devonian - 405 Ma - source credits

Coastline and continental motion: Merdith et al. (2021), reconstructed with the GPlates Web Service at exactly 405 Ma. Dataset: https://doi.org/10.5281/zenodo.10346399 . The dataset record identifies the licence as Creative Commons Attribution 4.0 International (https://creativecommons.org/licenses/by/4.0/). Metadata receipts are retained in the authoring folder.

Muller, R. D. et al. (2019), A Global Plate Model Including Lithospheric Deformation Along Major Rifts and Orogens Since the Triassic. Tectonics. https://doi.org/10.1029/2018TC005462

Merdith, A. S. et al. (2021), Extending full-plate tectonic models into deep time: Linking the Neoproterozoic and the Phanerozoic. Earth-Science Reviews 214, 103477. https://doi.org/10.1016/j.earscirev.2020.103477

API geometry and reconstructed points: https://gws.gplates.org/ . Exact request URLs, source SHA256s, age and model appear in source/provenance.json and the manifests. The received geometry is archived, rather than relying on the service to remain unchanged. GPlates software is GPL v2; its software licence is distinct from these dataset licences.

Changes: projection to Natural Earth I; rasterisation; illustrative game territories/bonuses and sea routes; inferred artistic relief, vegetation, rivers and surface materials. These are reconstructed, stylised game boards, not measured surveys of ancient terrain. Fine landscape features are artistic inference. Broad reference methodology: Scotese & Wright (2018) PaleoDEMs, https://doi.org/10.5281/zenodo.5460860 ; that raster model's different reference frame was not silently mixed into the GPlates coastline.

User-supplied browser screenshots selected the era silhouettes and composition. The reference site is https://thepangeamap.com/ . Its Natural Earth I projection and rounding of display frames to 10 Ma were inspected; this pack uses the exact requested 405 Ma reconstruction. Browser screenshots and site code are not redistributed in the runtime pack.

Terrain revision 2: two native ImageGen painting passes per map, with additional silhouette-constrained refinements for 540, 445 and 405 Ma. Original passes, selected refinement and exact prompts are retained under source/ and art-passes/. Native paintings remain 1774x887. The separate 6144x3072 geographic material/height/normal/roughness/AO/biome layers are numerically authored inference. The generated 1254x1254 four-material micro-atlas provides close-view rock, forest, sediment and ice texture. No optical flow or local image stretching is applied. Do not describe these as native 6K AI paintings or measured ancient topography.

Owner-QC finish correction: a separate 6K/2K shared-border distance field provides an antialiased visual stroke while retaining the exact logical masks and original engraving source. Corrected pixel-centred visual cliff contours retain land while omitting extrusion for tiny unanchored components below 12 ID texels. Matte cliff faces, stronger connected ridge relief and downhill incision, and reduced parchment tint address the initial review. The initial review is preserved and is not release approval.

The second owner review resolved border/coastal-wall P1s in inspected views and retained a terrain-detail finding. The latest terrain confines folded detail to tectonic/rocky highlands, reduces blurred colour-derived macro height, retains local atlas colour/rock normal definition and regenerates numeric diffuse colour without directional lighting. AO is independent. Both frozen reviews remain included; latest terrain acceptance requires a further visual decision.

Runtime revision 2 uses the same exact IDs, coast, graph, bonuses, anchors and mesh topology as revision 1. Both height lattices and the surface material response are revised together. The 2K mobile material set has the same UV contract. Current sources are r2_* and the raw little-endian r2_height_native_6k.u16; r1_* are labelled inherited comparison sources. The project MIT notice remains PROJECT_LICENSE.txt. The original main world and published R1 packs remain unchanged.
