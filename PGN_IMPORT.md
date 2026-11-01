# PGN import

Apply `supabase/migrations/20261101000000_import_pgn_repertoires.sql` to your Supabase project using your normal migration workflow or the Supabase SQL editor. It adds the `import_pgn_repertoires` function; no existing data or policies are changed.

Then sign in and choose **Import PGN** in the dashboard library. Upload a `.pgn` or `.txt` file, or paste PGN, preview the games, optionally rename the openings, and import. On phones, open the library menu first.

Each game creates a separate opening. Existing openings and unsaved board work stay unchanged. Main lines and nested variations are saved; variations receive generated names. Repeating an import creates another copy rather than merging into existing openings.

Comments, numeric annotation glyphs, and other annotations are not stored. Only standard chess from the normal starting position is supported. Unsupported FEN positions and variants are rejected explicitly.

Limits: 1 MB, 50 games, 5,000 total moves, and 32 variation levels per import. A batch is validated before saving and committed in one database transaction, so a failed batch creates no partial openings. Existing row-level security applies to all writes.

Run `npm test` for parser regression tests. Run `npx tsc --noEmit` for type checking and `npx next build --webpack` for the production build. This workspace's Turbopack subprocess issue also affects the default build command.
