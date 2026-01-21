# FORGE Program API - Quick Start Guide

## For Frontend Developers

### 1. Generate a Program

```javascript
// In ForgeTab or anywhere you want to generate a program
const generateProgram = async () => {
  try {
    const response = await api.post('/api/programs/generate', {});

    // Response structure:
    // {
    //   success: true,
    //   program: {
    //     _id: "...",
    //     name: "8-Week Powerlifting Peak",
    //     goal: "build-strength",
    //     durationWeeks: 8,
    //     currentWeek: 1,
    //     percentComplete: 12,
    //     weeksRemaining: 7,
    //     periodization: { model: 'block', phases: [...] },
    //     nutritionPlan: { calorieTarget: 2500, macros: {...} },
    //     weeklyTemplates: [{...}],
    //     ...
    //   },
    //   stats: {
    //     calendarEventsCreated: 32,
    //     weeksPlanned: 8,
    //     trainingDaysPerWeek: 4
    //   }
    // }

    console.log(`Program "${response.program.name}" created!`);
    console.log(`Added ${response.stats.calendarEventsCreated} workouts to calendar`);

  } catch (error) {
    console.error('Failed to generate program:', error);
  }
};
```

### 2. Get Current Program

```javascript
// Load user's active program
const loadProgram = async () => {
  try {
    const response = await api.get('/api/programs/active');

    if (response.program) {
      console.log(`Current Program: ${response.program.name}`);
      console.log(`Week ${response.program.currentWeek}/${response.program.durationWeeks}`);
      console.log(`Progress: ${response.program.percentComplete}%`);

      // Access program details
      const { name, goal, startDate, currentPhase } = response.program;
    } else {
      console.log('No active program - suggest user generate one');
    }

  } catch (error) {
    console.error('Failed to load program:', error);
  }
};
```

### 3. Display Program Progress

```javascript
// In your dashboard or program display component
const ProgramDisplay = ({ program }) => {
  return (
    <div>
      <h2>{program.name}</h2>
      <div>Week {program.currentWeek} of {program.durationWeeks}</div>

      {/* Progress bar */}
      <div style={{ width: '100%', height: '8px', background: '#eee' }}>
        <div
          style={{
            width: `${program.percentComplete}%`,
            height: '100%',
            background: '#f97316',
            transition: 'width 0.3s'
          }}
        />
      </div>

      <div>{program.percentComplete}% Complete</div>
      <div>⏰ {program.weeksRemaining} weeks remaining</div>

      {program.periodization?.phases && (
        <div>
          Phase: {program.periodization.phases
            .find(p => program.currentWeek >= p.startWeek && program.currentWeek <= p.endWeek)
            ?.name || 'Unknown'}
        </div>
      )}
    </div>
  );
};
```

### 4. Get Program's Calendar Events

```javascript
// Get all workouts for a specific program
const getProgramWorkouts = async (programId) => {
  try {
    const response = await api.get(`/api/programs/${programId}/calendar`);

    // Response: { success: true, events: [...] }
    // Each event has: _id, title, date, type, weekNumber, periodizationPhase, etc.

    response.events.forEach(event => {
      console.log(`${event.title} - Week ${event.weekNumber} (${event.periodizationPhase})`);
    });

  } catch (error) {
    console.error('Failed to load calendar:', error);
  }
};
```

### 5. Progress Program to Next Week

```javascript
// Manually advance program (cron job does this automatically)
const advanceWeek = async (programId) => {
  try {
    const response = await api.post(`/api/programs/${programId}/progress`, {});

    // Response: { success: true, program: { currentWeek, weeksRemaining, ... } }
    console.log(`Program advanced to Week ${response.program.currentWeek}`);

  } catch (error) {
    console.error('Failed to progress program:', error);
  }
};
```

### 6. Pause/Resume Program

```javascript
// Change program status
const updateProgramStatus = async (programId, newStatus) => {
  try {
    const response = await api.patch(
      `/api/programs/${programId}/status`,
      { status: newStatus }  // 'active' | 'paused' | 'completed'
    );

    console.log(`Program ${response.program.status}`);

  } catch (error) {
    console.error('Failed to update status:', error);
  }
};

// Usage
updateProgramStatus(programId, 'paused');   // Pause
updateProgramStatus(programId, 'active');   // Resume
updateProgramStatus(programId, 'completed'); // Mark complete
```

