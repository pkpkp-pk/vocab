export async function savePracticeSession(client, userId, topic, result) {
  const { error } = await client.from("practice_sessions").insert({
    user_id: userId,
    topic_id: String(topic.id ?? ""),
    topic_title: topic.title,
    topic_prompt: topic.prompt,
    topic_category: topic.category ?? "",
    topic_difficulty: topic.difficulty ?? "",
    transcript: result.transcript ?? "",
    duration_seconds: Math.round(result.durationSeconds ?? 0),
  });
  if (error) throw error;
}

export async function getPracticeSessions(client) {
  const { data, error } = await client
    .from("practice_sessions")
    .select("id, topic_title, topic_prompt, topic_category, topic_difficulty, transcript, duration_seconds, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data;
}

export async function deletePracticeSession(client, id) {
  const { error } = await client.from("practice_sessions").delete().eq("id", id);
  if (error) throw error;
}
