const logoutBtn = document.getElementById("logout-btn");

logoutBtn.addEventListener("click", () => {
  if (!confirm("Are you sure you want to logout?")) return;
  alert("You have been logged out successfully!");

  localStorage.removeItem("token");
  localStorage.removeItem("name");

  window.location.href = "/signin";
});
