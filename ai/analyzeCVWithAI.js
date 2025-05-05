import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

// Initialize OpenAI client with API key from .env file
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: "org-bZtcqWtvEQGHGblH4ap6kA1z",
});

export async function analyzeCVWithAI(cvText, position) {
  // Create the prompt for OpenAI, asking to evaluate the CV
  const prompt = `Evaluate this resume for the position "${position}". Does the candidate meet the typical requirements? Answer with "yes" or "no".\n\n${cvText}`;

  console.log("🟡 Prompt being sent to OpenAI:");

  try {
    // Make the API call to OpenAI
    const res = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [{ role: "user", content: prompt }],
      store: true,
      temperature: 0,
      max_tokens: 1000,
    });

    // Process the AI's response
    const answer = res.choices[0].message.content.trim().toLowerCase();

    console.log("🟢 AI response received:");
    console.log(answer); // Log the response for debugging

    // Return relevant data based on whether the AI answered "yes"
    return { relevant: answer.includes("yes"), rawAnswer: answer };
  } catch (error) {
    // Handle any errors that occur during the API call
    console.error("🔴 Error during OpenAI API call:");
    console.error(error);

    // Return relevant flag as false and include the error message
    return { relevant: false, error: error.message };
  }
}
