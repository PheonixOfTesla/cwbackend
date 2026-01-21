// Src/services/aiService.js - Centralized AI Service with Multi-Provider Fallback
// Provides reliable AI generation with automatic failover between free providers

const OpenAI = require('openai');

// Initialize OpenRouter client
const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Multiple free AI providers for fallback
const AI_PROVIDERS = [
  { name: 'Kimi K2', model: 'moonshotai/kimi-k2:free', cost: 0 },
  { name: 'Llama 3.1 8B', model: 'meta-llama/llama-3.1-8b-instruct:free', cost: 0 },
  { name: 'Mistral 7B', model: 'mistralai/mistral-7b-instruct:free', cost: 0 }
];

// Configuration
const AI_TIMEOUT_MS = 30000; // 30 seconds
const MAX_RETRIES_PER_PROVIDER = 2; // 2 retries per provider for faster fallback

/**
 * Generate AI content with automatic multi-provider fallback
 * @param {string} prompt - User prompt
 * @param {string} systemPrompt - System prompt (optional)
 * @param {number} maxTokens - Max tokens (default: 1024)
 * @param {number} providerIndex - Internal: current provider index
 * @param {number} retryCount - Internal: retry count for current provider
 * @returns {Promise<{text: string, source: string}>}
 */
async function generateAIContent(
  prompt,
  systemPrompt = null,
  maxTokens = 1024,
  providerIndex = 0,
  retryCount = 0
) {
  // If we've tried all providers, fail
  if (providerIndex >= AI_PROVIDERS.length) {
    console.error('[AI Service] All AI providers exhausted');
    throw new Error('AI service temporarily unavailable - all providers are rate limited. Please try again in a few minutes.');
  }

  const provider = AI_PROVIDERS[providerIndex];

  try {
    // Log which provider we're using
    if (retryCount === 0) {
      console.log(`[AI Service] Attempting ${provider.name} (${provider.model})`);
    }

    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('AI_TIMEOUT')), AI_TIMEOUT_MS);
    });

    // Build messages array
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    // Race between API call and timeout
    const completion = await Promise.race([
      openai.chat.completions.create({
        model: provider.model,
        max_tokens: maxTokens,
        messages: messages
      }),
      timeoutPromise
    ]);

    console.log(`[AI Service] ✓ Success with ${provider.name} (FREE)`);
    return {
      text: completion.choices[0].message.content,
      source: provider.name.toLowerCase().replace(/\s+/g, '-')
    };
  } catch (error) {
    // Handle timeout
    if (error.message === 'AI_TIMEOUT') {
      console.error(`[AI Service] ${provider.name} timeout after 30s`);
      // Try next provider on timeout
      return generateAIContent(prompt, systemPrompt, maxTokens, providerIndex + 1, 0);
    }

    // Handle rate limiting (429)
    if (error.status === 429) {
      // Retry with exponential backoff
      if (retryCount < MAX_RETRIES_PER_PROVIDER) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s
        console.log(`[AI Service] ${provider.name} rate limited (429). Retry ${retryCount + 1}/${MAX_RETRIES_PER_PROVIDER} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return generateAIContent(prompt, systemPrompt, maxTokens, providerIndex, retryCount + 1);
      } else {
        // All retries exhausted for this provider, try next
        console.log(`[AI Service] ${provider.name} rate limit exhausted. Trying next provider...`);
        return generateAIContent(prompt, systemPrompt, maxTokens, providerIndex + 1, 0);
      }
    }

    // Handle other errors - try next provider
    console.error(`[AI Service] ${provider.name} error:`, error.status || error.message);
    if (providerIndex < AI_PROVIDERS.length - 1) {
      console.log(`[AI Service] Trying next provider...`);
      return generateAIContent(prompt, systemPrompt, maxTokens, providerIndex + 1, 0);
    } else {
      throw new Error('AI service temporarily unavailable - please try again');
    }
  }
}

module.exports = {
  generateAIContent,
  AI_PROVIDERS
};
