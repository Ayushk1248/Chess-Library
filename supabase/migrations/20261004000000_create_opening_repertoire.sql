CREATE TABLE public.openings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX openings_user_updated_at_idx
    ON public.openings (user_id, updated_at DESC);

CREATE TABLE public.opening_nodes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    opening_id uuid NOT NULL REFERENCES public.openings (id) ON DELETE CASCADE,
    parent_node_id uuid,
    move_san text NOT NULL,
    fen_after text NOT NULL,
    move_number integer NOT NULL CHECK (move_number > 0),
    is_mainline boolean NOT NULL DEFAULT true,
    CONSTRAINT opening_nodes_id_opening_id_key UNIQUE (id, opening_id),
    CONSTRAINT opening_nodes_parent_same_opening_fk
        FOREIGN KEY (parent_node_id, opening_id)
        REFERENCES public.opening_nodes (id, opening_id)
        ON DELETE CASCADE
);

CREATE INDEX opening_nodes_opening_parent_idx
    ON public.opening_nodes (opening_id, parent_node_id);

CREATE FUNCTION public.prevent_opening_node_cycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    creates_cycle boolean;
BEGIN
    IF NEW.parent_node_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.parent_node_id = NEW.id THEN
        RAISE EXCEPTION 'An opening node cannot be its own parent';
    END IF;

    WITH RECURSIVE ancestors (id, parent_node_id) AS (
        SELECT id, parent_node_id
        FROM public.opening_nodes
        WHERE id = NEW.parent_node_id
          AND opening_id = NEW.opening_id
        UNION
        SELECT node.id, node.parent_node_id
        FROM public.opening_nodes AS node
        JOIN ancestors ON node.id = ancestors.parent_node_id
        WHERE node.opening_id = NEW.opening_id
    )
    SELECT EXISTS (
        SELECT 1 FROM ancestors WHERE id = NEW.id
    )
    INTO creates_cycle;

    IF creates_cycle THEN
        RAISE EXCEPTION 'An opening node cannot create a parent cycle';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER opening_nodes_prevent_cycle
    BEFORE INSERT OR UPDATE
    ON public.opening_nodes
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_opening_node_cycle();

CREATE FUNCTION public.set_openings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER openings_set_updated_at
    BEFORE UPDATE ON public.openings
    FOR EACH ROW
    EXECUTE FUNCTION public.set_openings_updated_at();

ALTER TABLE public.openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opening_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY openings_select_own
    ON public.openings FOR SELECT
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY openings_insert_own
    ON public.openings FOR INSERT
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY openings_update_own
    ON public.openings FOR UPDATE
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY openings_delete_own
    ON public.openings FOR DELETE
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY opening_nodes_select_own
    ON public.opening_nodes FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.openings
            WHERE openings.id = opening_nodes.opening_id
              AND openings.user_id = (SELECT auth.uid())
        )
    );

CREATE POLICY opening_nodes_insert_own
    ON public.opening_nodes FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.openings
            WHERE openings.id = opening_nodes.opening_id
              AND openings.user_id = (SELECT auth.uid())
        )
    );

CREATE POLICY opening_nodes_update_own
    ON public.opening_nodes FOR UPDATE
    USING (
        EXISTS (
            SELECT 1
            FROM public.openings
            WHERE openings.id = opening_nodes.opening_id
              AND openings.user_id = (SELECT auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.openings
            WHERE openings.id = opening_nodes.opening_id
              AND openings.user_id = (SELECT auth.uid())
        )
    );

CREATE POLICY opening_nodes_delete_own
    ON public.opening_nodes FOR DELETE
    USING (
        EXISTS (
            SELECT 1
            FROM public.openings
            WHERE openings.id = opening_nodes.opening_id
              AND openings.user_id = (SELECT auth.uid())
        )
    );