// Modal controls
function openModal(modal) {
  if (modal) {
    modal.classList.add("active");
  }
}

function closeModal(modal) {
  if (modal) {
    modal.classList.remove("active");
  }
}

document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => {
    closeModal(document.getElementById("form-modal"));
    closeModal(document.getElementById("filter-modal"));
    closeModal(document.getElementById("edit-candidate-modal"));
    closeModal(document.getElementById("edit-interview-modal"));
  });
});

window.addEventListener("click", (e) => {
  if (
    [
      "form-modal",
      "filter-modal",
      "edit-candidate-modal",
      "edit-interview-modal",
    ].includes(e.target.id)
  ) {
    closeModal(e.target);
  }
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal(document.getElementById("form-modal"));
    closeModal(document.getElementById("filter-modal"));
    closeModal(document.getElementById("edit-candidate-modal"));
    closeModal(document.getElementById("edit-interview-modal"));
  }
});
