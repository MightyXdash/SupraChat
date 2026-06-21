const fs = require("node:fs")
const path = require("node:path")
const Database = require("better-sqlite3")

function ensureDatabaseDirectory(databasePath) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true })
}

function createChatDatabase(databasePath) {
  ensureDatabaseDirectory(databasePath)

  const db = new Database(databasePath)
  db.pragma("foreign_keys = ON")
  db.exec(`
    CREATE TABLE IF NOT EXISTS health_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      title_status TEXT NOT NULL DEFAULT 'idle',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      position INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_conversations_updated_at
      ON conversations(updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_messages_conversation_position
      ON messages(conversation_id, position);
  `)

  const tableInfo = db.prepare("PRAGMA table_info(conversations)").all()
  const hasTitleStatus = tableInfo.some((col) => col.name === "title_status")

  if (!hasTitleStatus) {
    db.exec(`ALTER TABLE conversations ADD COLUMN title_status TEXT NOT NULL DEFAULT 'idle'`)
  }

  const listConversationsStatement = db.prepare(`
    SELECT
      conversations.id AS conversation_id,
      conversations.title AS conversation_title,
      conversations.title_status AS conversation_title_status,
      conversations.created_at AS conversation_created_at,
      conversations.updated_at AS conversation_updated_at,
      messages.id AS message_id,
      messages.role AS message_role,
      messages.content AS message_content,
      messages.created_at AS message_created_at
    FROM conversations
    LEFT JOIN messages
      ON messages.conversation_id = conversations.id
    ORDER BY conversations.updated_at DESC, messages.position ASC
  `)

  const insertConversationStatement = db.prepare(`
    INSERT INTO conversations (id, title, title_status, created_at, updated_at)
    VALUES (@id, @title, @title_status, @created_at, @updated_at)
  `)

  const deleteConversationMessagesStatement = db.prepare(`
    DELETE FROM messages
    WHERE conversation_id = ?
  `)

  const insertMessageStatement = db.prepare(`
    INSERT INTO messages (id, conversation_id, role, content, created_at, position)
    VALUES (@id, @conversation_id, @role, @content, @created_at, @position)
  `)

  const updateConversationStatement = db.prepare(`
    UPDATE conversations
    SET title = @title, title_status = @title_status, updated_at = @updated_at
    WHERE id = @id
  `)

  const deleteConversationStatement = db.prepare(`
    DELETE FROM conversations
    WHERE id = ?
  `)

  const conversationExistsStatement = db.prepare(`
    SELECT 1
    FROM conversations
    WHERE id = ?
  `)

  const recordHealthCheckStatement = db.prepare(`
    INSERT INTO health_checks (source)
    VALUES (?)
  `)

  const saveConversation = db.transaction((conversation) => {
    insertConversationStatement.run({
      id: conversation.id,
      title: conversation.title,
      title_status: conversation.titleStatus || "idle",
      created_at: conversation.createdAt,
      updated_at: conversation.updatedAt,
    })

    conversation.messages.forEach((message, index) => {
      insertMessageStatement.run({
        id: message.id,
        conversation_id: conversation.id,
        role: message.role,
        content: message.content,
        created_at: message.createdAt,
        position: index,
      })
    })
  })

  const replaceConversation = db.transaction((conversation) => {
    updateConversationStatement.run({
      id: conversation.id,
      title: conversation.title,
      title_status: conversation.titleStatus || "idle",
      updated_at: conversation.updatedAt,
    })
    deleteConversationMessagesStatement.run(conversation.id)

    conversation.messages.forEach((message, index) => {
      insertMessageStatement.run({
        id: message.id,
        conversation_id: conversation.id,
        role: message.role,
        content: message.content,
        created_at: message.createdAt,
        position: index,
      })
    })
  })

  function serializeConversations() {
    const rows = listConversationsStatement.all()
    const conversations = []
    const conversationMap = new Map()

    for (const row of rows) {
      let conversation = conversationMap.get(row.conversation_id)

      if (!conversation) {
        conversation = {
          id: row.conversation_id,
          title: row.conversation_title,
          titleStatus: row.conversation_title_status || "idle",
          createdAt: row.conversation_created_at,
          updatedAt: row.conversation_updated_at,
          messages: [],
        }
        conversationMap.set(row.conversation_id, conversation)
        conversations.push(conversation)
      }

      if (row.message_id) {
        conversation.messages.push({
          id: row.message_id,
          role: row.message_role,
          content: row.message_content,
          createdAt: row.message_created_at,
        })
      }
    }

    return conversations
  }

  return {
    close: () => db.close(),
    deleteConversation: (conversationId) => deleteConversationStatement.run(conversationId),
    hasConversation: (conversationId) => Boolean(conversationExistsStatement.get(conversationId)),
    recordHealthCheck: () => recordHealthCheckStatement.run("node-backend"),
    replaceConversation,
    saveConversation,
    serializeConversations,
  }
}

module.exports = {
  createChatDatabase,
}