## For Backend Developers

### 1. Access Program from Database

```javascript
const Program = require('../models/Program');

// Get active program for user
const program = await Program.getActiveForUser(userId);

if (program) {
  console.log(`Active program: ${program.name}`);

  // Get current phase
  const phase = program.calculateCurrentPhase();
  console.log(`Current phase: ${phase.name}`);

  // Get specific week template
  const weekTemplate = program.getWeekTemplate(program.currentWeek);
  console.log(`Training days this week: ${weekTemplate.trainingDays.length}`);
}
```

### 2. Update Program Status

```javascript
const program = await Program.findById(programId);

// Progress to next week
await program.progressToNextWeek();

// Mark as completed
program.status = 'completed';
await program.save();
```

### 3. Generate Calendar Events from Program

```javascript
// This is typically called after program is created
const calendarEvents = await program.generateCalendarEvents();

console.log(`Created ${calendarEvents.length} calendar events`);
```

### 4. Use Program in FORGE Coaching

```javascript
// In aiCoachController.js or similar

const Program = require('../models/Program');

// Check if user has active program
let programContext = '';
const activeProgram = await Program.getActiveForUser(userId);

if (activeProgram) {
  const phase = activeProgram.calculateCurrentPhase();
  programContext = `
User is currently in program: "${activeProgram.name}"
Week ${activeProgram.currentWeek} of ${activeProgram.durationWeeks}
Current Phase: ${phase?.name}
Goal: ${activeProgram.goal}

When coaching, reference their current program and suggest exercises from it.`;
} else {
  programContext = `
User has no active program. Suggest they generate one.`;
}

const prompt = `${FORGE_IDENTITY}
...
${programContext}
...`;
```

### 5. Access Program Details in Code

```javascript
const program = await Program.findById(programId);

// Basic info
console.log(program.name);          // "8-Week Powerlifting Peak"
console.log(program.goal);          // "build-strength"
console.log(program.currentWeek);   // 3
console.log(program.durationWeeks); // 8

// Periodization
program.periodization.phases.forEach(phase => {
  console.log(`${phase.name}: weeks ${phase.startWeek}-${phase.endWeek}`);
  console.log(`  RPE target: ${phase.rpeTarget}`);
  console.log(`  Intensity: ${phase.intensityRange[0]}-${phase.intensityRange[1]}%`);
});

// Weekly templates
program.weeklyTemplates.forEach(week => {
  console.log(`Week ${week.weekNumber}:`);
  week.trainingDays.forEach(day => {
    console.log(`  ${day.dayOfWeek}: ${day.title} (${day.exercises.length} exercises)`);
    day.exercises.forEach(ex => {
      console.log(`    - ${ex.name}: ${ex.sets}x${ex.reps} @ RPE ${ex.rpe}`);
    });
  });
});

// Nutrition
console.log(program.nutritionPlan.calorieTarget);    // 2500
console.log(program.nutritionPlan.macros.protein);   // 200

// Competition (if applicable)
if (program.competitionPrep.competitionDate) {
  console.log(`Competition: ${program.competitionPrep.competitionDate}`);
  console.log(`Weeks out: ${program.competitionPrep.weeksOut}`);
}
```

## Common Patterns

### Pattern 1: Load Program and Display Summary

```javascript
async function loadAndDisplayProgram(userId) {
  const program = await Program.getActiveForUser(userId);

  if (!program) {
    console.log('User should generate a program');
    return null;
  }

  return {
    name: program.name,
    progress: `Week ${program.currentWeek}/${program.durationWeeks}`,
    completion: `${program.percentComplete}%`,
    phase: program.calculateCurrentPhase()?.name,
    weeksLeft: program.weeksRemaining,
    goal: program.goal
  };
}
```

### Pattern 2: Cron Job Progress

```javascript
// In programProgressionJob.js
async function progressAllPrograms() {
  const activePrograms = await Program.find({
    status: 'active',
    currentWeek: { $lt: '$durationWeeks' }
  });

  for (const program of activePrograms) {
    try {
      await program.progressToNextWeek();
      console.log(`✅ Advanced: ${program.name} → Week ${program.currentWeek}`);
    } catch (error) {
      console.error(`❌ Error progressing ${program._id}: ${error.message}`);
    }
  }
}
```

