// filtering.js

// Store the latest filtered candidates for further actions like deletion
let latestFilteredCandidates = [];

document.addEventListener("DOMContentLoaded", () => {
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
  const form = document.getElementById("filter-form");
  const modal = document.getElementById("filter-modal");
  const filteredSection = document.getElementById("show-filtered-candidates");
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

  try {
    const response = await fetch(`/filter-candidates?${params.toString()}`);
    const result = await response.json();

    if (!response.ok) throw new Error();

    latestFilteredCandidates = result.filtered;
    list.innerHTML = "";

    // Show number of matching candidates
    const message = document.createElement("p");
    message.innerHTML = `<strong>✅ ${latestFilteredCandidates.length} candidates passed AI filtering.</strong>`;
    list.appendChild(message);

    // Render filtered candidates or show "no results" message
    if (latestFilteredCandidates.length === 0) {
      const noResult = document.createElement("li");
      noResult.textContent = "No candidates match the criteria.";
      list.appendChild(noResult);
    } else {
      latestFilteredCandidates.forEach((candidate) => {
        const item = document.createElement("li");
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
        deleteBtn.onclick = () => deleteFilteredCandidate(candidate.id);
        item.appendChild(deleteBtn);

        list.appendChild(item);
      });
    }

    filteredSection.style.display = "block";
    closeModal(modal);
  } catch (err) {
    console.error("Error filtering candidates:", err);
    alert("❌ Failed to filter candidates.");
  }
}

/**
 * Deletes a filtered candidate and updates the filtered list
 * @param {string} id - ID of the candidate to delete
 */
async function deleteFilteredCandidate(id) {
  if (!confirm("Are you sure you want to delete this candidate?")) return;

  try {
    const response = await fetch(`/delete-filtered/${id}`, {
      method: "DELETE",
    });
    const result = await response.json();

    if (!response.ok) throw new Error();

    alert(result.message || "🗑️ Candidate deleted.");

    // Remove the deleted candidate from the local list
    latestFilteredCandidates = latestFilteredCandidates.filter(
      (c) => c.id !== id
    );

    // Update the list in the DOM
    const list = document.getElementById("filtered-candidate-list");
    list.innerHTML = "";

    if (latestFilteredCandidates.length === 0) {
      const noResult = document.createElement("li");
      noResult.textContent = "No candidates match the criteria.";
      list.appendChild(noResult);
    } else {
      latestFilteredCandidates.forEach((candidate) => {
        const item = document.createElement("li");
        item.innerHTML = `
          <strong>Name:</strong> ${candidate.name}<br />
          <strong>Email:</strong> ${candidate.email}<br />
          <strong>Position:</strong> ${candidate.position}<br />
          <strong>Experience:</strong> ${candidate.experience} years<br />
          <strong>CV:</strong> <a href="${candidate.pathCV}" target="_blank">Open CV</a><hr />
        `;
        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "🗑️ Delete";
        deleteBtn.onclick = () => deleteFilteredCandidate(candidate.id);
        item.appendChild(deleteBtn);
        list.appendChild(item);
      });
    }
  } catch (err) {
    console.error("Error deleting filtered candidate:", err);
    alert("❌ Failed to delete candidate.");
  }
}
