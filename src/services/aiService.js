// Src/services/aiService.js - Bulletproof AI Service
// Priority: Kimi K2 (free, 32k) → Ollama (local) → Llama → Fallback

const OpenAI = require('openai');

// ═══════════════════════════════════════════════════════════
// PROVIDER CONFIGURATION
// ═══════════════════════════════════════════════════════════

// OpenRouter client (Kimi K2 FREE + Llama backup)
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || 'dummy'
});

// Ollama client (local fallback)
const ollama = new OpenAI({
  baseURL: process.env.OLLAMA_URL || 'http://localhost:11434/v1',
  apiKey: 'ollama'
});

// Provider chain - Kimi K2 FREE first (32k context, $0), then fallbacks
const AI_PROVIDERS = [
  {
    name: 'Kimi K2 Free',
    model: 'moonshotai/kimi-k2:free',  // FREE: $0/1M tokens, 32k context
    client: openrouter,
    timeout: 90000,   // 90s - it's powerful but can be slow
    isLocal: false,
    isFree: true
  },
  {
    name: 'Ollama Local',
    model: process.env.OLLAMA_MODEL || 'llama3.2',
    client: ollama,
    timeout: 60000,
    isLocal: true,
    isFree: true
  },
  {
    name: 'Llama 3.3 70B',
    model: 'meta-llama/llama-3.3-70b-instruct',
    client: openrouter,
    timeout: 120000,
    isLocal: false,
    isFree: false  // Uses OpenRouter credits
  },
  {
    name: 'Llama 3.1 8B',
    model: 'meta-llama/llama-3.1-8b-instruct',
    client: openrouter,
    timeout: 60000,
    isLocal: false,
    isFree: false
  }
];

// ═══════════════════════════════════════════════════════════
// MAIN FUNCTION - NEVER FAILS
// ═══════════════════════════════════════════════════════════

/**
 * Generate AI content with bulletproof fallback chain
 * Ollama → OpenRouter → Static fallback
 *
 * @param {string} prompt - User prompt
 * @param {string} systemPrompt - System prompt (optional)
 * @param {number} maxTokens - Max tokens (default: 2048)
 * @returns {Promise<{text: string, source: string, fallback: boolean}>}
 */
async function generateAIContent(prompt, systemPrompt = null, maxTokens = 2048) {

  // Try each provider in order
  for (let i = 0; i < AI_PROVIDERS.length; i++) {
    const provider = AI_PROVIDERS[i];

    // Skip OpenRouter if no API key
    if (!provider.isLocal && !process.env.OPENROUTER_API_KEY) {
      console.log(`[AI Service] Skipping ${provider.name} - no API key`);
      continue;
    }

    try {
      console.log(`[AI Service] Trying ${provider.name}...`);

      const result = await callProvider(provider, prompt, systemPrompt, maxTokens);

      console.log(`[AI Service] ✓ Success with ${provider.name}`);
      return {
        text: result,
        source: provider.name.toLowerCase().replace(/\s+/g, '-'),
        fallback: false
      };

    } catch (error) {
      console.error(`[AI Service] ${provider.name} failed:`, error.message);
      // Continue to next provider
    }
  }

  // ALL PROVIDERS FAILED - Return fallback response
  console.warn('[AI Service] All providers failed - using static fallback');
  return {
    text: getFallbackResponse(prompt),
    source: 'static-fallback',
    fallback: true
  };
}

/**
 * Call a single provider with timeout
 */
