let candidatesVisible = false;

// Initialize event listeners after DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  if (!token || token === null) {
    window.location.href = "/signin";
  }
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
  if (!ensureValidToken()) return;

  const btn = document.getElementById("show-list-btn");
  const list = document.getElementById("candidate-list");

  if (!btn || !list) return;

  // Hide list if already visible
  if (candidatesVisible) {
    list.innerHTML = "";
    btn.textContent = "👀 Show All Candidates";
    candidatesVisible = false;
    return;
  }
  const token = localStorage.getItem("token");

  try {
    // const response = await fetch("/get-candidates");
    const response = await fetch("/get-candidates", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) throw new Error();

    const { candidates } = await response.json();
    list.innerHTML = "";

    const message = document.createElement("p");
    message.innerHTML = `<strong class="message-result">✅ You have ${candidates.length} candidates.</strong>`;
    list.appendChild(message);

    // Show fallback if no candidates found
    if (candidates.length === 0) {
      const noResult = document.createElement("li");
      noResult.textContent = "No candidates available.";
      list.appendChild(noResult);
    } else {
      // Render each candidate with edit and delete buttons
      candidates.forEach((candidate) => {
        const li = document.createElement("li");
        li.setAttribute("data-id", candidate.id);
        li.innerHTML = `
          <strong>Name:</strong> ${candidate.name}<br />
          <strong>Email:</strong> ${candidate.email}<br />
          <strong>Position:</strong> ${candidate.position}<br />
          <strong>Experience:</strong> ${candidate.experience} years<br />
          <strong>CV:</strong> <a href="${candidate.pathCV}" target="_blank">Open CV</a><br /><hr />
        `;

        const editBtn = document.createElement("button");
        editBtn.textContent = "✏️ Edit";
        editBtn.classList.add("action-btn");
        editBtn.onclick = () => openEditModal(candidate);

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "🗑️ Delete";
        deleteBtn.classList.add("action-btn");
        deleteBtn.onclick = () => deleteCandidate(candidate._id);

        li.appendChild(editBtn);
        li.appendChild(deleteBtn);
        list.appendChild(li);
      });
    }

    btn.textContent = "🙈 Hide Candidates";
    candidatesVisible = true;
  } catch (err) {
    console.error("Error fetching candidates:", err);
    alert("Failed to load candidates. Please try again later.");
  }
}

// Submit a new candidate to the server
async function submitCandidateForm() {
  if (!ensureValidToken()) return;
  const form = document.getElementById("hiring-form");
  const formModal = document.getElementById("form-modal");

  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const positionInput = document.getElementById("position");
  const experienceInput = document.getElementById("experience");
  const cvInput = document.getElementById("pathCV");

  let isFormValid = true;

  // Check if the fields are filled and valid
  if (
    !nameInput.value ||
    !emailInput.value ||
    !positionInput.value ||
    experienceInput.value < 0
  ) {
    isFormValid = false;
  }

  // Function to create error messages
  function createErrorMessage(message) {
    const errorMessage = document.createElement("div");
    errorMessage.classList.add("error-message");
    errorMessage.style.color = "red";
    errorMessage.style.padding = "5px";
    errorMessage.style.backgroundColor = "#fdd";
    errorMessage.textContent = message;
    return errorMessage;
  }

  // Function to remove any existing error message
  function removeErrorMessage(inputElement) {
    const existingError =
      inputElement.parentElement.querySelector(".error-message");
    if (existingError) {
      existingError.remove(); // Remove the existing error message
    }
  }

  // Check if CV input is empty or has the wrong extension
  if (!cvInput.files.length) {
    removeErrorMessage(cvInput);
    isFormValid = false;
  } else {
    const file = cvInput.files[0]; // Get the first file from the input (if it exists)
    if (file) {
      // Check for PDF file extension
      const fileExtension = file.name.split(".").pop().toLowerCase(); // Get the file extension
      if (fileExtension !== "pdf") {
        isFormValid = false;
        removeErrorMessage(cvInput);
        const errorMessage = createErrorMessage(
          "⚠️ Only PDF files are allowed."
        );
        cvInput.parentElement.appendChild(errorMessage); // Add new error message
      }
    }
  }

  if (!isFormValid) {
    return;
  }

  const formData = new FormData(form);
  const token = localStorage.getItem("token");

  try {
    const response = await fetch("/add-candidate", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    const result = await response.json();

    if (!response.ok || result.status !== 201) {
      alert(`❌ Error ${result.status}: ${result.message}`);
      return;
    }
    alert(`${result.message}`);
    if (candidatesVisible) {
      await toggleCandidateList();
    }
  } catch {
    alert(
      "⚠️ A connection error occurred. The candidate may have been added. Please check the candidate list."
    );
  }

  closeModal(formModal);
}

// Delete candidate by ID
async function deleteCandidate(_id) {
  if (!ensureValidToken()) return;
  if (!confirm("Are you sure you want to delete this candidate?")) return;
  const token = localStorage.getItem("token");

  try {
    const response = await fetch(`/delete-candidate/${_id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error: ${response.status} - ${errorText}`);
    }

    let result;
    try {
      result = await response.json();
    } catch (jsonErr) {
      throw new Error("Failed to parse server response as JSON.");
    }

    alert(result.message);
    await toggleCandidateList(); // Refresh the list
  } catch (err) {
    console.error("Error deleting candidate:", err);
    alert("❌ Failed to delete candidate.");
  }
}

