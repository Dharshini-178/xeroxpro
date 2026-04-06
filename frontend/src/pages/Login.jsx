import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();

  const handleLogin = async () => {
  const role = document.getElementById("role").value;
  const id = document.querySelector("input[placeholder='User ID / Admin ID']").value;
  const password = document.querySelector("input[type='password']").value;

  if (!id || !password) {
    alert("Please enter ID and password");
    return;
  }

  try {
    const res = await fetch("https://photocopy-backend-isnx.onrender.com/api/users/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id, password, role }),
    });

    const data = await res.json();

    if (res.ok) {
      navigate(role === "staff" ? "/user" : "/admin");
    } else {
      alert(data.error || "Login failed");
    }
  } catch (err) {
    console.error(err);
    alert("Server error");
  }
};

  return (
    <div className="center">
      <div className="login-card">
        <h1>Xerox Portal</h1>
        <p>College Print Management System</p>

        <label>Login As</label>
        <select id="role">
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>

        <input placeholder="User ID / Admin ID" />
        <input type="password" placeholder="Password" />

        <button onClick={handleLogin}>Login</button>
      </div>
    </div>
  );
}
