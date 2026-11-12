# Play launch correction · 12 November 2026

Google rejected production code12/1.0.0 because installation succeeded but Android could not find com.meadowmarket.littles.MainActivity. The second general-policy entry provides no separate actionable finding. The policy email explicitly identifies code12.

The rejected signed AAB (SHA256 4624fb9f56432cd62d03eea6401ae6e49df7b2980b97bf7d9bb32977c3d74b85) was inspected directly. Its DEX class-definition tables omit MainActivity. The acceptance build previously tested on the phone had that class, so its successful launch did not qualify the production artifact. The production javac output also omitted the launcher after its source-path move.

Release bundle commands now clean the app's compilation output first. The manifest explicitly names the launcher. After each APK/AAB build, check-package.cjs reads the compiled class definitions and checks the public, concrete launcher, its Capacitor superclass, picture bridge and three native plugins against the packaged manifest. A string reference alone does not pass. CI checks both acceptance and production-flavor APKs.

The new check fails on the preserved rejected12 bundle with Missing compiled Littles class: MainActivity. A clean signed production14/1.0.1 build passes with18655 defined classes and the launcher in base/dex/classes2.dex. Its SHA256 is8528c0dd01ded382e456b3b968a77d5e0d3a3c4e7961cee8e609f260ea2c83c0; jarsigner verifies its signature. Production lint and the complete Littles regression suite pass.

The exact production bundle is being qualified through the existing internal Play track before promotion. Final phone and submission receipts are kept outside source in the local acceptance evidence directory; this document does not claim that Google has approved the corrected build.

This release preserves the separately deployed, read-only Fairplay Admin operations migration20261112033914 as source. No migration is redeployed. Launch flags, grants, reviewer access, billing/notification functions, web build53 and game assets are unchanged.
