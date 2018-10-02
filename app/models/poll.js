/**
 * Тут комментируй
 */

const mongoose = require('mongoose')
const { extend, isArray } = require('lodash')

const { is } = require('./utils')
const ObjectID = require('mongodb').ObjectID
const ObjectId = mongoose.Schema.Types.ObjectId

const targetModels = [ 'Post' ]

/**
 * Model for particular poll
 * @type {mongoose}
 */
const model = new mongoose.Schema(extend({
  userId: { type: Number, required: true }, // в реальном проекте тут – ссылка на модель Users. Чтобы ты смог тут что-то пробовать – заменил на числовое поле
  //
  votes: 0, // счетчик голосов
  //
  title: { type: String, required: true }, // название опроса
  multi: { type: Boolean, default: false }, // флаг, сообщающий о том, что в опросе может выбрано несколько вариантов ответа
  //
  target: { // привязка опроса к какой-либо внещней сущности, в данном случае – к постам
    model: { type: String, enum: targetModels },
    item: { type: Number } // тут тоже облегчил – убрал связь с сторонними моделями
  },
  available: true
}, is))

model.index({ 'userId': 1 })
model.index({ 'target.item': 1 })

/**
 * Virtual options field
 * @type {String}
 */
model.virtual('options', {
  ref: 'PostPollOption',
  localField: '_id',
  foreignField: 'pollId'
})

model.statics.PollOption = require('./option')

/**
 * Create new poll with following params
 * @param  {[Number]}  userId        [ID of the creator]
 * @param  {Object}  [target={}]   [Attach poll to specific target]
 * @param  {Array}   [options=[]]  [Options that are available in the poll]
 * @param  {[String]}  title         [Title of the poll]
 * @param  {Boolean} [multi=false] [Poll can have multiple choice answers. default: false]
 * @return {[model]}                [Return the poll itself]
 */
model.statics.makePoll = async function (userId, target = {}, options = [], title, multi = false) {
  const model = this
  if (!target.model || !target.item) throw new Error('no target specified')
  if (!options.length) throw new Error('no poll options specified')
  if (!title) throw new Error('no title specified')

  let poll = await model.create({ target, userId, title, multi })
  await poll.setOptions(options)
  return poll
}

/**
 * Add required options to the poll
 * @param  {[Array]} options [Options to be addded to the poll]
 * @return {[Promise]}         [Promise to create the options passed via params]
 */
model.methods.setOptions = function (options) {
  const poll = this

  return Promise.all(options.map(option => (
    mongoose.models.PollOption.create({ pollId: poll._id, value: option })
  )))
}

/**
 * Handle the voting procedure
 * @param  {[Number]} userId    [User that voted for particulat option]
 * @param  {Array}  [data=[]] [Data to be updated in the database]
 * @return {[WriteResult]}           [Updating the database with vote]
 */
model.methods.vote = function (userId, data = []) {
  const poll = this

  return mongoose.models.PollOption.update(
    {
      _id: { $in: data.map(el => ObjectID(el)) },
      pollId: poll._id
    },
    { $addToSet: { votes: userId } },
    { multi: true }
  )
}

/**
 * Function to edit options in the poll if they are not already there
 * @param  {Array}  [options=[]] [Options to be added]
 * @return {[type]}              [description]
 */
model.methods.editOptions = async function (options = []) {
  const poll = this

  let missed = []
  let pollOptions = await Promise.all(options.map(async option => {
    let [ pollOption ] = await mongoose.models.PollOption.find({ pollId: poll._id, value: option }).select('_id value').limit(1)
    if (pollOption) return pollOption
    missed.push(option)
    return null
  }))

  await mongoose.models.PollOption.update(
    {
      pollId: poll._id,
      _id: { $nin: pollOptions.filter(el => !!el).map(el => el._id) }
    },
    { enabled: false },
    { multi: true }
  )

  return poll.setOptions(missed)
}

/**
 * Get the poll info from the database
 * @param  {Object} [params={}]  [Match the model with this params]
 * @param  {Object} [options={}] [Get the userId to check if vote was register for this user]
 * @return {[model]}              [Return all the asked information]
 */
model.statics.getPollInfo = function (params = {}, options = {}) {
  const model = this

  return model.aggregate([
    { $match: params },
    { $lookup: {
      from: 'polloptions',
      localField: '_id',
      foreignField: 'pollId',
      as: 'options'
    }},
    { $unwind: '$options' },
    { $match: {
      'options.enabled': true
    }},
    { $project: {
      _id: 1,
      title: 1,
      multi: 1,
      target: 1,
      options: {
        _id: 1,
        value: '$options.value',
        votes: { $size: '$options.votes' },
        isVoted: { $in: [ options.userId ? options.userId : null, '$options.votes' ] }
      }
    }},
    { $group: {
      _id: {
        _id: '$_id',
        title: '$title',
        multi: '$multi',
        target: '$target'
      },
      options: { $push: '$options' },
      votes: { $sum: '$options.votes' },
      isVoted: { $push: '$options.isVoted' }
    }},
    { $project: {
      _id: '$_id._id',
      title: '$_id.title',
      multi: '$_id.multi',
      target: '$_id.target',
      isVoted: { $in: [ true, '$isVoted' ] },
      votes: 1,
      options: 1
    }}
  ])
}

/**
 * Get all polls for specific user
 * @param  {Object} [params={}] [userId is passed as a parameter to match]
 * @return {[type]}             [All polls with votes and options]
 */
model.statics.getUserPoll = async function (params = {}) {
  const model = this
  return model.aggregate([
    { $match: {
      userId: params.userId
    }},
    { $lookup: {
      from: 'polloptions',
      localField: '_id',
      foreignField: 'pollId',
      as: 'options'
    }},
    { $project: {
      title: 1,
      multi: 1,
      target: 1,
      options: 1,
      userId: 1,
      available: 1,
    }}
  ])
}

model.statics.closeAndGetResult = async function (params = {}) {
  const model = this

  return model.update(
    {
      _id: params._id
    },
    { $set: {
      available: false
    }}
  )
}

model.statics.getPostPolls = async function (params = {}) {
  const model = this
  let match = {
    'target.model': 'Post',
    enabled: true
  }

  if (params.postId) match['target.item'] = { $in: isArray(params.postId) ? params.postId : [ params.postId ] }

  let data = await model.getPollInfo(match, { userId: params.userId })

  return data.reduce((obj, item) => {
    obj[item.target.item] = item
    return obj
  }, {})
}

module.exports = mongoose.model('Poll', model)
