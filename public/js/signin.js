const signinForm = document.getElementById("signin-form");

signinForm.addEventListener("submit", (e) => {
  e.preventDefault();
  submitSigninForm();
});

async function submitSigninForm() {
  const email = document.getElementById("signin-email").value;
  const password = document.getElementById("signin-password").value;

  if (!email || !password) {
    document.getElementById("error-message").innerText =
      "All fields are required!";
    document.getElementById("error-message").style.display = "block";
    return;
  }

  const userData = { email, password };

  try {
    const response = await fetch("/api/signin", {
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
      alert(`❌ Signin failed!`);
      document.getElementById("error-message").innerText = "Signin failed!";
      document.getElementById("error-message").style.display = "block";
    }
  } catch (err) {
    console.error("[client:auth] ❌ SignIn failed:", err.message);
    document.getElementById("error-message").innerText =
      "An error occurred during registration.";
    document.getElementById("error-message").style.display = "block";
  }
}
