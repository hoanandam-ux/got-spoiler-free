const db = require('level')('./users')

const set = module.exports.set = (name, value) => {
  return db.put(name, value)
}

const get = module.exports.get = (name, fallback = '') => {
  return new Promise((resolve) => {
    db.get(name, (err, value) => {
      return err ? resolve(fallback) : resolve(value)
    })
  })
}

const addUser = module.exports.addUser = async (name) => {
  const payload = await get('users', '')
  const users = payload ? payload.split(',') : []
  const uniq = [...new Set([...users, name])]

  set('users', uniq.join())
}

const getUsers = module.exports.getUsers = async () => {
  const payload = await get('users', '')
  const users = payload ? payload.split(',').filter(x => x) : []
  const warns = await Promise.all(users.map((user) => get(user, 0)))

  return users.map((user, index) => [user, warns[index]])
}
