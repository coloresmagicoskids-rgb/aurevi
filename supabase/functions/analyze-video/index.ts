// supabase/functions/analyze-video/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const openaiApiKey = Deno.env.get("OPENAI_API_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response("Use POST", { status: 405 });
    }

    const body = await req.json();
    const videoId: string | undefined = body.video_id;
    const transcript: string | undefined = body.transcript; // opcional

    if (!videoId) {
      return new Response(
        JSON.stringify({ error: "video_id requerido" }),
        { status: 400 }
      );
    }

    // 1) Cargar info básica del video
    const { data: video, error: videoError } = await supabase
      .from("videos")
      .select("id, title, description, category, camera_mode")
      .eq("id", videoId)
      .maybeSingle();

    if (videoError || !video) {
      return new Response(
        JSON.stringify({ error: "No se encontró el video" }),
        { status: 404 }
      );
    }

    // 2) Construir texto base para la IA
    const baseText = `
      Título: ${video.title ?? "sin título"}
      Descripción: ${video.description ?? "sin descripción"}
      Categoría: ${video.category ?? "sin categoría"}
      Modo de cámara: ${video.camera_mode ?? "normal"}
      Transcripción (si existe): ${transcript ?? "no disponible"}
    `;

    // 3) Llamar a OpenAI (gpt-4o-mini) pidiendo JSON
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Eres un mentor creativo para videos cortos. Analiza el contenido y responde SOLO con un JSON.",
          },
          {
            role: "user",
            content: `
Analiza este video y devuelve un JSON con esta forma exacta:
{
  "mood_detected": "suave | intenso | introspectivo | jugueton | terapeutico",
  "emotion": "texto corto",
  "clarity": 1-5,
  "narrative_quality": 1-5,
  "creativity_score": 1-5,
  "advice": "un solo párrafo breve con recomendaciones concretas"
}

Contenido del video:
${baseText}
          `,
          },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const text = await openaiRes.text();
      console.error("Error OpenAI:", text);
      return new Response(
        JSON.stringify({ error: "Error al llamar a OpenAI" }),
        { status: 500 }
      );
    }

    const completion = await openaiRes.json();
    const content = completion.choices[0].message.content;
    const parsed = JSON.parse(content);

    // 4) Guardar en video_analysis
    const { error: insertError } = await supabase
      .from("video_analysis")
      .insert({
        video_id: videoId,
        mood_detected: parsed.mood_detected ?? null,
        emotion: parsed.emotion ?? null,
        clarity: parsed.clarity ?? null,
        narrative_quality: parsed.narrative_quality ?? null,
        creativity_score: parsed.creativity_score ?? null,
        advice: parsed.advice ?? null,
      });

    if (insertError) {
      console.error("Error insert video_analysis:", insertError);
      return new Response(
        JSON.stringify({ error: "No se pudo guardar el análisis" }),
        { status: 500 }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, analysis: parsed }),
      { status: 200 }
    );
  } catch (err) {
    console.error("Error inesperado:", err);
    return new Response(
      JSON.stringify({ error: "Error inesperado" }),
      { status: 500 }
    );
  }
});
