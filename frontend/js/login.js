(function () {
  if (Auth.isLoggedIn()) {
    window.location.href =
      Auth.getRole() === "faculty" ? "faculty-dashboard.html" : "student-dashboard.html";
    return;
  }

  let currentRole = "student";

  const tabStudent = document.getElementById("tab-student");
  const tabFaculty = document.getElementById("tab-faculty");
  const identifierLabel = document.getElementById("identifier-label");
  const identifierInput = document.getElementById("identifier");
  const errorBox = document.getElementById("error-box");
  const form = document.getElementById("login-form");
  const submitBtn = document.getElementById("submit-btn");

  function setRole(role) {
    currentRole = role;
    tabStudent.classList.toggle("active", role === "student");
    tabFaculty.classList.toggle("active", role === "faculty");
    identifierLabel.textContent = role === "student" ? "Registration Number" : "Faculty ID";
    identifierInput.placeholder = role === "student" ? "e.g. 23BCS001" : "e.g. FAC001";
    hideError();
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.add("show");
  }

  function hideError() {
    errorBox.classList.remove("show");
  }

  tabStudent.addEventListener("click", () => setRole("student"));
  tabFaculty.addEventListener("click", () => setRole("faculty"));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();

    const identifier = identifierInput.value.trim();
    const password = document.getElementById("password").value;

    if (!identifier || !password) {
      showError("Please fill in all fields.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Logging in…";

    try {
      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        auth: false,
        body: { role: currentRole, identifier, password },
      });
      Auth.setSession(data);
      window.location.href =
        data.role === "faculty" ? "faculty-dashboard.html" : "student-dashboard.html";
    } catch (err) {
      showError(err.message || "Login failed. Please check your credentials.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Log in";
    }
  });
})();
