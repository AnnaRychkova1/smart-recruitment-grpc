const signupForm = document.getElementById("signup-form");

signupForm.addEventListener("submit", (e) => {
  e.preventDefault();
  submitSignupForm();
});

async function submitSignupForm() {
  const name = document.getElementById("signup-name").value;
  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;

  if (!name || !email || !password) {
    document.getElementById("error-message").innerText =
      "All fields are required!";
    document.getElementById("error-message").style.display = "block";
    return;
  }

  const userData = { name, email, password };

  try {
    const response = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });

    if (response.ok) {
      const { name, token } = await response.json();

      localStorage.setItem("token", token);
      localStorage.setItem("name", name);

      alert(`Welcome to Smart Recruitment, ${name}!`);
      window.location.href = "/";
    } else {
      alert(`❌ Signup failed!`);
      document.getElementById("error-message").innerText = "Signup failed!";
      document.getElementById("error-message").style.display = "block";
    }
  } catch (err) {
    console.error("[client:auth] ❌ SignUp failed:", err.message);
    document.getElementById("error-message").innerText =
      "An error occurred during registration.";
    document.getElementById("error-message").style.display = "block";
  }
}
