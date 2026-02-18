const { Level } = require('level')

// tạo database ./users (value dạng string)
const db = new Level('./users', { valueEncoding: 'utf8' })

const set = module.exports.set = async (name, value) => {
  await db.put(name, value)
}

const get = module.exports.get = async (name, fallback = 0) => {
  try {
    const value = await db.get(name)
    return value
  } catch (err) {
    return fallback
  }
}

const addUser = module.exports.addUser = async (name) => {
  const payload = await get('users', '')
  const users = payload ? payload.split(',') : []
  const uniq = [...new Set([...users, name])]
  await set('users', uniq.join(','))
}

const getUsers = module.exports.getUsers = async () => {
  const payload = await get('users', '')
  const users = payload ? payload.split(',').filter(x => x) : []

  const warns = await Promise.all(users.map((user) => get(user)))
  return users.map((user, index) => [user, warns[index]])
}
