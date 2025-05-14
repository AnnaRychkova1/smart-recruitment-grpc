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
  const prompt = `You are an AI assistant helping filter job applicants. 

  Given the following resume text, determine:
  1. Is this a real, structured CV or just a placeholder, incomplete text, or irrelevant content?
  2. If the position is specified, does the candidate meet general expectations for this role (e.g. experience, skills)?
  
  Position: "${position || "Any"}"
  
  Resume:
  ${cvText}
  
  Please answer only:
  - "yes" if it's a real CV and matches the position (if specified),
  - "no" otherwise, followed by a brief reason why it's not a match.`;

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
