'use strict';

const config = require('../../../config');
const logger = require('../../../utils/logger');
const localProvider = require('./localProvider');

/**
 * Optional LLM providers (OpenAI / Anthropic). They receive the same
 * database-derived context as the local provider, so the model can only
 * phrase facts it was given. Keys stay on the server — never in the client.
 */

const SYSTEM_PROMPT = `You are the EventSphere Event Assistant, embedded in an expo management platform.
Answer ONLY from the CONTEXT JSON provided. If the answer is not in the context, say what is missing and suggest a related question.
Be concise (max 120 words), use plain language, and mention booth numbers, times and room names exactly as given.
Never invent exhibitors, sessions or prices.`;

const buildMessages = ({ message, contextData, history = [] }) => {
  const contextBlock = `CONTEXT (live application data):\n${JSON.stringify(contextData, null, 0).slice(0, 14000)}`;
  const trimmedHistory = history
    .filter((entry) => entry && entry.content)
    .slice(-6)
    .map((entry) => `${entry.role === 'assistant' ? 'Assistant' : 'User'}: ${entry.content}`);

  return {
    system: `${SYSTEM_PROMPT}\n\n${contextBlock}`,
    user: [...trimmedHistory, `User: ${message}`].join('\n'),
  };
};

const withTimeout = async (promise, ms = 20000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await promise(controller.signal);
  } finally {
    clearTimeout(timer);
  }
};

const openaiAnswer = async ({ message, contextData, history }) => {
  const messages = buildMessages({ message, contextData, history });
  const response = await withTimeout((signal) =>
    fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.ai.openaiKey}` },
      body: JSON.stringify({
        model: config.ai.openaiModel,
        temperature: 0.2,
        max_tokens: 400,
        messages: [
          { role: 'system', content: messages.system },
          { role: 'user', content: messages.user },
        ],
      }),
    }),
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`OpenAI request failed (${response.status}) ${detail.slice(0, 200)}`);
  }
  const data = await response.json();
  const answer = data.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error('OpenAI returned an empty answer');
  return { answer, provider: 'openai' };
};

const anthropicAnswer = async ({ message, contextData, history }) => {
  const messages = buildMessages({ message, contextData, history });
  const response = await withTimeout((signal) =>
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.ai.anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.ai.anthropicModel,
        max_tokens: 400,
        system: messages.system,
        messages: [{ role: 'user', content: messages.user }],
      }),
    }),
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Anthropic request failed (${response.status}) ${detail.slice(0, 200)}`);
  }
  const data = await response.json();
  const answer = data.content?.map((part) => part.text).filter(Boolean).join('\n').trim();
  if (!answer) throw new Error('Anthropic returned an empty answer');
  return { answer, provider: 'anthropic' };
};

/** Try the configured LLM, fall back to the local provider on any failure. */
const answer = async ({ message, intent, context, history = [] }) => {
  const provider = config.ai.provider;
  const contextData = context.context;

  try {
    if (provider === 'openai' && config.ai.openaiKey) {
      return await openaiAnswer({ message, contextData, history });
    }
    if (provider === 'anthropic' && config.ai.anthropicKey) {
      return await anthropicAnswer({ message, contextData, history });
    }
  } catch (error) {
    logger.warn(`AI provider "${provider}" failed, falling back to local answers: ${error.message}`);
  }

  return localProvider.answer({ intent, context });
};

module.exports = { name: 'llm', answer, buildMessages };
