document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  if (!token || token === null) {
    window.location.href = "/signin";
  }
  // Handle click on the "Schedule Interview" button
  const scheduleBtn = document.getElementById("schedule-btn");
  if (scheduleBtn) {
    scheduleBtn.addEventListener("click", scheduleInterview);
  }

  // Handle the form submission for editing an interview
  const editForm = document.getElementById("edit-interview-form");
  if (editForm) {
    editForm.addEventListener("submit", saveEditInterview);
  }
});

// 🟢 Schedule an interview
async function scheduleInterview() {
  if (!ensureValidToken()) return;
  const interviewBox = document.getElementById("interview-container");
  const interviewSection = document.getElementById("interview-section");
  const interviewTitle = document.getElementById("interview-title");
  const showFormFilterBtn = document.getElementById("show-form-filter-btn");
  const showFilteredCandidates = document.getElementById(
    "show-filtered-candidates"
  );
  const filterSection = document.getElementById("filter-section");
  const addSection = document.getElementById("add-section");
  const dateInput = document.getElementById("interview-date");
  const messageBox = document.getElementById("schedule-message");
  const selectedDate = dateInput.value;

  if (!selectedDate) return alert("📅 Please select a date first.");

  const selected = new Date(selectedDate);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const maxDate = new Date(today);
  maxDate.setFullYear(today.getFullYear() + 1);

  if (selected < tomorrow) {
    return alert("Please choose a future date (starting from tomorrow).");
  }
  if (selected > maxDate) {
    return alert(
      `Please choose a date within 1 year (until ${
        maxDate.toISOString().split("T")[0]
      }).`
    );
  }

  const token = localStorage.getItem("token");

  try {
    const response = await fetch("/schedule-interviews", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        date: selectedDate,
      }),
    });

    const result = await response.json();

    const scheduled = result.scheduled;

    const tableBody = document.getElementById("schedule-body");
    tableBody.innerHTML = "";

    if (scheduled.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="4">No scheduled interviews.</td></tr>`;
      return;
    }
    filterSection.style.display = "none";
    scheduled.forEach((entry) => {
      const row = document.createElement("tr");
      row.setAttribute("data-id", entry._id);
      row.innerHTML = `
        <td>${entry.name}</td>
        <td>${entry.date}</td>
        <td>${entry.time}</td>
        <td>
          <button class="action-btn" onclick='editInterview(${JSON.stringify(
            entry
          )})'>✏️ Edit</button>
          <button class="action-btn" onclick="deleteInterview('${
            entry._id
          }')">🗑️ Delete</button>
        </td>
      `;
      tableBody.appendChild(row);
    });
    // Create a button asking the user if they want to add or filter more candidates
    const continueBtn = document.createElement("button");
    continueBtn.textContent = "➕ Add or Filter More Candidates?";
    continueBtn.style.marginTop = "20px";
    continueBtn.style.marginBottom = "16px";

    // When clicked, show the add and filter sections again
    continueBtn.addEventListener("click", () => {
      addSection.style.display = "block";
      filterSection.style.display = "block";
      interviewBox.style.display = "none";
      interviewSection.style.display = "none";
    });

    // Append the button under the interview table
    const interviewTable = document.getElementById("schedule-table");
    interviewTable.parentNode.insertBefore(
      continueBtn,
      interviewTable.nextSibling
    );
    showFormFilterBtn.style.display = "block";
    showFilteredCandidates.style.display = "none";
    interviewBox.style.display = "none";
    interviewTitle.textContent = "📅 Scheduled Interviews";
    alert("✅ Interviews successfully scheduled!");
    messageBox.innerHTML = `<strong>${result.message}</strong>`;
  } catch (err) {
    console.error("❌ Failed to schedule interviews:", err);
    alert("❌ Scheduling failed.");
  }
}

// ✏️ Open the modal for editing an interview
function editInterview(entry) {
  if (!ensureValidToken()) return;
  const modal = document.getElementById("edit-interview-modal");

  const form = document.getElementById("edit-interview-form");
  const { _id, name, date, time } = entry;

  document.getElementById("edit-interview-id").value = _id;
  document.getElementById("edit-interview-candidate").value = name;
  document.getElementById("edit-interview-date").value = date;
  document.getElementById("edit-interview-time").value = time;

  form.setAttribute("data-id", _id);
  form.dataset.oldDate = date;
  form.dataset.oldTime = time;

  openModal(modal); // Open the modal
}

// 💾 Save the edited interview
async function saveEditInterview(e) {
  e.preventDefault();
  if (!ensureValidToken()) return;

  const form = document.getElementById("edit-interview-form");
  const modal = document.getElementById("edit-interview-modal");

  const id = form.getAttribute("data-id");
  const dateInput = document.getElementById("edit-interview-date");
  const timeInput = document.getElementById("edit-interview-time");

  const selectedDate = dateInput.value;
  const selectedTime = timeInput.value;

  const selected = new Date(selectedDate);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const maxDate = new Date(today);
  maxDate.setFullYear(today.getFullYear() + 1);

  if (selected < tomorrow) {
    return alert("Please choose a future date (starting from tomorrow).");
  }
  if (selected > maxDate) {
    return alert(
      `Please choose a date within 1 year (until ${
        maxDate.toISOString().split("T")[0]
      }).`
    );
  }
  const [hours, minutes] = selectedTime.split(":").map(Number);

  if (
    hours < 9 ||
    hours > 18 ||
    (hours === 13 && minutes >= 0 && minutes < 60) ||
    (hours === 14 && minutes === 0)
  ) {
    return alert(
      "Please choose a time between 09:00 and 18:00, excluding 13:00 to 14:00 for lunch."
    );
  }

  const newDate = dateInput.value.trim() || form.dataset.oldDate;
  const newTime = timeInput.value.trim() || form.dataset.oldTime;

  const request = {
    _id: id,
    new_date: newDate,
    new_time: newTime,
  };

  const token = localStorage.getItem("token");

  try {
    const response = await fetch(`/update-interview/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });

    const { message, interview } = await response.json();

    alert(`${message}`);
    closeModal(document.getElementById("edit-interview-modal"));

    // Update only the edited interview in the DOM without reloading the entire table
    if (interview) {
      updateInterviewInDOM(interview);
    }
  } catch (err) {
    console.error("❌ Error editing interview:", err);
    alert("❌ Failed to update interview.");
  }
}

