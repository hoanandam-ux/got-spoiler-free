const TelegramBot = require('node-telegram-bot-api')

const token = require('./.token')
const guard = require('./guard')
const orm = require('./orm')

const bot = new TelegramBot(token, { polling: true })

// ===============================
// ⚙️ CẤU HÌNH CHỐNG SPAM
// ===============================
const SPAM_LIMIT_SECONDS = 3
const MUTE_HOURS = 3
const MAX_WARNINGS = 3

let userLastMessage = {}
let userWarnings = {}

const CLEAR_CHAT_SPACE = Array(40).fill('\n').join('.')
const CLEAR_CHAT_TEXT = 'Whaaa! Do not spoil things in here! 🚨'

// ===============================
// 🔪 KICK (GIỮ NGUYÊN + FIX LỖI)
// ===============================
const kick = (chatID, userID, name) => {
  bot.kickChatMember(chatID, userID).then((kicked) => {
    if (kicked) {
      orm.set(name, 2)
      bot.sendMessage(chatID, `🔪 ${name} is being kicked out`)
    }
  })
}

// ===============================
// ⚠️ WARN (GIỮ NGUYÊN)
// ===============================
const warn = (chatID, name) => {
  orm.addUser(name)
  orm.set(name, 1)
  bot.sendMessage(chatID, `Ooops! First and last warn for ${name} 🙅`)
}

// ===============================
// 🔒 MUTE 3 GIỜ (THÊM)
// ===============================
async function muteUser(chatID, userID, name, reason) {
  const untilDate = Math.floor(Date.now() / 1000) + (MUTE_HOURS * 60 * 60)

  await bot.restrictChatMember(chatID, userID, {
    can_send_messages: false,
    until_date: untilDate
  })

  bot.sendMessage(
    chatID,
    `🚫 ${name} đã bị khóa 3 giờ vì: ${reason}`
  )
}

// ===============================
// 🚨 WARN SYSTEM MỚI (KHÔNG ẢNH HƯỞNG ORM CŨ)
// ===============================
async function warnAdvanced(chatID, userID, name, reason) {
  await bot.deleteMessage(chatID, undefined).catch(() => {})

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
// 📊 /warns (GIỮ NGUYÊN)
// ===============================
bot.onText(/\/warns/, async (incoming) => {
  const chatID = incoming.chat.id
  const users = await orm.getUsers()

  const message = users.map(([user, warning]) => {
    return warning === '1'
      ? `⚠️ ${user} has ${warning} warn(s)`
      : `☠️ ${user} has been kicked out`
  })

  bot.sendMessage(chatID, message.join('\n'))
})

// ===============================
// 🚨 MAIN MESSAGE HANDLER (TÍCH HỢP)
// ===============================
bot.on('message', async (incoming) => {

  const chatID = incoming.chat.id
  const userID = incoming.from.id
  const name = incoming.from.username || incoming.from.first_name
  const cleanChatMessage = CLEAR_CHAT_SPACE + CLEAR_CHAT_TEXT

  try {
    const member = await bot.getChatMember(chatID, userID)

    // Admin không áp dụng luật
    if (member.status === "administrator" || member.status === "creator") {
      return
    }

    // ===================================
    // 🔥 GUARD GỐC (GIỮ NGUYÊN)
    // ===================================
    if (guard(new Date())) {

      const warning = await orm.get(name)
      bot.sendMessage(chatID, cleanChatMessage)

      return warning === '1'
        ? bot.kickChatMember(chatID, userID)
        : warn(chatID, name)
    }

    // ===================================
    // 🛑 CHỐNG SPAM 3 GIÂY
    // ===================================
    const now = Date.now() / 1000

    if (userLastMessage[userID]) {
      if (now - userLastMessage[userID] < SPAM_LIMIT_SECONDS) {
        return warnAdvanced(chatID, userID, name, "Spam tin nhắn")
      }
    }

    userLastMessage[userID] = now

    // ===================================
    // 🖼️ CHẶN ẢNH
    // ===================================
    if (incoming.photo) {
      return warnAdvanced(chatID, userID, name, "Gửi hình ảnh")
    }

    // ===================================
    // 🔗 CHẶN LINK
    // ===================================
    if (incoming.entities) {
      for (let entity of incoming.entities) {
        if (entity.type === "url" || entity.type === "text_link") {
          return warnAdvanced(chatID, userID, name, "Gửi link website")
        }
      }
    }

    // ===================================
    // 🌐 CHẶN DOMAIN KHÔNG HTTP
    // ===================================
    if (incoming.text) {
      const domainPattern = /\b[a-zA-Z0-9-]+\.(com|net|org|vn|xyz|info|io|me|co)\b/i
      if (domainPattern.test(incoming.text)) {
        return warnAdvanced(chatID, userID, name, "Gửi link website")
      }
    }

  } catch (err) {
    console.log(err)
  }
})

console.log("Bot đang chạy...")
