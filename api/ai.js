export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const openaiKey = process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    return res.status(500).json({ error: 'Backend API keys not configured' });
  }

  const { nutrition, userGoals, type = 'guidance' } = req.body;

  if (!nutrition || !userGoals) {
    return res.status(400).json({ error: 'Provide nutrition and userGoals' });
  }

  try {
    let prompt = '';

    if (type === 'guidance') {
      prompt = `You are a certified nutrition expert. Based on this meal and the user's goals, provide brief, actionable nutrition guidance.

Food: ${nutrition.name || 'Unknown food'}
Nutrition per serving:
- Calories: ${nutrition.calories || 0}
- Protein: ${nutrition.protein || 0}g
- Carbs: ${nutrition.carbohydrates || 0}g
- Fat: ${nutrition.fat || 0}g

User Profile:
- Age: ${userGoals.age || 'Unknown'}
- Goal: ${userGoals.goal || 'General health'}
- Activity Level: ${userGoals.activityLevel || 'Unknown'}
- Daily Calorie Target: ${userGoals.dailyCalories || 'Unknown'}
- Protein Target: ${userGoals.dailyProtein || 'Unknown'}g

Provide 2-3 sentences of plain text guidance (no markdown, no bullet points). Be supportive and practical.`;
    } else if (type === 'recipe') {
      prompt = `You are a creative chef. Generate a simple, healthy recipe using common ingredients.

User Goals:
- Calories per serving: ${userGoals.caloriesPerServing || 400}
- Protein: ${userGoals.proteinPerServing || 25}g
- Carbs: ${userGoals.carbsPerServing || 40}g
- Fat: ${userGoals.fatPerServing || 10}g

Provide a recipe in plain text (no markdown). Include: ingredient list, prep time, cooking instructions, and nutritional breakdown.`;
    } else if (type === 'analysis') {
      prompt = `Analyze this meal and provide a quick assessment.
    } else if (type === 'macro_recommendation') {
      prompt = `You are an expert nutritionist and fitness coach. Generate personalized daily calorie and macro (protein, carbs, fat) recommendations based on the user's profile and goals.

User Profile:
- Age: ${nutrition.age}
- Gender: ${nutrition.gender}
- Weight: ${nutrition.weight_lbs} lbs
- Height: ${nutrition.height_feet}'${nutrition.height_inches || 0}"
- Activity Level: ${nutrition.activity_level}

Goals & Preferences:
- Health Goals: ${userGoals.goals?.join(', ') || 'General health'}
- Diet Preference: ${userGoals.diet_preference || 'No preference'}
- Preferred Exercises: ${userGoals.preferred_exercises || 'Not specified'}

Based on this information, calculate realistic, sustainable daily targets. Consider:
1. BMR and TDEE based on the user's physical profile
2. Their specific goals (weight loss should have moderate deficit, muscle gain should have modest surplus)
3. Activity level
4. The macro ratios should support their goals (higher protein for muscle building or weight loss)

Return ONLY valid JSON (no markdown, no code blocks):
{
  "calories": daily_calorie_target,
  "protein": daily_protein_grams,
  "carbs": daily_carbs_grams,
  "fat": daily_fat_grams
}

Make sure the macros add up correctly (protein*4 + carbs*4 + fat*9 should roughly equal calories).`;
    } else {
      return res.status(400).json({ error: 'Invalid type. Use: guidance, recipe, analysis, meal_estimate, food_analysis, or macro_recommendation' });

Nutrition:
- Calories: ${nutrition.calories || 0}
- Protein: ${nutrition.protein || 0}g
- Carbs: ${nutrition.carbohydrates || 0}g
- Fat: ${nutrition.fat || 0}g

User's daily goal: ${userGoals.dailyCalories || 'Unknown'} calories, ${userGoals.dailyProtein || 'Unknown'}g protein

Provide 2-3 sentences of plain text analysis. Be encouraging and practical (no markdown).`;
    } else if (type === 'meal_estimate') {
      prompt = `You are a nutrition expert with access to a comprehensive food database. The user ate this meal:

"${nutrition.description || 'Unknown meal'}"

Based on typical serving sizes and your nutrition knowledge, estimate the total nutrition for this ENTIRE meal as described. Consider:
1. Typical portion sizes people eat
2. All foods mentioned (even if vague like "a sandwich" - estimate what's in it)
3. Cooking methods implied
4. Condiments and extras typically included

Return ONLY valid JSON (no markdown, no code blocks):
{
  "description": "brief summary of the meal",
  "totalCalories": total_calories_for_entire_meal,
  "totalProtein": total_protein_grams,
  "totalCarbs": total_carbs_grams,
  "totalFat": total_fat_grams,
  "servings": 1
}

The nutrition values should be for the ENTIRE meal as described, not per serving.`;
    } else if (type === 'food_analysis') {
      prompt = `You are a practical, realistic nutrition coach. Analyze this food for the user and provide personalized guidance.

Food:
- Name: ${nutrition.name || 'Unknown'}
- Brand: ${nutrition.brand || 'Unknown'}
- Serving: ${nutrition.servingSize || 'Unknown'}
- Calories: ${nutrition.calories || 'Unknown'}
- Protein: ${nutrition.protein || 'Unknown'}g
- Carbs: ${nutrition.carbohydrates || 'Unknown'}g
- Fat: ${nutrition.fat || 'Unknown'}g
- Sugar: ${nutrition.sugar || 'Unknown'}g
- Fiber: ${nutrition.fiber || 'Unknown'}g

User Profile:
- Age: ${userGoals.age || 'Unknown'}
- Goal: ${userGoals.goal || 'General health'}
- Daily Calories: ${userGoals.dailyCalories || 'Unknown'}
- Daily Protein: ${userGoals.dailyProtein || 'Unknown'}g

Today's Intake:
- Calories: ${userGoals.todayCalories || 0}
- Protein: ${userGoals.todayProtein || 0}g

Respond with this exact JSON structure:
{
  "alignment": "supports" or "neutral" or "works_against",
  "summary": "Brief 1-sentence assessment",
  "details": ["Specific observations about this food relative to user's goals"],
  "alternatives": ["If not ideal, suggest 2-3 healthier alternatives"],
  "incorporationTips": ["If user wants to eat this, how to incorporate it well"],
  "exerciseOffset": "If this is a treat, estimate exercise to offset (e.g., '30 min walk'). Only include if relevant.",
  "allergenWarnings": ["Any allergen or restriction conflicts"]
}`;
    } else {
      return res.status(400).json({ error: 'Invalid type. Use: guidance, recipe, analysis, meal_estimate, food_analysis, or macro_recommendation' });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(500).json({ error: `OpenAI error: ${error.error?.message || 'Unknown error'}` });
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content || '';

    if (!message) {
      return res.status(500).json({ error: 'No response from OpenAI' });
    }

    return res.status(200).json({
      message: message.trim(),
      type,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
