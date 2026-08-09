/*
# Update screenplay_discovery view to include new metadata columns

## Summary
Recreates the screenplay_discovery view to include the new screenplay metadata columns
(secondary_genre, format_type, budget_range, themes, primary_setting, time_period, tone,
target_audience, industry_qualified, visibility) added in Build 02.
*/

DROP VIEW IF EXISTS public.screenplay_discovery;

CREATE VIEW public.screenplay_discovery AS
WITH agg AS (
  SELECT s_1.id AS screenplay_id,
    count(DISTINCT a.id) AS total_assignments,
    count(DISTINCT
        CASE
            WHEN a.status = ANY (ARRAY['completed'::assignment_status, 'abandoned'::assignment_status]) THEN a.id
            ELSE NULL::uuid
        END) AS responded_assignments,
    count(DISTINCT
        CASE
            WHEN a.status = 'completed'::assignment_status THEN a.id
            ELSE NULL::uuid
        END) AS completed_assignments,
    count(DISTINCT
        CASE
            WHEN a.status = 'abandoned'::assignment_status THEN a.id
            ELSE NULL::uuid
        END) AS abandoned_assignments,
    count(DISTINCT a.reader_id) AS reader_count,
    count(DISTINCT f.id) AS feedback_count,
    count(DISTINCT
        CASE
            WHEN f.would_recommend THEN f.id
            ELSE NULL::uuid
        END) AS recommend_count,
    COALESCE(avg(f.overall_rating), 0::numeric) AS avg_rating,
    COALESCE(avg(f.story_rating), 0::numeric) AS avg_story,
    COALESCE(avg(f.characters_rating), 0::numeric) AS avg_characters,
    COALESCE(avg(f.pacing_rating), 0::numeric) AS avg_pacing,
    COALESCE(avg(f.dialogue_rating), 0::numeric) AS avg_dialogue,
    COALESCE(avg(sess.last_page_reached), 0::numeric) AS avg_last_page,
    count(DISTINCT sess.id) AS total_sessions,
    count(DISTINCT
        CASE
            WHEN sess.session_number > 1 THEN sess.id
            ELSE NULL::uuid
        END) AS return_sessions
   FROM screenplays s_1
     LEFT JOIN assignments a ON a.screenplay_id = s_1.id
     LEFT JOIN reader_feedback f ON f.screenplay_id = s_1.id
     LEFT JOIN reading_sessions sess ON sess.screenplay_id = s_1.id
  GROUP BY s_1.id
)
SELECT s.id,
    s.title,
    s.genre,
    s.logline,
    s.synopsis,
    s.writer_id,
    p.display_name AS writer_name,
    p.company AS writer_company,
    s.cover_color,
    s.tags,
    s.page_count,
    s.published_at,
    COALESCE(agg.total_assignments, 0::bigint) AS total_assignments,
    COALESCE(agg.reader_count, 0::bigint) AS reader_count,
    COALESCE(agg.completed_assignments, 0::bigint) AS completed_count,
    COALESCE(agg.abandoned_assignments, 0::bigint) AS abandoned_count,
    COALESCE(agg.feedback_count, 0::bigint) AS feedback_count,
    COALESCE(agg.recommend_count, 0::bigint) AS recommend_count,
    CASE
        WHEN COALESCE(agg.reader_count, 0::bigint) = 0 THEN 0::numeric
        ELSE round(agg.completed_assignments::numeric / agg.reader_count::numeric * 100::numeric, 1)
    END AS completion_rate,
    CASE
        WHEN COALESCE(agg.feedback_count, 0::bigint) = 0 THEN 0::numeric
        ELSE round(agg.recommend_count::numeric / agg.feedback_count::numeric * 100::numeric, 1)
    END AS recommend_rate,
    round(COALESCE(agg.avg_rating, 0::numeric), 1) AS avg_rating,
    round(COALESCE(agg.avg_story, 0::numeric), 1) AS avg_story,
    round(COALESCE(agg.avg_characters, 0::numeric), 1) AS avg_characters,
    round(COALESCE(agg.avg_pacing, 0::numeric), 1) AS avg_pacing,
    round(COALESCE(agg.avg_dialogue, 0::numeric), 1) AS avg_dialogue,
    round(COALESCE(agg.avg_last_page, 0::numeric), 1) AS avg_last_page,
    COALESCE(agg.total_sessions, 0::bigint) AS total_sessions,
    COALESCE(agg.return_sessions, 0::bigint) AS return_sessions,
    CASE
        WHEN COALESCE(agg.total_sessions, 0::bigint) = 0 THEN 0::numeric
        ELSE round(agg.return_sessions::numeric / agg.total_sessions::numeric * 100::numeric, 1)
    END AS return_rate,
    LEAST(round(COALESCE(agg.reader_count, 0::bigint)::numeric / 10::numeric * 100::numeric), 100::numeric)::integer AS confidence_score,
    s.secondary_genre,
    s.format_type,
    s.budget_range,
    s.themes,
    s.primary_setting,
    s.time_period,
    s.tone,
    s.target_audience,
    s.industry_qualified,
    s.visibility
   FROM screenplays s
     JOIN profiles p ON p.id = s.writer_id
     LEFT JOIN agg ON agg.screenplay_id = s.id
  WHERE s.status = 'published'::screenplay_status;

GRANT SELECT ON public.screenplay_discovery TO authenticated;
