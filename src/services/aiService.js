// Src/services/aiService.js - Bulletproof AI Service
// Priority: Claude Haiku (fast, reliable) → DeepSeek V3 (cheap backup)

const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');

// ═══════════════════════════════════════════════════════════
// PROVIDER CONFIGURATION
// ═══════════════════════════════════════════════════════════

// Anthropic client (Claude Haiku - PRIMARY)
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// OpenRouter client (DeepSeek fallback)
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || 'dummy'
});

// Provider chain - Claude Haiku first (fast, reliable), DeepSeek as backup
const AI_PROVIDERS = [
  {
    name: 'Claude Haiku',
    model: 'claude-3-5-haiku-latest',  // $0.25/1M input, $1.25/1M output - fast & reliable
    client: anthropic,
    timeout: 30000,
    isLocal: false,
    isAnthropic: true
  },
  {
    name: 'DeepSeek V3',
    model: 'deepseek/deepseek-chat',  // $0.27/1M - cheap backup via OpenRouter
    client: openrouter,
    timeout: 30000,
    isLocal: false,
    isAnthropic: false
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

    // Skip if no API key for this provider
    if (provider.isAnthropic && !process.env.ANTHROPIC_API_KEY) {
      console.log(`[AI Service] Skipping ${provider.name} - no ANTHROPIC_API_KEY`);
      continue;
    }
    if (!provider.isAnthropic && !provider.isLocal && !process.env.OPENROUTER_API_KEY) {
      console.log(`[AI Service] Skipping ${provider.name} - no OPENROUTER_API_KEY`);
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
 * Call a single provider with timeout and proper headers
 */
async function callProvider(provider, prompt, systemPrompt, maxTokens) {
  // Create timeout promise
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Timeout after ${provider.timeout}ms`)), provider.timeout);
  });

  // Handle Anthropic API (different format)
  if (provider.isAnthropic) {
    const requestOptions = {
      model: provider.model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    };

    if (systemPrompt) {
      requestOptions.system = systemPrompt;
    }

    const completion = await Promise.race([
      provider.client.messages.create(requestOptions),
      timeoutPromise
    ]);

    return completion.content[0].text;
  }

  // Handle OpenAI-compatible API (OpenRouter/DeepSeek)
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const requestOptions = {
    model: provider.model,
    max_tokens: maxTokens,
    messages: messages,
    temperature: 0.7,
    extra_headers: {
      'HTTP-Referer': 'https://clockwork.fit',
      'X-Title': 'ClockWork Fitness'
    }
  };

  const completion = await Promise.race([
    provider.client.chat.completions.create(requestOptions),
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

  // Upper/Lower split for 4 days - with warmups, primaries, accessories
  const upperDay = {
    exercises: [
      // Warmups
      { name: "Arm Circles", category: "warmup", sets: 2, reps: "10 each direction", notes: "Small to large circles" },
      { name: "Band Pull-Aparts", category: "warmup", sets: 2, reps: "15", notes: "Activate rear delts" },
      { name: "Push-up Plus", category: "warmup", sets: 2, reps: "10", notes: "Protract shoulders at top" },
      // Primary
      { name: "Barbell Bench Press", category: "main-lift", sets: 4, reps: "6-8", rpe: 8, rest: "3-4 min", notes: "Control the eccentric" },
      { name: "Barbell Row", category: "main-lift", sets: 4, reps: "6-8", rpe: 8, rest: "3-4 min", notes: "Pull to lower chest" },
      // Accessories
      { name: "Overhead Press", category: "accessory", sets: 3, reps: "8-10", rpe: 7, rest: "90 sec" },
      { name: "Lat Pulldown", category: "accessory", sets: 3, reps: "10-12", rpe: 7, rest: "90 sec" },
      { name: "Dumbbell Curl", category: "accessory", sets: 3, reps: "12-15", rpe: 7, rest: "60 sec" },
      { name: "Tricep Pushdown", category: "accessory", sets: 3, reps: "12-15", rpe: 7, rest: "60 sec" }
    ]
  };

  const lowerDay = {
    exercises: [
      // Warmups
      { name: "Leg Swings", category: "warmup", sets: 2, reps: "10 each leg", notes: "Front-to-back and side-to-side" },
      { name: "Bodyweight Squats", category: "warmup", sets: 2, reps: "10", notes: "Slow and controlled" },
      { name: "Hip Circles", category: "warmup", sets: 2, reps: "10 each direction", notes: "Open up the hips" },
      // Primary
      { name: "Barbell Squat", category: "main-lift", sets: 4, reps: "5-6", rpe: 8, rest: "3-4 min", notes: "Hit depth, drive through heels" },
      { name: "Romanian Deadlift", category: "main-lift", sets: 4, reps: "8-10", rpe: 7, rest: "3-4 min", notes: "Feel the hamstring stretch" },
      // Accessories
      { name: "Leg Press", category: "accessory", sets: 3, reps: "10-12", rpe: 7, rest: "90 sec" },
      { name: "Leg Curl", category: "accessory", sets: 3, reps: "12-15", rpe: 7, rest: "60 sec" },
      { name: "Calf Raise", category: "accessory", sets: 4, reps: "15-20", rpe: 7, rest: "60 sec" },
      { name: "Plank", category: "accessory", sets: 3, reps: "60 sec", rpe: 6 }
    ]
  };

  for (let week = 1; week <= 8; week++) {
    const isDeload = week === 4 || week === 8;

    templates.push({
      weekNumber: week,
      deloadWeek: isDeload,
      trainingDays: [
        { dayOfWeek: "monday", focus: "Upper Power", ...upperDay },
        { dayOfWeek: "tuesday", focus: "Lower Power", ...lowerDay },
        { dayOfWeek: "thursday", focus: "Upper Hypertrophy", ...upperDay },
        { dayOfWeek: "friday", focus: "Lower Hypertrophy", ...lowerDay }
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
