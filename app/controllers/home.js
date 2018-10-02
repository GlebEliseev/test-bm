'use strict';

const { models } = require('mongoose')
const ObjectID = require('mongodb').ObjectID

const pkginfo = require('../../package.json');
const spec = require('../spec');

exports.getPoll = async ctx => {
  const { pollId, userId } = ctx.query
  const result = {}

  try {
    result.poll = await models.Poll.getPollInfo({ _id: ObjectID(pollId) }, { userId: Number(userId) })
  } catch (e) {
    console.log(e)
  }

  ctx.res.ok(result, 'poll')
};

exports.makePoll = async ctx => {
  const { userId, postId, options, title } = ctx.request.body
  const result = {}

  try {
    result.poll = await models.Poll.makePoll(userId, { model: 'Post', item: postId }, options, title)
  } catch (e) {
    console.log(e)
  }

  ctx.res.ok(result, 'poll created')
}

exports.vote = async ctx => {
  const { pollId } = ctx.params
  const { userId, idArray = [] } = ctx.request.body
  const result = {}

  try {
    const [ poll ] = await models.Poll.find({ _id: ObjectID(pollId) }, {available: true})
    if (!poll) throw new Error('no poll found or it has finished')

    result.result = await poll.vote(userId, idArray)
  } catch (e) {
    console.log(e)
  }

  ctx.res.ok(result, !result.result ? 'something went wrong' : 'voted')
}

/**
 * Get all polls for specific user
 */
exports.getUserPoll = async ctx => {
  const { userId } = ctx.query
  const result = {}

  try {
    result.poll = await models.Poll.getUserPoll({userId: Number(userId)})
  } catch (e) {
    console.log(e);
  }
  ctx.res.ok(result, 'user poll')
}

/**
 * Close specified poll
 * @param  {[type]}  ctx [description]
 * @return {Promise}     [description]
 */
exports.closePoll = async ctx => {
  const { pollId } = ctx.query
  const result = {}

  try {
    result.poll = await models.Poll.closeAndGetResult({ _id: ObjectID(pollId) })

  } catch (e) {
    console.log(e);
  }
  ctx.res.ok(result, 'closed poll')

}
