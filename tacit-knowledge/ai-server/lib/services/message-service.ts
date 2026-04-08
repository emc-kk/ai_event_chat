import { Pool } from 'pg';
import { ulid } from 'ulid';

const postgresUrl = process.env.POSTGRES_URL ||
  `postgresql://${encodeURIComponent(process.env.POSTGRES_USER || "")}:${encodeURIComponent(process.env.POSTGRES_PASSWORD || "")}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`;

const isProduction = process.env.NODE_ENV === "production" ||
  postgresUrl.includes("neon.tech") ||
  (!postgresUrl.includes("localhost") && !postgresUrl.includes("127.0.0.1") && !postgresUrl.includes("host.docker.internal") && !postgresUrl.includes("postgres"));

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

function getPool(): Pool {
  if (!globalForDb.pool) {
    globalForDb.pool = new Pool({
      connectionString: postgresUrl,
      ...(isProduction && { ssl: { rejectUnauthorized: false } })
    });
  }
  return globalForDb.pool;
}

export type MessageType = 'assistant' | 'user';
export type ChatType = 'hearing' | 'validation' | 'topic';

const messageTypeMap: Record<MessageType, number> = {
  assistant: 0,
  user: 1
};

const chatTypeMap: Record<ChatType, number> = {
  hearing: 0,
  validation: 1,
  topic: 2
};

export interface SaveMessageParams {
  roomId: string;
  content: string;
  messageType: MessageType;
  chatType: ChatType;
  topicId?: string;
  requestId?: string;
  questionId?: string;
}

export async function saveMessage(params: SaveMessageParams): Promise<string> {
  const { roomId, content, messageType, chatType, topicId, requestId, questionId } = params;
  const pool = getPool();
  const id = ulid();

  const query = `
    INSERT INTO messages (id, room_id, content, message_type, chat_type, topic_id, request_id, question_id, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
    RETURNING id
  `;

  const values = [
    id,
    roomId,
    content,
    messageTypeMap[messageType],
    chatTypeMap[chatType],
    topicId || null,
    requestId || null,
    questionId || null
  ];

  const result = await pool.query(query, values);
  return result.rows[0].id;
}

export async function getLastAssistantMessageId(roomId: string): Promise<string | null> {
  const pool = getPool();

  const query = `
    SELECT id
    FROM messages
    WHERE room_id = $1 AND message_type = 0
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const result = await pool.query(query, [roomId]);

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0].id;
}

export interface Message {
  id: string;
  roomId: string;
  content: string;
  messageType: MessageType;
  chatType: ChatType;
  topicId?: string;
  requestId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const reverseMessageTypeMap: Record<number, MessageType> = {
  0: 'assistant',
  1: 'user'
};

const reverseChatTypeMap: Record<number, ChatType> = {
  0: 'hearing',
  1: 'validation',
  2: 'topic'
};

export async function getMessagesByRoomId(roomId: string): Promise<Message[]> {
  const pool = getPool();

  const query = `
    SELECT id, room_id, content, message_type, chat_type, topic_id, request_id, created_at, updated_at
    FROM messages
    WHERE room_id = $1
    ORDER BY created_at ASC
  `;

  const result = await pool.query(query, [roomId]);

  return result.rows.map(row => ({
    id: row.id,
    roomId: row.room_id,
    content: row.content,
    messageType: reverseMessageTypeMap[row.message_type],
    chatType: reverseChatTypeMap[row.chat_type],
    topicId: row.topic_id,
    requestId: row.request_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

export async function getRoomInfo(roomId: string): Promise<{ topicId?: string; requestId?: string; chatType: ChatType } | null> {
  const pool = getPool();

  const query = `
    SELECT topic_id, request_id, chat_type
    FROM rooms
    WHERE id = $1
  `;

  const result = await pool.query(query, [roomId]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    topicId: row.topic_id,
    requestId: row.request_id,
    chatType: row.chat_type as ChatType
  };
}

export interface SaveMessageFileParams {
  messageId: string;
  filePath: string;
  fileName: string;
  contentType: string;
  fileSize?: number;
}

export async function saveMessageFile(params: SaveMessageFileParams): Promise<string> {
  const { messageId, filePath, fileName, contentType, fileSize } = params;
  const pool = getPool();
  const id = ulid();

  const sql = `
    INSERT INTO message_files (id, message_id, file_path, file_name, content_type, file_size, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    RETURNING id
  `;

  const values = [id, messageId, filePath, fileName, contentType, fileSize || null];
  const result = await pool.query(sql, values);
  return result.rows[0].id;
}
