let candidatesVisible = false;

// Initialize event listeners after DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  const showFormBtn = document.getElementById("show-form-btn");
  const showListBtn = document.getElementById("show-list-btn");

  // Show 'Add Candidate' modal
  if (showFormBtn) {
    showFormBtn.addEventListener("click", () =>
      openModal(document.getElementById("form-modal"))
    );
  }

  // Toggle candidate list display
  if (showListBtn) {
    showListBtn.addEventListener("click", toggleCandidateList);
  }

  // Handle candidate form submission
  const hiringForm = document.getElementById("hiring-form");
  if (hiringForm) {
    hiringForm.addEventListener("submit", (e) => {
      e.preventDefault();
      submitCandidateForm();
    });
  }

  // Handle candidate edit form submission
  const editForm = document.getElementById("edit-form");
  if (editForm) {
    editForm.addEventListener("submit", (e) => {
      e.preventDefault();
      updateCandidate();
    });
  }
});

// Toggle between showing and hiding all candidates
async function toggleCandidateList() {
  const btn = document.getElementById("show-list-btn");
  const list = document.getElementById("candidate-list");

  // Hide list if already visible
  if (candidatesVisible) {
    list.innerHTML = "";
    btn.textContent = "Show All Candidates";
    candidatesVisible = false;
    return;
  }

  try {
    const response = await fetch("/candidates");
    if (!response.ok) throw new Error();

    const { candidates } = await response.json();
    list.innerHTML = "";

    // Show fallback if no candidates found
    if (candidates.length === 0) {
      list.innerHTML = "<li>No candidates available.</li>";
    } else {
      // Render each candidate with edit and delete buttons
      candidates.forEach((candidate) => {
        const li = document.createElement("li");
        li.innerHTML = `
          <strong>Name:</strong> ${candidate.name}<br />
          <strong>Email:</strong> ${candidate.email}<br />
          <strong>Position:</strong> ${candidate.position}<br />
          <strong>Experience:</strong> ${candidate.experience} years<br />
          <strong>CV:</strong> <a href="${candidate.pathCV}" target="_blank">Open CV</a><br /><hr />
        `;

        const editBtn = document.createElement("button");
        editBtn.textContent = "✏️ Edit";
        editBtn.onclick = () => openEditModal(candidate);

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "🗑️ Delete";
        deleteBtn.onclick = () => deleteCandidate(candidate.id);

        li.appendChild(editBtn);
        li.appendChild(deleteBtn);
        list.appendChild(li);
      });
    }

    btn.textContent = "Hide Candidates";
    candidatesVisible = true;
  } catch (err) {
    console.error("Error fetching candidates:", err);
    alert("Failed to load candidates. Please try again later.");
  }
}

// Submit a new candidate to the server
async function submitCandidateForm() {
  const form = document.getElementById("hiring-form");
  const formModal = document.getElementById("form-modal");
  const resultModal = document.getElementById("result-modal");

  const formData = new FormData(form);
  formData.append("id", Date.now().toString()); // Assign a unique ID based on timestamp

  try {
    const response = await fetch("/add-candidate", {
      method: "POST",
      body: formData,
    });
    const result = await response.json();

    if (!response.ok) throw new Error();
    alert(`🗑️ ${result.message || "Something went wrong"}`);
  } catch {
    resultMessage.innerText = "❌ Failed to add candidate.";
  }

  closeModal(formModal);
  openModal(resultModal);
}

// Delete candidate by ID
async function deleteCandidate(id) {
  if (!confirm("Are you sure you want to delete this candidate?")) return;

  try {
    const response = await fetch(`/delete-candidate/${id}`, {
      method: "DELETE",
    });

    const result = await response.json();

    if (!response.ok) throw new Error();
    alert("🗑️ Candidate deleted.");

    toggleCandidateList(); // Refresh the list
  } catch (err) {
    console.error("Error deleting candidate:", err);
    alert("❌ Failed to delete candidate.");
  }
}

// Open edit modal and populate it with candidate data
function openEditModal(candidate) {
  const editModal = document.getElementById("edit-candidate-modal");
  const editForm = document.getElementById("edit-form");

  const idInput = document.getElementById("edit-id");
  const nameInput = document.getElementById("edit-name");
  const emailInput = document.getElementById("edit-email");
  const positionInput = document.getElementById("edit-position");
  const experienceInput = document.getElementById("edit-experience");
  const cvInput = document.getElementById("edit-pathCV");

  // Ensure all required fields exist
  if (
    idInput &&
    nameInput &&
    emailInput &&
    positionInput &&
    experienceInput &&
    cvInput
  ) {
    idInput.value = candidate.id;
    nameInput.value = candidate.name;
    emailInput.value = candidate.email;
    positionInput.value = candidate.position;
    experienceInput.value = candidate.experience;
    cvInput.value = ""; // Do not pre-fill file input

    const existingPathCVInput = document.getElementById("existingPathCV");
    if (existingPathCVInput) {
      existingPathCVInput.value = candidate.pathCV;
    }

    openModal(editModal);
  } else {
    console.error("Some form elements are missing or not properly loaded.");
  }
}

// Submit updated candidate data to server
async function updateCandidate() {
  const editForm = document.getElementById("edit-form");
  const editModal = document.getElementById("edit-candidate-modal");

  const candidateId = document.getElementById("edit-id").value;
  const formData = new FormData(editForm);

  try {
    const response = await fetch("/edit-candidate/", {
      method: "PUT",
      body: formData,
    });
    const result = await response.json();

    if (!response.ok) throw new Error();
    alert("✅ Candidate updated successfully.");
    toggleCandidateList(); // Refresh the list
  } catch (err) {
    console.error("Error updating candidate:", err);
    alert("❌ Failed to update candidate.");
  }

  closeModal(editModal);
}
