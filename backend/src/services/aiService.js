'use strict';

const config = require('../config');
const logger = require('../utils/logger');
const { AiConversation } = require('./aiStore');
const intentNlu = require('./ai/intent');
const contextBuilder = require('./ai/contextBuilder');
const localProvider = require('./ai/providers/localProvider');
const llmProvider = require('./ai/providers/llmProvider');

/**
 * AI Event Assistant.
 *
 * Pipeline: intent detection → database grounding → provider answer.
 * Providers are swappable (see ./ai/providers) and the default `local` provider
 * needs no API key; external keys are only ever read on the server.
 */
const answer = async ({ user, message, expoId = null, history = [] }) => {
  const { intent, entities } = intentNlu.detectIntent(message);

  let grounded;
  try {
    grounded = await contextBuilder.build({ intent, entities, user, expoId });
  } catch (error) {
    logger.error('AI context building failed:', error.message);
    grounded = { context: { error: 'context unavailable' }, sources: [], expo: null, meta: { intent, entities } };
  }

  let response;
  try {
    response =
      config.ai.provider === 'local'
        ? await localProvider.answer({ message, intent, context: grounded })
        : await llmProvider.answer({ message, intent, context: grounded, history });
  } catch (error) {
    logger.error('AI provider failed entirely:', error.message);
    response = { answer: 'I could not reach the assistant service. Please try again in a moment.', provider: 'error' };
  }

  const result = {
    answer: response.answer,
    provider: response.provider,
    intent,
    sources: grounded.sources || [],
    suggestions: contextBuilder.suggestionsFor(intent),
    expoId: grounded.expo?._id || null,
    contextSummary: {
      intent,
      items: grounded.meta?.contextItems || 0,
      truncated: Boolean(grounded.meta?.truncated),
    },
  };

  if (user) {
    const conversation = await AiConversation.append({ userId: user._id, expoId: grounded.expo?._id || null, message, result });
    result.conversationId = conversation._id;
  }

  return result;
};

const history = async (user, limit = 30) => {
  const conversation = await AiConversation.latest(user._id);
  if (!conversation) return { conversationId: null, messages: [] };
  const entries = conversation.messages.slice(-limit).flatMap((entry) => [
    { role: 'user', content: entry.question, at: entry.at },
    { role: 'assistant', content: entry.answer, at: entry.at, sources: entry.sources },
  ]);
  return { conversationId: conversation._id, messages: entries };
};

const clearHistory = async (user) => AiConversation.clear(user._id);

const capabilities = () => ({
  provider: config.ai.provider,
  model:
    config.ai.provider === 'openai'
      ? config.ai.openaiModel
      : config.ai.provider === 'anthropic'
        ? config.ai.anthropicModel
        : 'database-grounded rules engine',
  groundedInDatabase: true,
  examples: [
    'What sessions are available today?',
    'Where is booth B-12?',
    'Which exhibitors sell electronics?',
    'When does the keynote start?',
    'Show me workshops available tomorrow.',
    'What is the location of ABC Technologies?',
  ],
});

module.exports = { answer, history, clearHistory, capabilities };
