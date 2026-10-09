import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { getQuestion } from "@/lib/interview-questions";
import { handleRouteError, jsonError } from "@/lib/http";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const parts: { key: "situation" | "task" | "action" | "result"; max: number }[] = [
  { key: "situation", max: 1500 },
  { key: "task", max: 1500 },
  { key: "action", max: 2000 },
  { key: "result", max: 1500 },
];

/** Saves (creates or updates) the answer to one question. */
export async function POST(req: Request) {
  try {
    let body: Record<string, unknown>;
    try {
      body = ((await req.json()) ?? {}) as Record<string, unknown>;
    } catch {
      return jsonError("The request body wasn't valid JSON.", 400);
    }
    const question = typeof body.questionKey === "string" ? getQuestion(body.questionKey) : undefined;
    if (!question) return jsonError("That question doesn't exist.", 404);

    const row: Record<string, unknown> = { question_key: question.key, question_text: question.prompt };
    for (const { key, max } of parts) {
      const v = body[key];
      if (v !== undefined && (typeof v !== "string" || v.length > max)) return jsonError("That answer is too long. Shorten it a little.", 400);
      row[key] = typeof v === "string" ? v.trim() : "";
    }
    if (!row.situation && !row.task && !row.action && !row.result) return jsonError("Write your answer first.", 400);

    if (body.proofId !== undefined && body.proofId !== null) {
      if (typeof body.proofId !== "string" || !UUID.test(body.proofId)) return jsonError("That project link isn't valid.", 400);
      row.proof_id = body.proofId;
    } else {
      row.proof_id = null;
    }

    const { supabase, userId } = await getSupabase();
    const { data, error } = await supabase
      .from("interview_answers")
      .upsert({ user_id: userId, ...row }, { onConflict: "user_id,question_key" })
      .select("id, question_key, question_text, situation, task, action, result, proof_id, updated_at")
      .single();
    if (error) {
      if (error.code === "23503" || /proof not found/.test(error.message)) return jsonError("That project is no longer available.", 400);
      if (/answer limit/.test(error.message)) return jsonError("You can save up to 100 answers.", 400);
      throw error;
    }
    return NextResponse.json({ answer: data });
  } catch (err) {
    return handleRouteError(err);
  }
}
