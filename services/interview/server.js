import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import path from "path";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

// Load the interview.proto file to define the gRPC service
const PROTO_PATH = path.join(process.cwd(), "proto", "interview.proto");
const packageDef = protoLoader.loadSync(PROTO_PATH);
const interviewProto = grpc.loadPackageDefinition(packageDef).interview;

// Pseudo-database for storing scheduled interviews
const scheduledInterviews = [];
let interviewCounter = 1; // Counter to assign unique interview IDs

// Function to schedule interviews for candidates
function ScheduleInterviews(call, callback) {
  const { candidates, date } = call.request; // Extract candidate data and date from the request
  console.log(
    `[server:interview] 🟡 Scheduling interviews for ${candidates.length} candidates on ${date}`
  );

  const interviewDuration = 60; // Each interview lasts 1 hour
  const workStart = new Date(`${date}T09:00:00`); // Workday starts at 09:00
  const lunchStart = new Date(`${date}T13:00:00`); // Lunch break starts at 13:00
  const lunchEnd = new Date(`${date}T14:00:00`); // Lunch break ends at 14:00
  const workEnd = new Date(`${date}T18:00:00`); // Workday ends at 18:00

  const scheduled = []; // Array to store scheduled interviews
  let current = new Date(workStart); // Start from the work start time

  // Loop through each candidate and schedule their interview
  for (const candidate of candidates) {
    console.log(
      `[server:interview] 🟢 Scheduling interview for candidate: ${candidate.name}`
    );

    // Skip over lunch time if the current interview time is during lunch break
    if (current >= lunchStart && current < lunchEnd) {
      current = new Date(lunchEnd); // Set time after lunch break
    }

    // If there's no available time left in the day, stop scheduling
    if (current >= workEnd) {
      console.warn(
        `[server:interview] ⏰ No more available slots for the day.`
      );
      break;
    }

    const time = current.toTimeString().slice(0, 5); // Format the interview time (HH:mm)
    const interview = {
      id: interviewCounter++, // Assign a unique ID to the interview
      candidateId: candidate.id,
      name: candidate.name,
      date,
      time,
    };

    scheduled.push(interview); // Add interview to the scheduled list
    current = new Date(current.getTime() + interviewDuration * 60 * 1000); // Move time forward by interview duration
  }

  // Add scheduled interviews to the pseudo-database
  scheduledInterviews.push(...scheduled);

  console.log(
    `[server:interview] 🟢 Successfully scheduled ${scheduled.length} interview(s)`
  );
  callback(null, {
    message: `Successfully scheduled ${scheduled.length} interview(s) on ${date}`,
    scheduled,
  });
}

// Function to edit an existing interview
function EditInterview(call, callback) {
  const { id, newDate, newTime } = call.request; // Extract interview ID and new date/time from the request

  console.log(`🟡 Editing interview with ID: ${id}`);
  console.log(`🟡 New Date: ${newDate}, New Time: ${newTime}`);

  // Find the interview by its ID in the scheduled interviews list
  const index = scheduledInterviews.findIndex(
    (i) => String(i.id) === String(id)
  );

  // If the interview is not found, return an error
  if (index === -1) {
    console.warn(`❌ Interview with ID: ${id} not found.`);
    return callback(null, {
      message: `Interview with id ${id} not found.`,
      updated: null,
    });
  }

  // Update the interview's date and time
  scheduledInterviews[index].date = newDate;
  scheduledInterviews[index].time = newTime;

  console.log(
    `🟢 Interview for ${scheduledInterviews[index].name} updated successfully to ${newDate} at ${newTime}`
  );

  callback(null, {
    message: `Interview for ${scheduledInterviews[index].name} updated successfully to ${newDate} at ${newTime}.`,
    updated: scheduledInterviews[index],
  });
}

// Function to delete an interview
function DeleteInterview(call, callback) {
  const { id } = call.request; // Extract interview ID from the request
  console.log(`[server:interview] 🟡 Deleting interview with ID: ${id}`);

  // Find the interview by its ID
  const index = scheduledInterviews.findIndex(
    (i) => String(i.id) === String(id)
  );

  // If the interview is not found, return an error
  if (index === -1) {
    console.warn(`[server:interview] ❌ Interview with ID: ${id} not found.`);
    return callback(null, {
      message: `Interview with id ${id} not found.`,
      success: false,
    });
  }

  // Remove the interview from the scheduled interviews list
  scheduledInterviews.splice(index, 1);
  console.log(
    `[server:interview] 🟢 Interview with ID: ${id} deleted successfully.`
  );

  callback(null, {
    message: `Interview with id ${id} deleted successfully.`,
    id: id,
  });
}

// Create a new gRPC server
const server = new grpc.Server();
server.addService(interviewProto.InterviewService.service, {
  ScheduleInterviews,
  EditInterview,
  DeleteInterview,
});

// Define server configuration
const PORT = process.env.INTERVIEW_PORT || 50053; // Use the INTERVIEW_PORT environment variable or default to 50053
const HOST = "localhost";

// Bind the server to the specified port and host
server.bindAsync(
  `0.0.0.0:${PORT}`,
  grpc.ServerCredentials.createInsecure(),
  () => {
    console.log(`🚀 InterviewService running on port ${PORT}`); // Log the server start

    // 📡 Register this service in the service discovery system
    fetch("http://localhost:3001/register", {
      method: "POST", // Using POST method to register the service with the discovery system
      headers: { "Content-Type": "application/json" }, // Set the content type as JSON
      body: JSON.stringify({
        serviceName: "InterviewService", // The name of the service being registered
        host: HOST, // The host where the service is running
        port: PORT, // The port where the service can be accessed
      }),
    })
      .then((res) => {
        // Check if the response is successful (status code 2xx)
        if (!res.ok) {
          // If the response is not successful, throw an error with the response status
          throw new Error(`Discovery registration failed: ${res.statusText}`);
        }
        return res.json(); // If the request is successful, parse the response as JSON
      })
      .then((data) => {
        // Log the successful registration of the InterviewService
        console.log("📡 Registered with discovery:", data);
      })
      .catch((err) => {
        // Log any errors encountered during the registration process
        console.error("❌ Discovery registration failed:", err);
      });
  }
);
