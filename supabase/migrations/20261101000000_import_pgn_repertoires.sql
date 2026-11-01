-- Save a validated PGN batch atomically. Existing RLS policies remain in force.
CREATE OR REPLACE FUNCTION public.import_pgn_repertoires(p_games jsonb)
RETURNS TABLE (id uuid, name text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    game jsonb;
    node jsonb;
    imported public.openings%ROWTYPE;
    node_ids uuid[];
    node_id uuid;
    parent_index integer;
    node_index integer;
    total_moves integer := 0;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Sign in before importing PGN.';
    END IF;
    IF jsonb_typeof(p_games) IS DISTINCT FROM 'array'
       OR jsonb_array_length(p_games) NOT BETWEEN 1 AND 50
       OR octet_length(p_games::text) > 5000000 THEN
        RAISE EXCEPTION 'Import between 1 and 50 games, with at most 5000 moves.';
    END IF;

    FOR game IN SELECT value FROM jsonb_array_elements(p_games) LOOP
        IF length(trim(game->>'name')) NOT BETWEEN 1 AND 100
           OR game->>'name' IS NULL
           OR jsonb_typeof(game->'nodes') IS DISTINCT FROM 'array'
           OR jsonb_array_length(game->'nodes') = 0 THEN
            RAISE EXCEPTION 'Each imported opening needs a name and moves.';
        END IF;
        total_moves := total_moves + jsonb_array_length(game->'nodes');
        IF total_moves > 5000 THEN
            RAISE EXCEPTION 'Import at most 5000 moves at a time.';
        END IF;
        INSERT INTO public.openings AS o (user_id, name)
        VALUES (auth.uid(), trim(game->>'name')) RETURNING o.* INTO imported;
        node_ids := ARRAY[]::uuid[];
        node_index := 0;
        FOR node IN SELECT value FROM jsonb_array_elements(game->'nodes') LOOP
            parent_index := (node->>'parent')::integer;
            IF parent_index IS NOT NULL AND (parent_index < 0 OR parent_index >= node_index) THEN
                RAISE EXCEPTION 'An imported move has an invalid parent.';
            END IF;
            node_id := gen_random_uuid();
            INSERT INTO public.opening_nodes (
                id, opening_id, parent_node_id, move_san, fen_after,
                move_number, is_mainline, variation_name
            ) VALUES (
                node_id, imported.id,
                CASE WHEN parent_index IS NULL THEN NULL ELSE node_ids[parent_index + 1] END,
                node->>'move_san', node->>'fen_after',
                (node->>'move_number')::integer, (node->>'is_mainline')::boolean,
                node->>'variation_name'
            );
            node_ids := array_append(node_ids, node_id);
            node_index := node_index + 1;
        END LOOP;
        id := imported.id;
        name := imported.name;
        created_at := imported.created_at;
        RETURN NEXT;
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.import_pgn_repertoires(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_pgn_repertoires(jsonb) TO authenticated;
