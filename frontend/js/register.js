(function () {
  if (Auth.isLoggedIn()) {
    window.location.href =
      Auth.getRole() === "faculty" ? "faculty-dashboard.html" : "student-dashboard.html";
    return;
  }

  const tabStudent = document.getElementById("tab-student");
  const tabFaculty = document.getElementById("tab-faculty");
  const studentForm = document.getElementById("student-form");
  const facultyForm = document.getElementById("faculty-form");
  const errorBox = document.getElementById("error-box");

  function setRole(role) {
    tabStudent.classList.toggle("active", role === "student");
    tabFaculty.classList.toggle("active", role === "faculty");
    studentForm.classList.toggle("hidden", role !== "student");
    facultyForm.classList.toggle("hidden", role !== "faculty");
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

  studentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();

    const name = document.getElementById("s-name").value.trim();
    const registration_number = document.getElementById("s-reg").value.trim();
    const password = document.getElementById("s-password").value;

    const submitBtn = studentForm.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    submitBtn.textContent = "Creating account…";

    try {
      const data = await apiRequest("/api/auth/register/student", {
        method: "POST",
        auth: false,
        body: { name, registration_number, password },
      });
      Auth.setSession(data);
      window.location.href = "student-dashboard.html";
    } catch (err) {
      showError(err.message || "Could not create account.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Create student account";
    }
  });

  facultyForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();

    const name = document.getElementById("f-name").value.trim();
    const faculty_id = document.getElementById("f-id").value.trim();
    const department = document.getElementById("f-dept").value.trim();
    const building = document.getElementById("f-building").value.trim();
    const cabin = document.getElementById("f-cabin").value.trim();
    const password = document.getElementById("f-password").value;

    const submitBtn = facultyForm.querySelector("button[type=submit]");
    submitBtn.disabled = true;
    submitBtn.textContent = "Creating account…";

    try {
      const data = await apiRequest("/api/auth/register/faculty", {
        method: "POST",
        auth: false,
        body: { name, faculty_id, department, building, cabin, password },
      });
      Auth.setSession(data);
      window.location.href = "faculty-dashboard.html";
    } catch (err) {
      showError(err.message || "Could not create account.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Create faculty account";
    }
  });
})();
