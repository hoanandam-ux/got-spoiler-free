const TelegramBot = require('node-telegram-bot-api')
const orm = require('./orm')

// 🔑 TOKEN
const token = require('./.token')

// ❗ Fix lỗi 409: đảm bảo chỉ polling 1 instance
const bot = new TelegramBot(token, { polling: { interval: 300, autoStart: true } })

// ===============================
// ⚙️ CẤU HÌNH
// ===============================
const SPAM_LIMIT_SECONDS = 3
const MUTE_HOURS = 3
const MAX_WARNINGS = 3

let userLastMessage = {}
let userWarnings = {}

const CLEAR_CHAT_SPACE = Array(20).fill('\n').join('.')
const CLEAR_CHAT_TEXT = '🚫 Không được spoil, spam, gửi ảnh hoặc link!'

// ===============================
// 🔒 MUTE 3 GIỜ
// ===============================
async function muteUser(chatID, userID, name, reason) {
  const untilDate = Math.floor(Date.now() / 1000) + (MUTE_HOURS * 60 * 60)

  await bot.restrictChatMember(chatID, userID, {
    can_send_messages: false,
    until_date: untilDate
  })

  bot.sendMessage(chatID, `🚫 ${name} đã bị khóa 3 giờ vì: ${reason}`)
}

// ===============================
// ⚠️ CẢNH CÁO NÂNG CAO
// ===============================
async function warnAdvanced(chatID, userID, name, reason, messageID) {
  await bot.deleteMessage(chatID, messageID).catch(() => {})

  if (!userWarnings[userID]) userWarnings[userID] = 0

  userWarnings[userID]++
  const warnings = userWarnings[userID]

  if (warnings >= MAX_WARNINGS) {
    await muteUser(chatID, userID, name, reason)
    userWarnings[userID] = 0
  } else {
    bot.sendMessage(
      chatID,
      `⚠️ ${name} vi phạm: ${reason}\nCảnh cáo ${warnings}/${MAX_WARNINGS}`
    )
  }
}

// ===============================
// 👋 CHÀO THÀNH VIÊN MỚI
// ===============================
bot.on('new_chat_members', async (msg) => {
  for (const member of msg.new_chat_members) {
    if (member.is_bot) continue
    bot.sendMessage(
      msg.chat.id,
      `🎉 Chào mừng ${member.first_name} vào nhóm!\n⚠️ Không spam, không gửi ảnh, không gửi link.`
    )
  }
})

// ===============================
// 🚨 MAIN HANDLER
// ===============================
bot.on('message', async (incoming) => {

  if (!incoming.from) return

  const chatID = incoming.chat.id
  const userID = incoming.from.id
  const name = incoming.from.username || incoming.from.first_name
  const now = Date.now() / 1000

  try {
    const member = await bot.getChatMember(chatID, userID)

    // Admin bỏ qua
    if (member.status === "administrator" || member.status === "creator") return

    // ===============================
    // 🛑 CHỐNG SPAM 3 GIÂY
    // ===============================
    if (userLastMessage[userID]) {
      if (now - userLastMessage[userID] < SPAM_LIMIT_SECONDS) {
        return warnAdvanced(chatID, userID, name, "Spam tin nhắn", incoming.message_id)
      }
    }
    userLastMessage[userID] = now

    // ===============================
    // 🖼️ CHẶN ẢNH
    // ===============================
    if (incoming.photo) {
      return warnAdvanced(chatID, userID, name, "Gửi hình ảnh", incoming.message_id)
    }

    // ===============================
    // 🔗 CHẶN LINK TELEGRAM DETECT
    // ===============================
    if (incoming.entities) {
      for (let entity of incoming.entities) {
        if (entity.type === "url" || entity.type === "text_link") {
          return warnAdvanced(chatID, userID, name, "Gửi link website", incoming.message_id)
        }
      }
    }

    // ===============================
    // 🌐 CHẶN DOMAIN KHÔNG HTTP
    // ===============================
    if (incoming.text) {
      const domainPattern = /\b[a-zA-Z0-9-]+\.(com|net|org|vn|xyz|info|io|me|co)\b/i
      if (domainPattern.test(incoming.text)) {
        return warnAdvanced(chatID, userID, name, "Gửi link website", incoming.message_id)
      }
    }

  } catch (err) {
    console.log("Lỗi:", err.message)
  }
})

console.log("🤖 Bot Telegram đang chạy 24/7...")
