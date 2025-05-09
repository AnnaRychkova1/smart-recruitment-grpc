// filtering.js

document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/signin";
  }
  const userWelcome = document.getElementById("user-welcome");
  const userNameWelcome = localStorage.getItem("name");
  userWelcome.textContent = `Hi ${userNameWelcome}`;

  // Handle submission of the filter form
  const filterForm = document.getElementById("filter-form");
  if (filterForm) {
    filterForm.addEventListener("submit", (e) => {
      e.preventDefault();
      submitFilterForm();
    });
  }

  // Handle click to show the filter modal
  const showFilterBtn = document.getElementById("show-form-filter-btn");
  const filterModal = document.getElementById("filter-modal");

  if (showFilterBtn && filterModal) {
    showFilterBtn.addEventListener("click", () => openModal(filterModal));
  }
});

/**
 * Sends a filter request to the server and displays the filtered candidates
 */
async function submitFilterForm() {
  const filterTitle = document.getElementById("filter-title");
  const showFilterBtn = document.getElementById("show-form-filter-btn");
  const addSection = document.getElementById("add-section");
  const interviewSection = document.getElementById("interview-section");
  const form = document.getElementById("filter-form");
  const modal = document.getElementById("filter-modal");
  const filteredList = document.getElementById("show-filtered-candidates");
  const list = document.getElementById("filtered-candidate-list");

  const formData = new FormData(form);
  const params = new URLSearchParams();

  // Append query parameters only if they exist
  if (formData.get("minExperience"))
    params.append("minExperience", formData.get("minExperience"));
  if (formData.get("maxExperience"))
    params.append("maxExperience", formData.get("maxExperience"));
  if (formData.get("position"))
    params.append("position", formData.get("position"));

  const token = localStorage.getItem("token");

  try {
    const response = await fetch(`/filter-candidates?${params.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const { filtered } = await response.json();

    list.innerHTML = "";

    // Show number of matching candidates
    const message = document.createElement("p");
    message.innerHTML = `<strong class="message-result">✅ ${filtered.length} candidates passed AI filtering.</strong>`;
    list.appendChild(message);

    const toggleBtn = document.createElement("button");
    toggleBtn.id = "toggle-candidates-btn";
    toggleBtn.textContent = "🙈 Hide Candidates";
    toggleBtn.style.padding = "12px";
    toggleBtn.style.marginBottom = "16px";

    toggleBtn.addEventListener("click", () => {
      const items = list.querySelectorAll("li[data-id], li:not(:first-child)");
      const currentlyVisible =
        items.length && items[0].style.display !== "none";

      items.forEach((item) => {
        item.style.display = currentlyVisible ? "none" : "block";
      });

      toggleBtn.textContent = currentlyVisible
        ? "👀 Show Candidates"
        : "🙈 Hide Candidates";
    });

    list.appendChild(toggleBtn);

    // Render filtered candidates or show "no results" message
    if (filtered.length === 0) {
      const noResult = document.createElement("li");
      noResult.textContent = "No candidates match the criteria.";
      list.appendChild(noResult);
    } else {
      filtered.forEach((candidate) => {
        const item = document.createElement("li");
        item.setAttribute("data-id", candidate._id);
        item.innerHTML = `
          <strong>Name:</strong> ${candidate.name}<br />
          <strong>Email:</strong> ${candidate.email}<br />
          <strong>Position:</strong> ${candidate.position}<br />
          <strong>Experience:</strong> ${candidate.experience} years<br />
          <strong>CV:</strong> <a href="${candidate.pathCV}" target="_blank">Open CV</a><hr />
        `;

        // Create a delete button for each candidate
        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "🗑️ Delete";
        deleteBtn.classList.add("action-btn");
        deleteBtn.onclick = () => deleteFilteredCandidate(candidate._id);
        item.appendChild(deleteBtn);

        list.appendChild(item);
      });
    }

    filteredList.style.display = "block";
    addSection.style.display = "none";
    interviewSection.style.display = "block";
    showFilterBtn.style.display = "none";
    filterTitle.textContent = "🔍 Filtered Candidates";
    closeModal(modal);
  } catch (err) {
    console.error("Error filtering candidates:", err);
    alert("❌ Failed to filter candidates.");
  }
}

/**
 * Deletes a filtered candidate and updates the filtered list
 * @param {string} _id - ID of the candidate to delete
 */
async function deleteFilteredCandidate(_id) {
  // Confirm deletion before proceeding
  if (!confirm("Are you sure you want to delete this candidate?")) return;
  const token = localStorage.getItem("token");

  try {
    // Send a DELETE request to the server to delete the candidate
    const response = await fetch(`/delete-filtered/${_id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Check if the response status is OK (200)
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error: ${response.status} - ${errorText}`);
    }

    // Try to parse the response as JSON
    const result = await response.json();

    // Show server message after the deletion
    alert(result.message);

    // Update the candidate list in the DOM
    const list = document.getElementById("filtered-candidate-list");
    const candidateItem = list.querySelector(`[data-id="${_id}"]`);

    // Remove the candidate item from the DOM if it exists
    if (candidateItem) {
      candidateItem.remove();
    }

    // Update the number of remaining candidates
    const candidates = list.querySelectorAll("li[data-id]");
    const message = document.querySelector("#filtered-candidate-list p");

    // Update the message with the current number of candidates
    if (message) {
      message.innerHTML = `<strong>✅ ${candidates.length} candidates passed AI filtering.</strong>`;
    }

    // If the list is empty, show a "no results" message
    if (candidates.length === 0) {
      const noResult = document.createElement("li");
      noResult.textContent = "No candidates match the criteria.";
      list.appendChild(noResult);
    }
  } catch (err) {
    console.error("Error deleting filtered candidate:", err);
    alert(`❌ Failed to delete candidate. Error: ${err.message}`);
  }
}