async function callProvider(provider, prompt, systemPrompt, maxTokens) {
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  // Create timeout promise
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout after ${provider.timeout}ms`)), provider.timeout);
  });

  // Race between API call and timeout
  const completion = await Promise.race([
    provider.client.chat.completions.create({
      model: provider.model,
      max_tokens: maxTokens,
      messages: messages,
      temperature: 0.7
    }),
    timeoutPromise
  ]);

  return completion.choices[0].message.content;
}

// ═══════════════════════════════════════════════════════════
// FALLBACK RESPONSES - WHEN ALL AI FAILS
// ═══════════════════════════════════════════════════════════

function getFallbackResponse(prompt) {
  const promptLower = prompt.toLowerCase();

  // Detect if this is a program generation request
  if (promptLower.includes('program') || promptLower.includes('workout') || promptLower.includes('json')) {
    return JSON.stringify(getFallbackProgram(), null, 2);
  }

  // Detect if this is a chat/advice request
  if (promptLower.includes('sore') || promptLower.includes('recovery')) {
    return "Rest is part of the process. If you're feeling sore, focus on light mobility work, hydration, and sleep. Tomorrow's another day to push.";
  }

  if (promptLower.includes('nutrition') || promptLower.includes('eat') || promptLower.includes('diet')) {
    return "Keep it simple: protein at every meal, plenty of vegetables, and enough calories to support your training. Don't overcomplicate it.";
  }

  // Default coaching response
  return "I'm here to help you train smarter. What's on your mind - workouts, nutrition, or recovery? Let's figure it out together.";
}

/**
 * Fallback program structure when AI completely fails
 * This ensures the user ALWAYS gets something
 */
function getFallbackProgram() {
  return {
    name: "ClockWork Foundation Program",
    durationWeeks: 8,
    periodization: {
      model: "linear",
      phases: [
        { name: "accumulation", weeks: [1, 2, 3, 4] },
        { name: "intensity", weeks: [5, 6, 7] },
        { name: "deload", weeks: [8] }
      ]
    },
    nutritionPlan: {
      calorieTarget: 2500,
      macros: { protein: 180, carbs: 280, fat: 80 },
      mealPlan: {
        breakfast: { name: "Power Breakfast", foods: ["Eggs", "Oatmeal", "Banana"], calories: 500 },
        snack1: { name: "Mid-Morning Fuel", foods: ["Greek Yogurt", "Almonds"], calories: 300 },
        lunch: { name: "Balanced Lunch", foods: ["Chicken Breast", "Rice", "Vegetables"], calories: 600 },
        snack2: { name: "Pre-Workout", foods: ["Protein Shake", "Apple"], calories: 350 },
        dinner: { name: "Recovery Dinner", foods: ["Salmon", "Sweet Potato", "Broccoli"], calories: 650 }
      }
    },
    habitPlan: [
      { name: "Drink 100oz Water", frequency: "daily", trackingType: "boolean" },
      { name: "8 Hours Sleep", frequency: "daily", trackingType: "quantity", targetValue: 8 },
      { name: "10K Steps", frequency: "daily", trackingType: "quantity", targetValue: 10000 },
      { name: "Morning Mobility", frequency: "daily", trackingType: "boolean" }
    ],
    weeklyTemplates: generateFallbackWeeklyTemplates()
  };
}

function generateFallbackWeeklyTemplates() {
  const templates = [];

  // Upper/Lower split for 4 days
  const upperDay = {
    exercises: [
      { name: "Barbell Bench Press", category: "main-lift", sets: 4, reps: "6-8", rpe: 8 },
      { name: "Barbell Row", category: "main-lift", sets: 4, reps: "6-8", rpe: 8 },
      { name: "Overhead Press", category: "accessory", sets: 3, reps: "8-10", rpe: 7 },
      { name: "Lat Pulldown", category: "accessory", sets: 3, reps: "10-12", rpe: 7 },
      { name: "Dumbbell Curl", category: "accessory", sets: 3, reps: "12-15", rpe: 7 },
      { name: "Tricep Pushdown", category: "accessory", sets: 3, reps: "12-15", rpe: 7 }
    ]
  };

  const lowerDay = {
    exercises: [
      { name: "Barbell Squat", category: "main-lift", sets: 4, reps: "5-6", rpe: 8 },
      { name: "Romanian Deadlift", category: "main-lift", sets: 4, reps: "8-10", rpe: 7 },
      { name: "Leg Press", category: "accessory", sets: 3, reps: "10-12", rpe: 7 },
      { name: "Leg Curl", category: "accessory", sets: 3, reps: "12-15", rpe: 7 },
      { name: "Calf Raise", category: "accessory", sets: 4, reps: "15-20", rpe: 7 },
      { name: "Plank", category: "cooldown", sets: 3, reps: "60 sec", rpe: 6 }
    ]
  };

  for (let week = 1; week <= 8; week++) {
    const isDeload = week === 4 || week === 8;
    const rpeModifier = isDeload ? -2 : 0;

    templates.push({
      weekNumber: week,
      deloadWeek: isDeload,
      trainingDays: [
        { dayOfWeek: "monday", focus: "Upper Body", ...upperDay },
        { dayOfWeek: "tuesday", focus: "Lower Body", ...lowerDay },
        { dayOfWeek: "thursday", focus: "Upper Body", ...upperDay },
        { dayOfWeek: "friday", focus: "Lower Body", ...lowerDay }
      ],
      restDays: ["wednesday", "saturday", "sunday"]
    });
  }

  return templates;
}

// ═══════════════════════════════════════════════════════════
// SIMPLE CHAT FUNCTION - For quick responses
// ═══════════════════════════════════════════════════════════

/**
 * Quick chat response - smaller token limit, faster
 */
async function quickChat(prompt, systemPrompt = null) {
  return generateAIContent(prompt, systemPrompt, 512);
}

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════

module.exports = {
  generateAIContent,
  quickChat,
  getFallbackProgram,
  AI_PROVIDERS
};