// Open edit modal and populate it with candidate data
function openEditModal(candidate) {
  if (!ensureValidToken()) return;
  const editModal = document.getElementById("edit-candidate-modal");
  const editForm = document.getElementById("edit-form");

  const nameInput = document.getElementById("edit-name");
  const emailInput = document.getElementById("edit-email");
  const positionInput = document.getElementById("edit-position");
  const experienceInput = document.getElementById("edit-experience");
  const cvInput = document.getElementById("edit-pathCV");

  // Ensure all required fields exist
  if (nameInput && emailInput && positionInput && experienceInput && cvInput) {
    nameInput.value = candidate.name;
    emailInput.value = candidate.email;
    positionInput.value = candidate.position;
    experienceInput.value = candidate.experience;
    cvInput.value = ""; // Do not pre-fill file input

    const existingPathCVInput = document.getElementById("existingPathCV");
    if (existingPathCVInput) {
      existingPathCVInput.value = candidate.pathCV;
    }

    editForm.setAttribute("data-id", candidate._id);

    openModal(editModal);
  } else {
    console.error("❌ Some form elements are missing or not properly loaded.");
  }
}

async function updateCandidate() {
  if (!ensureValidToken()) return;
  const editForm = document.getElementById("edit-form");
  const editModal = document.getElementById("edit-candidate-modal");
  const formData = new FormData(editForm);
  const candidateId = editForm.getAttribute("data-id");
  const token = localStorage.getItem("token");

  try {
    const response = await fetch(`/update-candidate/${candidateId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const result = await response.json();

    if (response.status === 200) {
      // alert(`✅ Candidate ${result.candidate.name} updated successfully.`);
      alert(`✅ ${result.message}`);

      await toggleCandidateList(); // Refresh the list to reflect changes
    } else if (response.status === 400) {
      alert("⚠️ Invalid data: " + result.message);
    } else if (response.status === 404) {
      alert("❌ Candidate not found: " + result.message);
    } else if (response.status === 500) {
      alert("❌ Server error: " + result.message);
    } else {
      alert("❌ Unknown error: " + (result.message || "No details."));
    }
  } catch (err) {
    console.error("❌ Error updating candidate:", err);
    alert("❌ Failed to update candidate.");
  }

  closeModal(editModal);
}

// Check is token valid
function ensureValidToken() {
  const token = localStorage.getItem("token");
  if (!token || isTokenExpired(token)) {
    localStorage.removeItem("token");
    localStorage.removeItem("name");
    alert(
      "⚠️ Your session has expired due to inactivity. Please sign in again."
    );
    window.location.href = "/signin";
    return false;
  }
  return true;
}
function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  } catch (err) {
    return true; // treat invalid tokens as expired
  }
}
