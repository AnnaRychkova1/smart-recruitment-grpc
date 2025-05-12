import fs from "fs/promises";
import path from "path";
import pdfParse from "pdf-parse";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

// Initialize OpenAI client with API key from .env file
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: "org-bZtcqWtvEQGHGblH4ap6kA1z",
});

/**
 * Analyzes a PDF CV and extracts candidate details.
 * @param {string} cvRelativePath - relative path to the PDF file
 * @returns {{name: string, email: string, position: string, experience: number}}
 */
export async function analyzeCVAndExtractCandidate(cvRelativePath) {
  try {
    const cvPath = path.resolve(process.cwd(), cvRelativePath);
    const buffer = await fs.readFile(cvPath);
    const parsed = await pdfParse(buffer);
    const text = parsed.text;

    const prompt = `
You are a CV analysis system. Analyze the following resume text and return structured candidate information in JSON format:
{
  "name": "Full Name",
  "email": "email@example.com",
  "position": "Desired Position",
  "experience": number_of_years_of_experience (number)
}

If any field is missing or unclear, use a default placeholder.

Here is the resume:
"""
${text.slice(0, 3500)}
"""`;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a recruitment assistant." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    });

    const content = aiResponse.choices[0].message.content;

    const answer = aiResponse.choices[0].message.content.trim().toLowerCase();

    console.log("🟢 AI response received:");
    console.log(answer);

    let candidate;
    try {
      candidate = JSON.parse(content);
    } catch (parseErr) {
      throw new Error("Failed to parse AI response as JSON:\n" + content);
    }

    return {
      name: candidate.name || "Unnamed",
      email: candidate.email || "unknown@example.com",
      position: candidate.position || "Unknown",
      experience: Number(candidate.experience) || 0,
    };
  } catch (err) {
    console.error("❌ analyzeCVAndExtractCandidate error:", err.message);
    throw err;
  }
}
