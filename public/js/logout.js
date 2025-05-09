const logoutBtn = document.getElementById("logout-btn");

logoutBtn.addEventListener("click", () => {
  alert("You have been logged out successfully!");

  localStorage.removeItem("token");

  window.location.href = "/signin";
});
