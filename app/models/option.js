/**
 * Тут комментируй
 */

const mongoose = require('mongoose')
const { extend } = require('lodash')

const { is } = require('./utils')
const ObjectId = mongoose.Schema.Types.ObjectId
/**
 * Create model for particular option in the poll.
 * Track its id, value and amount of people voted for this option.
 * @type {mongoose}
 */
const model = new mongoose.Schema(extend({
  pollId: { type: ObjectId, ref: 'Post' }, // _id опроса
  value: { type: String, required: true }, // значение поля
  votes: [{ type: Number }] // список проголосовавших юзеров
}, is))

model.index({ 'pollId': 1 })

/**
 * Exports current model as PollOption
 */
module.exports = mongoose.model('PollOption', model)
