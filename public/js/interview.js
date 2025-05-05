let scheduledInterviews = [];

document.addEventListener("DOMContentLoaded", () => {
  const scheduleBtn = document.getElementById("schedule-btn");
  if (scheduleBtn) {
    scheduleBtn.addEventListener("click", scheduleInterview);
  }

  const editForm = document.getElementById("edit-interview-form");
  if (editForm) {
    editForm.addEventListener("submit", saveEditInterview);
  }
});

// 🟢 Schedule interviews
async function scheduleInterview() {
  const dateInput = document.getElementById("interview-date");
  const messageBox = document.getElementById("schedule-message");
  const tableBody = document.getElementById("schedule-body");
  const selectedDate = dateInput.value;

  if (!selectedDate) return alert("📅 Please select a date first.");
  if (latestFilteredCandidates.length === 0)
    return alert("⚠️ Please filter candidates first.");

  try {
    const response = await fetch("/schedule-interviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: selectedDate,
        candidates: latestFilteredCandidates.map((c) => ({
          id: c.id,
          name: c.name,
        })),
      }),
    });

    const result = await response.json();
    if (!response.ok) throw new Error();

    alert("✅ Interviews successfully scheduled!");
    messageBox.innerHTML = `<strong>${result.message}</strong>`;

    scheduledInterviews = result.scheduled || [];
    renderScheduledInterviews();
  } catch (err) {
    console.error("❌ Failed to schedule interviews:", err);
    alert("❌ Scheduling failed.");
  }
}

// 🟡 Render table
function renderScheduledInterviews() {
  const tableBody = document.getElementById("schedule-body");
  tableBody.innerHTML = "";

  if (scheduledInterviews.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4">No scheduled interviews.</td></tr>`;
    return;
  }

  scheduledInterviews.forEach((entry) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${entry.name}</td>
      <td>${entry.date}</td>
      <td>${entry.time}</td>
      <td>
        <button onclick="editInterview(${entry.id})">✏️ Edit</button>
        <button onclick="deleteInterview(${entry.id})">🗑️ Delete</button>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

// ✏️ Edit interview
function editInterview(id) {
  const selected = scheduledInterviews.find((item) => item.id === String(id));
  if (!selected) return alert("❌ Interview not found!");

  document.getElementById("edit-interview-id").value = selected.id;
  document.getElementById("edit-interview-date").value = selected.date;
  document.getElementById("edit-interview-time").value = selected.time;
  document.getElementById("edit-interview-candidate").value = selected.name;

  openModal(document.getElementById("edit-interview-modal"));
}

// 💾 Save edited interview
async function saveEditInterview(e) {
  e.preventDefault();

  const id = Number(document.getElementById("edit-interview-id").value);
  const newDate = document.getElementById("edit-interview-date").value;
  const newTime = document.getElementById("edit-interview-time").value;

  try {
    const response = await fetch("/edit-interview", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        new_date: newDate,
        new_time: newTime,
      }),
    });

    const result = await response.json();
    if (!response.ok) throw new Error();

    alert(`✅ ${result.message}`);
    closeModal(document.getElementById("edit-interview-modal"));

    // Update from server response
    const updated = result.updated;
    scheduledInterviews = scheduledInterviews.map((interview) =>
      String(interview.id) === String(updated.id) ? updated : interview
    );

    renderScheduledInterviews();
  } catch (err) {
    console.error("❌ Error editing interview:", err);
    alert("❌ Failed to update interview.");
  }
}

// 🗑️ Delete interview
async function deleteInterview(id) {
  if (!confirm("Are you sure you want to delete this interview?")) return;

  try {
    const response = await fetch(`/delete-interview/${id}`, {
      method: "DELETE",
    });
    const result = await response.json();
    if (!response.ok) throw new Error();

    alert("🗑️ Interview deleted.");

    // Remove from request
    scheduledInterviews = scheduledInterviews.filter(
      (i) => String(i.id) !== String(result.id)
    );
    renderScheduledInterviews();
  } catch (err) {
    console.error("❌ Error deleting interview:", err);
    alert("❌ Failed to delete interview.");
  }
}
