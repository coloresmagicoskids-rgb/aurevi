// src/services/videoAnalysis.js
import { supabase } from "../supabaseClient";

/**
 * Guarda en Supabase el análisis de un video.
 *
 * @param {Object} params
 * @param {string} params.videoId - UUID del video en la tabla public.videos
 * @param {string} [params.moodDetected]
 * @param {string} [params.emotion]
 * @param {number} [params.clarity]             // 0–100
 * @param {number} [params.narrativeQuality]    // 0–100
 * @param {number} [params.creativityScore]     // 0–100
 * @param {string} [params.advice]
 */
export async function saveVideoAnalysis({
  videoId,
  moodDetected,
  emotion,
  clarity,
  narrativeQuality,
  creativityScore,
  advice,
}) {
  const { data, error } = await supabase
    .from("video_analysis")
    .insert([
      {
        video_id: videoId,
        mood_detected: moodDetected,
        emotion,
        clarity,
        narrative_quality: narrativeQuality,
        creativity_score: creativityScore,
        advice,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Error guardando análisis de video:", error);
    throw error;
  }

  return data;
}