// 🗑️ Delete an interview
async function deleteInterview(id) {
  if (!confirm("Are you sure you want to delete this interview?")) return;
  if (!ensureValidToken()) return;
  const token = localStorage.getItem("token");

  try {
    const response = await fetch(`/delete-interview/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await response.json();
    // if (!response.ok) throw new Error();

    const toDelete = String(result.id);

    if (result.id) {
      deleteInterviewFromDom(toDelete);
      alert("🗑️ Interview deleted.");
    } else {
      alert(`${result.message}`);
    }
  } catch (err) {
    console.error("❌ Error deleting interview:", err);
    alert("❌ Failed to delete interview.");
  }
}

// Function to update the interview in the DOM after editing
function updateInterviewInDOM(updatedInterview) {
  if (!ensureValidToken()) return;
  const row = document.querySelector(
    `#schedule-body tr[data-id='${updatedInterview._id}']`
  );
  if (row) {
    row.querySelector("td:nth-child(2)").textContent = updatedInterview.date;
    row.querySelector("td:nth-child(3)").textContent = updatedInterview.time;
  }
}

// Function to remove the interview from the DOM after deletion
function deleteInterviewFromDom(id) {
  if (!ensureValidToken()) return;
  const tableBody = document.getElementById("schedule-body");
  const row = tableBody.querySelector(`tr[data-id="${id}"]`);

  if (row) {
    row.remove();
  }

  const remainingRows = tableBody.querySelectorAll("tr[data-id]");

  const messageBox = document.getElementById("schedule-message");
  if (messageBox) {
    messageBox.innerHTML = `<strong>📅 ${remainingRows.length} interviews scheduled.</strong>`;
  }

  if (remainingRows.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4">No scheduled interviews.</td></tr>`;
  }
}

// Check is token valid
function ensureValidToken() {
  const token = localStorage.getItem("token");

  try {
    if (!token) throw new Error("No token");

    const payload = JSON.parse(atob(token.split(".")[1]));
    const currentTime = Math.floor(Date.now() / 1000);

    if (payload.exp < currentTime) throw new Error("Token expired");

    return true; // Token is valid
  } catch (err) {
    localStorage.removeItem("token");
    localStorage.removeItem("name");
    alert("⚠️ Your session has expired or is invalid. Please sign in again.");
    window.location.href = "/signin";
    return false;
  }
}
