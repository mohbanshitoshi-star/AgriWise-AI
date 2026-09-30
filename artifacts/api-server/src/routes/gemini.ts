import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  CreateGeminiConversationBody,
  CreateGeminiConversationResponse,
  DeleteGeminiConversationParams,
  GetGeminiConversationParams,
  GetGeminiConversationResponse,
  ListGeminiConversationsResponse,
  ListGeminiMessagesParams,
  ListGeminiMessagesResponse,
  SendGeminiMessageBody,
  SendGeminiMessageParams,
} from "@workspace/api-zod";
import { db, conversationsTable, messagesTable } from "@workspace/db";
import { authenticatedUserId, requireAuth } from "../middlewares/requireAuth";
import { ai, AGRONOMY_SYSTEM_PROMPT, GEMINI_MODEL, languageName } from "../lib/ai";

const router: IRouter = Router();
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 32,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Chat is taking a short break. Please try again in a few minutes." },
});

function serializeConversation(conversation: typeof conversationsTable.$inferSelect) {
  return {
    id: conversation.id,
    title: conversation.title,
    language: conversation.language,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

function serializeMessage(message: typeof messagesTable.$inferSelect) {
  return {
    id: message.id,
    conversationId: message.sessionId,
    role: message.sender,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}

router.get("/gemini/conversations", requireAuth, async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.userId, authenticatedUserId(res)))
    .orderBy(desc(conversationsTable.updatedAt))
    .limit(50);
  res.json(ListGeminiConversationsResponse.parse(rows.map(serializeConversation)));
});

router.post("/gemini/conversations", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateGeminiConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [conversation] = await db
    .insert(conversationsTable)
    .values({
      userId: authenticatedUserId(res),
      title: parsed.data.title.trim(),
      language: parsed.data.language,
    })
    .returning();
  res.status(201).json(CreateGeminiConversationResponse.parse(serializeConversation(conversation)));
});

router.get("/gemini/conversations/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetGeminiConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [conversation] = await db
    .select()
    .from(conversationsTable)
    .where(and(
      eq(conversationsTable.id, params.data.id),
      eq(conversationsTable.userId, authenticatedUserId(res)),
    ))
    .limit(1);
  if (!conversation) {
    res.status(404).json({ error: "Chat session not found." });
    return;
  }
  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.sessionId, conversation.id))
    .orderBy(asc(messagesTable.createdAt))
    .limit(300);
  res.json(GetGeminiConversationResponse.parse({
    ...serializeConversation(conversation),
    messages: messages.map(serializeMessage),
  }));
});

router.delete("/gemini/conversations/:id", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteGeminiConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(conversationsTable)
    .where(and(
      eq(conversationsTable.id, params.data.id),
      eq(conversationsTable.userId, authenticatedUserId(res)),
    ))
    .returning({ id: conversationsTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Chat session not found." });
    return;
  }
  res.sendStatus(204);
});

router.get("/gemini/conversations/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const params = ListGeminiMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = authenticatedUserId(res);
  const [conversation] = await db
    .select({ id: conversationsTable.id })
    .from(conversationsTable)
    .where(and(
      eq(conversationsTable.id, params.data.id),
      eq(conversationsTable.userId, userId),
    ))
    .limit(1);
  if (!conversation) {
    res.status(404).json({ error: "Chat session not found." });
    return;
  }
  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.sessionId, conversation.id))
    .orderBy(asc(messagesTable.createdAt))
    .limit(300);
  res.json(ListGeminiMessagesResponse.parse(messages.map(serializeMessage)));
});

router.post("/gemini/conversations/:id/messages", requireAuth, chatLimiter, async (req, res): Promise<void> => {
  const params = SendGeminiMessageParams.safeParse(req.params);
  const body = SendGeminiMessageBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({
      error: !params.success ? params.error.message : body.success ? "Invalid message." : body.error.message,
    });
    return;
  }
  const userId = authenticatedUserId(res);
  const [conversation] = await db
    .select()
    .from(conversationsTable)
    .where(and(
      eq(conversationsTable.id, params.data.id),
      eq(conversationsTable.userId, userId),
    ))
    .limit(1);
  if (!conversation) {
    res.status(404).json({ error: "Chat session not found." });
    return;
  }
  const userMessage = body.data.content.trim();
  if (!userMessage) {
    res.status(400).json({ error: "Message cannot be blank." });
    return;
  }
  await db.insert(messagesTable).values({
    sessionId: conversation.id,
    sender: "user",
    content: userMessage,
  });
  await db
    .update(conversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(conversationsTable.id, conversation.id));
  const history = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.sessionId, conversation.id))
    .orderBy(desc(messagesTable.createdAt))
    .limit(20);
  const contents = history.reverse().map((message) => ({
    role: message.sender === "assistant" ? "model" as const : "user" as const,
    parts: [{ text: message.content }],
  }));

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  let fullResponse = "";
  try {
    const stream = await ai.models.generateContentStream({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction: `${AGRONOMY_SYSTEM_PROMPT}\nAlways respond in ${languageName(conversation.language)}.`,
        maxOutputTokens: 8192,
      },
    });
    for await (const chunk of stream) {
      const text = chunk.text;
      if (!text) continue;
      fullResponse += text;
      res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
    }
    if (fullResponse.trim()) {
      await db.insert(messagesTable).values({
        sessionId: conversation.id,
        sender: "assistant",
        content: fullResponse,
      });
      await db
        .update(conversationsTable)
        .set({ updatedAt: new Date() })
        .where(eq(conversationsTable.id, conversation.id));
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (error) {
    req.log.error({ err: error }, "Agronomy chat generation failed");
    res.write(`data: ${JSON.stringify({ error: "The assistant could not reply. Please try again." })}\n\n`);
  }
  res.end();
});

export default router;