### Pattern 3: Generate Program with Full User Data

```javascript
async function generateProgramForUser(userId) {
  const user = await User.findById(userId);
  const aiCoach = await AICoach.getOrCreateForUser(userId);

  // Gather all data
  const userData = {
    experience: user.experience,
    goals: user.primaryGoal,
    competition: user.competitionPrep,
    preferences: user.exercisePreferences,
    lifestyle: user.lifestyle,
    schedule: user.schedule,
    equipment: user.equipment,
    injuries: user.limitations?.injuries,
    prs: user.personalRecords
  };

  // Build FORGE prompt with all data
  const prompt = buildComprehensivePrompt(userData);

  // Get AI response
  const aiResponse = await aiService.generateAIContent(prompt);
  const programData = JSON.parse(aiResponse.text);

  // Create and save program
  const program = new Program({
    userId,
    ...programData,
    aiGenerated: true,
    aiRationale: 'Generated from user profile analysis'
  });

  await program.save();

  // Update AICoach
  aiCoach.currentProgramId = program._id;
  await aiCoach.save();

  // Propagate to calendar
  await program.generateCalendarEvents();

  return program;
}
```

## Error Handling

```javascript
try {
  const response = await api.get('/api/programs/active');

  if (!response.program) {
    // No active program
    showGeneratePrompt();
  } else {
    // Program exists - use it
    displayProgram(response.program);
  }

} catch (error) {
  if (error.status === 404) {
    console.log('Program not found');
  } else if (error.status === 403) {
    console.log('Subscription required');
  } else {
    console.error('Unknown error:', error);
  }
}
```

## Testing Commands

```bash
# Generate program (POST)
curl -X POST http://localhost:5000/api/programs/generate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{}'

# Get active program (GET)
curl http://localhost:5000/api/programs/active \
  -H "Authorization: Bearer <token>"

# Get calendar events (GET)
curl "http://localhost:5000/api/programs/<programId>/calendar" \
  -H "Authorization: Bearer <token>"

# Progress program (POST)
curl -X POST "http://localhost:5000/api/programs/<programId>/progress" \
  -H "Authorization: Bearer <token>"

# Update status (PATCH)
curl -X PATCH "http://localhost:5000/api/programs/<programId>/status" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "paused"}'
```

## Response Format Examples

### Generate Program Response
```json
{
  "success": true,
  "message": "Program generated successfully",
  "program": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "8-Week Powerlifting Peak",
    "goal": "build-strength",
    "durationWeeks": 8,
    "startDate": "2024-01-15T00:00:00.000Z",
    "currentWeek": 1,
    "status": "active",
    "periodization": {
      "model": "block",
      "phases": [
        {
          "name": "accumulation",
          "startWeek": 1,
          "endWeek": 3,
          "volumeLevel": "high",
          "intensityRange": [65, 75],
          "rpeTarget": 6
        }
      ]
    },
    "percentComplete": 12,
    "weeksRemaining": 7
  },
  "stats": {
    "calendarEventsCreated": 32,
    "weeksPlanned": 8,
    "trainingDaysPerWeek": 4
  }
}
```

### Get Active Program Response
```json
{
  "success": true,
  "program": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "8-Week Powerlifting Peak",
    "goal": "build-strength",
    "status": "active",
    "startDate": "2024-01-15T00:00:00.000Z",
    "currentWeek": 3,
    "durationWeeks": 8,
    "percentComplete": 37,
    "weeksRemaining": 5,
    "periodization": { ... },
    "weeklyTemplates": [ ... ]
  }
}
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Program not generating | Check if user has completed onboarding, verify AI service working |
| Calendar not populated | Verify `generateCalendarEvents()` was called, check CalendarEvent model |
| Cron job not running | Verify `initializeProgramJobs()` called in server.js startup |
| Program stuck at same week | Cron job only runs Monday 00:01, can manually trigger via POST |
| Nutrition not updating | Verify Nutrition.getOrCreateForUser() and check targets field |

## Next Steps

1. Test program generation with real user data
2. Verify calendar propagation works correctly
3. Check nutrition target updates
4. Monitor cron job logs for auto-progression
5. Test user coaching flow with program context
