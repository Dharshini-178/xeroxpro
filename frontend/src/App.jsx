import { useState, useEffect } from "react";
import "./index.css";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);
const isLocalDevelopment =
  typeof window !== "undefined" && LOCAL_HOSTNAMES.has(window.location.hostname);
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/$/, "");
const API_URL =
  configuredApiUrl ||
  (isLocalDevelopment ? "http://localhost:5000/api" : `${window.location.origin}/api`);
const canUseLocalFallback = isLocalDevelopment;

const getStoredUsers = () => {
  try {
    return JSON.parse(localStorage.getItem("users")) || [];
  } catch {
    return [];
  }
};

const saveStoredUsers = (users) => {
  localStorage.setItem("users", JSON.stringify(users));
};

const upsertStoredUser = (user) => {
  const users = getStoredUsers();
  const existingIndex = users.findIndex(
    (storedUser) => storedUser.id === user.id || storedUser.email === user.email
  );

  if (existingIndex >= 0) {
    users[existingIndex] = { ...users[existingIndex], ...user };
  } else {
    users.push(user);
  }

  saveStoredUsers(users);
};

const updateStoredUserPassword = (userId, password) => {
  const users = getStoredUsers();
  const updatedUsers = users.map((user) =>
    user.id === userId ? { ...user, password } : user
  );
  const userWasUpdated = updatedUsers.some((user) => user.id === userId && user.password === password);

  if (userWasUpdated) {
    saveStoredUsers(updatedUsers);
  }

  return userWasUpdated;
};

const formatJoinedDate = (dateValue) => {
  if (!dateValue) {
    return "Not available";
  }

  const parsedDate = new Date(dateValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Not available";
  }

  return parsedDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const parseAppDate = (dateValue) => {
  if (!dateValue) {
    return null;
  }

  if (dateValue instanceof Date) {
    return Number.isNaN(dateValue.getTime()) ? null : dateValue;
  }

  if (typeof dateValue === "string" && dateValue.includes("/")) {
    const [day, month, year] = dateValue.split("/");
    const parsedDate = new Date(`${year}-${month}-${day}`);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  const parsedDate = new Date(dateValue);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const formatDateAsDDMMYYYY = (dateValue) => {
  const parsedDate = parseAppDate(dateValue);

  if (!parsedDate) {
    return "-";
  }

  return parsedDate.toLocaleDateString("en-GB");
};

const getHistorySortValue = (item) => {
  const createdDate = parseAppDate(item?.created_at || item?.createdAt);

  if (createdDate) {
    return createdDate.getTime();
  }

  const dateValue = parseAppDate(item?.date);

  if (dateValue) {
    return dateValue.getTime();
  }

  return 0;
};

export default function App() {
  const [page, setPage] = useState("login");
  const [role, setRole] = useState("staff");
  const [currentUser, setCurrentUser] = useState(null);

  return (
    <>
      {page === "login" && (
        <Login setPage={setPage} role={role} setRole={setRole} setCurrentUser={setCurrentUser} />
      )}

      {page === "register" && <Register setPage={setPage} />}

      {page === "staff" && <StaffDashboard setPage={setPage} currentUser={currentUser} />}

      {page === "admin" && <AdminDashboard setPage={setPage} />}
    </>
  );
}

/* ---------- LOGIN ---------- */

function Login({ setPage, role, setRole, setCurrentUser }) {
  const [id, setId] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!id || !pass) {
      setError("Please enter both ID and Password");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password: pass, role }),
      });

      const data = await response.json();

      if (data.success) {
        setCurrentUser(data.user);
        setPage(role);
      } else {
        setError("❌ " + (data.error || "Invalid ID or Password"));
      }
    } catch (err) {
      // Fallback: Check for hardcoded admin credentials first
      if (role === "admin" && id === "admin" && pass === "admin123") {
        setCurrentUser({ 
          id: "admin", 
          name: "Admin", 
          email: "admin@xerox.com", 
          department: "Admin",
          role: "admin"
        });
        setPage("admin");
        setLoading(false);
        return;
      }

      if (!canUseLocalFallback) {
        setError("Unable to reach the server. Please try again.");
        return;
      }
      
      // Check localStorage for registered staff users
      const users = getStoredUsers();
      const user = users.find(u => u.id === id || u.username === id);
      
      if (user && user.password === pass) {
        if (role === "staff") {
          setCurrentUser({ 
            id: user.id, 
            name: user.username, 
            username: user.username,
            email: user.email, 
            phone: user.phone, 
            department: user.department || "ECE",
            createdAt: user.createdAt || user.created_at,
          });
          setPage("staff");
        } else {
          setError("❌ Invalid ID or Password");
        }
      } else {
        if (role === "admin") {
          setError("❌ Invalid Admin ID or Password. Use: admin / admin123");
        } else {
          setError("❌ Invalid ID or Password. Please register first.");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg">
      <div className="login-card">

        <div className="role-switch">
          <button
            className={`role-btn ${role === "staff" ? "active" : ""}`}
            onClick={() => {
              setRole("staff");
              setError("");
            }}
          >
            👔 Staff
          </button>

          <button
            className={`role-btn ${role === "admin" ? "active" : ""}`}
            onClick={() => {
              setRole("admin");
              setError("");
            }}
          >
            🛠 Admin
          </button>
        </div>

        <h2>{role === "staff" ? "Staff Login" : "Admin Login"}</h2>

        <div className="input-group">
          <div className="input-icon">👤</div>
          <input
            className="login-input"
            placeholder="ID"
            value={id}
            onChange={(e) => {
              setId(e.target.value);
              setError("");
            }}
          />
        </div>

        <div className="input-group">
          <div className="input-icon">🔒</div>
          <input
            className="login-input"
            type="password"
            placeholder="Password"
            value={pass}
            onChange={(e) => {
              setPass(e.target.value);
              setError("");
            }}
          />
        </div>

        {error && <div className="error-text">{error}</div>}

        <button className="login-btn" onClick={handleLogin}>
          Login
        </button>

        {role === "staff" && (
          <p className="register-link">
            New user? <span onClick={() => setPage("register")}>Register</span>
          </p>
        )}

      </div>
    </div>
  );
}

/* ---------- REGISTER ---------- */

function Register({ setPage }) {
  const [staffId, setStaffId] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!staffId || !email || !username || !password || !phone) {
      setError("All fields are required");
      return;
    }

    if (!email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    if (phone.length !== 10 || isNaN(phone)) {
      setError("Please enter a valid 10-digit phone number");
      return;
    }

    if (password.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }

    setLoading(true);
    setError("");
    const registeredAt = new Date().toISOString();

    try {
      const response = await fetch(`${API_URL}/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: staffId, username, email, password, phone }),
      });

      const data = await response.json();

      if (response.ok) {
        if (canUseLocalFallback) {
          upsertStoredUser({
            id: staffId,
            username,
            email,
            password,
            phone,
            department: "ECE",
            createdAt: registeredAt,
          });
        }

        setSuccess(true);
        setTimeout(() => {
          setPage("login");
        }, 2000);
      } else {
        setError(data.error || "Registration failed");
      }
    } catch (err) {
      if (!canUseLocalFallback) {
        setError("Unable to reach the server. Please try again.");
        return;
      }

      // Fallback to localStorage if backend is not available
      console.log("Backend not available, using localStorage");
      const users = getStoredUsers();
      
      if (users.find(u => u.email === email)) {
        setError("Email already registered");
        setLoading(false);
        return;
      }

      if (users.find(u => u.id === staffId)) {
        setError("Staff ID already exists. Please use a different Staff ID.");
        setLoading(false);
        return;
      }

      // Use user-provided Staff ID
      users.push({
        id: staffId,
        username,
        email,
        password,
        phone,
        department: "ECE",
        createdAt: registeredAt,
      });
      saveStoredUsers(users);
      
      setSuccess(true);
      setTimeout(() => {
        setPage("login");
      }, 2000);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="login-bg">
        <div className="login-card">
          <div className="success-message">
            <h2>✅ Registration Successful!</h2>
            <p>Your Staff ID: {staffId}</p>
            <p>Please login with this ID.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-bg">
      <div className="login-card">
        <h2 className="register-title">Create your account</h2>

        <div className="input-group">
          <div className="input-icon">🆔</div>
          <input
            className="login-input"
            type="text"
            placeholder="Staff ID"
            value={staffId}
            onChange={(e) => {
              setStaffId(e.target.value);
              setError("");
            }}
          />
        </div>

        <div className="input-group">
          <div className="input-icon">👤</div>
          <input
            className="login-input"
            placeholder="Username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError("");
            }}
          />
        </div>

        <div className="input-group">
          <div className="input-icon">📧</div>
          <input
            className="login-input"
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
          />
        </div>

        <div className="input-group">
          <div className="input-icon">🔒</div>
          <input
            className="login-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
          />
        </div>

        <div className="input-group">
          <div className="input-icon">📱</div>
          <input
            className="login-input"
            type="tel"
            placeholder="Phone Number"
            value={phone}
            maxLength={10}
            onChange={(e) => {
              setPhone(e.target.value);
              setError("");
            }}
          />
        </div>

        {error && <div className="error-text">{error}</div>}

        <button className="login-btn" onClick={handleRegister}>
          Register
        </button>

        <p className="register-link">
          Already have an account? <span onClick={() => setPage("login")}>Login</span>
        </p>
      </div>
    </div>
  );
}

/* ---------- STAFF DASHBOARD ---------- */

function StaffDashboard({ setPage, currentUser }) {
  const [selectedOption, setSelectedOption] = useState("profile");
  const [file, setFile] = useState(null);
  const [filePageCount, setFilePageCount] = useState(0);
  const [color, setColor] = useState("bw");
  const [copies, setCopies] = useState(1);
  const [pages, setPages] = useState(1);
  const [orientation, setOrientation] = useState("vertical");
  const [printType, setPrintType] = useState("single-side");
  const [submitted, setSubmitted] = useState(false);
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  
  // Paper request states
  const [paperType, setPaperType] = useState("");
  const [paperQuantity, setPaperQuantity] = useState(1);
  const [paperSubmitted, setPaperSubmitted] = useState(false);

  // Change password states
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Profile edit states
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(currentUser?.name || "");
  const [editEmail, setEditEmail] = useState(currentUser?.email || "");
  const [editPhone, setEditPhone] = useState(currentUser?.phone || "");
  const [editDepartment, setEditDepartment] = useState(currentUser?.department || "ECE");
  const joinedDate = formatJoinedDate(currentUser?.created_at || currentUser?.createdAt);

  const userId = currentUser?.id;

  // Load staff's print jobs from API or localStorage
  const [staffPrintJobs, setStaffPrintJobs] = useState([]);
  const [staffPaperRequests, setStaffPaperRequests] = useState([]);

  // Fetch staff data from backend
  const fetchStaffData = async () => {
    try {
      const [jobsRes, paperRes] = await Promise.all([
        fetch(`${API_URL}/print-jobs/user/${userId}`),
        fetch(`${API_URL}/paper-requests/user/${userId}`)
      ]);
      
      const jobsData = await jobsRes.json();
      const paperData = await paperRes.json();
      
      setStaffPrintJobs(jobsData);
      setStaffPaperRequests(paperData);
    } catch (err) {
      if (canUseLocalFallback) {
        const allJobs = JSON.parse(localStorage.getItem("printJobs")) || [];
        setStaffPrintJobs(allJobs.filter(job => job.userId === userId));
        const allRequests = JSON.parse(localStorage.getItem("paperRequests")) || [];
        setStaffPaperRequests(allRequests.filter(req => req.userId === userId));
        return;
      }

      setStaffPrintJobs([]);
      setStaffPaperRequests([]);
    }
  };

  // Load data on mount
  useEffect(() => {
    fetchStaffData();
  }, [userId]);

  // Refresh staff data
  const refreshStaffData = () => {
    fetchStaffData();
  };

  // Save profile changes
  const saveProfile = () => {
    setIsEditing(false);
  };

  // Cancel profile edit
  const cancelEdit = () => {
    setEditName(currentUser?.name || "");
    setEditEmail(currentUser?.email || "");
    setEditPhone(currentUser?.phone || "");
    setEditDepartment(currentUser?.department || "ECE");
    setIsEditing(false);
  };

  // Function to auto-print the uploaded document
  const printDocument = (fileToPrint, printOrientation, printColor) => {
    const fileURL = URL.createObjectURL(fileToPrint);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    iframe.onload = () => {
      try {
        const style = iframe.contentDocument.createElement('style');
        style.textContent = `
          @page {
            size: ${printOrientation === 'horizontal' ? 'landscape' : 'portrait'};
            margin: 0.5cm;
          }
          body {
            margin: 0;
            ${printColor === 'bw' ? 'filter: grayscale(100%);' : ''}
          }
          img, embed, object { width: 100%; height: auto; }
        `;
        iframe.contentDocument.head.appendChild(style);
        setTimeout(() => {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          setTimeout(() => {
            document.body.removeChild(iframe);
            URL.revokeObjectURL(fileURL);
          }, 5000);
        }, 500);
      } catch (e) {
        // Fallback: open in new tab for manual print
        window.open(fileURL, '_blank');
        document.body.removeChild(iframe);
      }
    };

    iframe.src = fileURL;
  };

  // Function to get PDF page count
  const getPDFPageCount = async (file) => {
    try {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
      
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      return pdf.numPages;
    } catch (err) {
      console.error("Error reading PDF:", err);
      return 1;
    }
  };

  // Handle file upload with page count detection
  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setIsLoadingPages(true);
      
      if (selectedFile.type === "application/pdf") {
        const pageCount = await getPDFPageCount(selectedFile);
        setFilePageCount(pageCount);
        setPages(pageCount);
      } else {
        setFilePageCount(1);
        setPages(1);
      }
      setIsLoadingPages(false);
    }
  };

  if (submitted) {
    return (
      <div className="dashboard-bg">
        <div className="staff-layout">
          <div className="staff-sidebar">
            <div className="sidebar-profile">
              <div className="sidebar-avatar">👤</div>
              <h3>{editName}</h3>
              <p>Staff ID: {userId}</p>
            </div>
            <div className="sidebar-menu">
              <button className="menu-item" onClick={() => { setSelectedOption("profile"); setSubmitted(false); }}>
                <span className="menu-icon">👤</span> Profile
              </button>
              <button className="menu-item" onClick={() => { setSelectedOption("printing"); setSubmitted(false); }}>
                <span className="menu-icon">🖨</span> Printing
              </button>
              <button className="menu-item" onClick={() => { setSelectedOption("paper"); setSubmitted(false); }}>
                <span className="menu-icon">📄</span> Paper Request
              </button>
              <button className="menu-item" onClick={() => { setSelectedOption("printHistory"); refreshStaffData(); }}>
                <span className="menu-icon">🖨</span> Print History
              </button>
              <button className="menu-item" onClick={() => { setSelectedOption("paperHistory"); refreshStaffData(); }}>
                <span className="menu-icon">📄</span> Paper History
              </button>
            </div>
          <button className="sidebar-logout" onClick={() => setPage("login")}>
            🚪 Logout
          </button>
          
            <button className="sidebar-print" onClick={() => window.print()}>
            🖨️ Print
          </button>
        </div>
          <div className="staff-content">
            <div className="content-header">
              <h2>✅ Order Submitted</h2>
              <p>Your document has been sent for printing.</p>
            </div>
            <div className="profile-section">
              <div className="profile-info">
                <div className="profile-field">
                  <label>Print Type</label>
                  <span>{printType === "single-side" ? "Single Side" : "Front and Back"}</span>
                </div>
                <div className="profile-field">
                  <label>Orientation</label>
                  <span>{orientation === "vertical" ? "Vertical" : "Horizontal"}</span>
                </div>
                <div className="profile-field">
                  <label>Color</label>
                  <span>{color === "bw" ? "Black & White" : "Color"}</span>
                </div>
                <div className="profile-field">
                  <label>Copies</label>
                  <span>{copies}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (paperSubmitted) {
    return (
      <div className="dashboard-bg">
        <div className="staff-layout">
          <div className="staff-sidebar">
            <div className="sidebar-profile">
              <div className="sidebar-avatar">👤</div>
              <h3>{editName}</h3>
              <p>Staff ID: {userId}</p>
            </div>
            <div className="sidebar-menu">
              <button className="menu-item" onClick={() => { setSelectedOption("profile"); setPaperSubmitted(false); }}>
                <span className="menu-icon">👤</span> Profile
              </button>
              <button className="menu-item" onClick={() => { setSelectedOption("printing"); setPaperSubmitted(false); }}>
                <span className="menu-icon">🖨</span> Printing
              </button>
              <button className="menu-item" onClick={() => { setSelectedOption("paper"); setPaperSubmitted(false); }}>
                <span className="menu-icon">📄</span> Paper Request
              </button>
              <button className="menu-item" onClick={() => { setSelectedOption("printHistory"); refreshStaffData(); }}>
                <span className="menu-icon">🖨</span> Print History
              </button>
              <button className="menu-item" onClick={() => { setSelectedOption("paperHistory"); refreshStaffData(); }}>
                <span className="menu-icon">📄</span> Paper History
              </button>
            </div>
            <button className="sidebar-logout" onClick={() => setPage("login")}>
              🚪 Logout
            </button>
          </div>
          <div className="staff-content">
            <div className="content-header">
              <h2>✅ Paper Request Submitted</h2>
              <p>Your paper request has been sent to admin.</p>
            </div>
            <div className="profile-section">
              <div className="profile-info">
                <div className="profile-field">
                  <label>Paper Type</label>
                  <span>{paperType}</span>
                </div>
                <div className="profile-field">
                  <label>Quantity</label>
<span>{paperQuantity} papers</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-bg">
      <div className="staff-layout">
        {/* Left Sidebar - 30% */}
        <div className="staff-sidebar">
          <div className="sidebar-profile">
            <div className="sidebar-avatar">👤</div>
            <h3>{editName}</h3>
            <p>Staff ID: {userId}</p>
          </div>
          
          <div className="sidebar-menu">
            <button 
              className={`menu-item ${selectedOption === "profile" ? "active" : ""}`}
              onClick={() => setSelectedOption("profile")}
            >
              <span className="menu-icon">👤</span> Profile
            </button>
            
                <button
                  className={`menu-item ${selectedOption === "printing" ? "active" : ""}`}
                  onClick={() => {
                    if (window.printerBlocked) {
                      alert("🖨 Printer is blocked. Please try again after some time.");
                      return;
                    }
                    setSelectedOption("printing");
                  }}
                >
                  <span className="menu-icon">🖨</span> Printing
                </button>
            
            <button 
              className={`menu-item ${selectedOption === "paper" ? "active" : ""}`}
              onClick={() => setSelectedOption("paper")}
            >
              <span className="menu-icon">📄</span> Paper Request
            </button>
            
            <button 
              className={`menu-item ${selectedOption === "printHistory" ? "active" : ""}`}
              onClick={() => { setSelectedOption("printHistory"); refreshStaffData(); }}
            >
              <span className="menu-icon">🖨</span> Print History
            </button>
            
            <button 
              className={`menu-item ${selectedOption === "paperHistory" ? "active" : ""}`}
              onClick={() => { setSelectedOption("paperHistory"); refreshStaffData(); }}
            >
              <span className="menu-icon">📄</span> Paper History
            </button>
          </div>

          <button className="sidebar-logout" onClick={() => setPage("login")}>
            🚪 Logout
          </button>
        </div>

        {/* Right Content Area - 70% */}
        <div className="staff-content">
          {selectedOption === "profile" && (
            <>
              <div className="content-header-with-action">
                <div>
                  <h2>👤 My Profile</h2>
                  <p>View your staff information</p>
                </div>
                {isEditing ? (
                  <div className="edit-actions">
                    <button className="save-btn" onClick={saveProfile}>💾 Save</button>
                    <button className="cancel-btn" onClick={cancelEdit}>✖ Cancel</button>
                  </div>
                ) : (
                  <button className="edit-icon-btn" onClick={() => setIsEditing(true)}>
                    ✏️
                  </button>
                )}
              </div>
              <div className="profile-section">
                <div className="profile-info">
                  <div className="profile-field">
                    <label>Staff ID</label>
                    <span>{userId}</span>
                  </div>
                  <div className="profile-field">
                    <label>Name</label>
                    {isEditing ? (
                      <input 
                        type="text" 
                        value={editName} 
                        onChange={(e) => setEditName(e.target.value)}
                        className="profile-edit-input"
                      />
                    ) : (
                      <span>{editName}</span>
                    )}
                  </div>
                  <div className="profile-field">
                    <label>Email</label>
                    {isEditing ? (
                      <input 
                        type="email" 
                        value={editEmail} 
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="profile-edit-input"
                      />
                    ) : (
                      <span>{editEmail}</span>
                    )}
                  </div>
                  <div className="profile-field">
                    <label>Phone Number</label>
                    {isEditing ? (
                      <input 
                        type="tel" 
                        value={editPhone} 
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="profile-edit-input"
                        maxLength={10}
                      />
                    ) : (
                      <span>{editPhone}</span>
                    )}
                  </div>
                  <div className="profile-field">
                    <label>Department</label>
                    {isEditing ? (
                      <select 
                        value={editDepartment} 
                        onChange={(e) => setEditDepartment(e.target.value)}
                        className="profile-edit-select"
                      >
                        <option value="ECE">ECE</option>
                        <option value="CSE">CSE</option>
                        <option value="IT">IT</option>
                        <option value="MECH">MECH</option>
                        <option value="CIVIL">CIVIL</option>
                        <option value="EEE">EEE</option>
                      </select>
                    ) : (
                      <span>{editDepartment}</span>
                    )}
                  </div>
                  <div className="profile-field">
                    <label>Joined Date</label>
                    <span>{joinedDate}</span>
                  </div>
                </div>
                <div className="profile-actions">
                  <span className="change-password-link" onClick={() => setShowChangePassword(true)}>🔐 Change Password</span>
                </div>
              </div>

              {/* Change Password Popup */}
              {showChangePassword && (
                <div className="popup-overlay" onClick={() => setShowChangePassword(false)}>
                  <div className="popup-content" onClick={(e) => e.stopPropagation()}>
                    <h3>Change Password</h3>
                    <div className="popup-input-group">
                      <input
                        type="password"
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          setPasswordError("");
                        }}
                      />
                    </div>
                    {passwordError && <div className="popup-error">{passwordError}</div>}
                    {passwordSuccess && <div className="popup-success">Password changed successfully!</div>}
                    <div className="popup-buttons">
                      <button 
                        className="popup-cancel" 
                        onClick={() => {
                          setShowChangePassword(false);
                          setNewPassword("");
                          setPasswordError("");
                          setPasswordSuccess(false);
                        }}
                      >
                        Cancel
                      </button>
                      <button 
                        className="popup-submit"
                        onClick={async () => {
                          if (!newPassword || newPassword.length < 4) {
                            setPasswordError("Password must be at least 4 characters");
                            return;
                          }

                          let passwordUpdated = false;

                          try {
                            const response = await fetch(`${API_URL}/users/${userId}/password`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ password: newPassword }),
                            });

                            if (!response.ok) {
                              throw new Error("Failed to update password");
                            }
                            passwordUpdated = true;
                          } catch (error) {
                            passwordUpdated = false;
                          }

                          const storedPasswordUpdated = canUseLocalFallback
                            ? updateStoredUserPassword(userId, newPassword)
                            : false;

                          if (!passwordUpdated && !storedPasswordUpdated) {
                            setPasswordError("Failed to update password. Please try again.");
                            return;
                          }

                          setPasswordSuccess(true);

                          setTimeout(() => {
                            setShowChangePassword(false);
                            setNewPassword("");
                            setPasswordError("");
                            setPasswordSuccess(false);
                          }, 2000);
                        }}

                      >
                        Submit
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {selectedOption === "printing" && (
            <>
              <div className="content-header">
                <h2>🖨 Print Request</h2>
                <p>Upload & configure your print</p>
              </div>
              <div className="print-section">
                {/* Upload */}
                <div className="upload-box">
                  <input
                    type="file"
                    id="fileUpload"
                    hidden
                    onChange={handleFileUpload}
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  />
                  <label htmlFor="fileUpload" className="upload-label">
                    📄 {file ? (file.name + (filePageCount > 0 ? ` (${filePageCount} pages)` : "")) : "Click to upload document"}
                  </label>
                  {isLoadingPages && <span className="loading-text">Reading document...</span>}
                  </div>
                {/* Print Options */}
                <div className="print-options-grid">
                  <div className="option">
                    <label>Color</label>
                    <select value={color} onChange={(e) => setColor(e.target.value)}>
                      <option value="bw">Black & White</option>
                      <option value="color">Color</option>
                    </select>
                  </div>

                  <div className="option">
                    <label>Print Type</label>
                    <select value={printType} onChange={(e) => setPrintType(e.target.value)}>
                      <option value="single-side">Single Side</option>
                      <option value="front-and-back">Front and Back</option>
                    </select>
                  </div>

                  <div className="option">
                    <label>Orientation</label>
                    <select
                      value={orientation}
                      onChange={(e) => setOrientation(e.target.value)}
                    >
                      <option value="vertical">Vertical (Portrait)</option>
                      <option value="horizontal">Horizontal (Landscape)</option>
                    </select>
                  </div>

                  <div className="option">
                    <label>No. of Copies</label>
                    <input
                      type="number"
                      min="1"
                      value={copies}
                      onChange={(e) => setCopies(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  className="print-btn"
                  disabled={!file}
                  onClick={async () => {
                    // Calculate total papers based on print type
                    const totalPapers = printType === "front-and-back" 
                      ? Math.ceil(filePageCount / 2) * copies 
                      : filePageCount * copies;

                    try {
                      const response = await fetch(`${API_URL}/print-jobs`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          userName: editName,
                          userId: userId,
                          printType: printType,
                          orientation: orientation,
                          color: color,
                          copies: copies,
                          pages: filePageCount,
                          totalPapers: totalPapers,
                          fileName: file.name
                        }),
                      });

                      if (!response.ok) {
                        throw new Error("Failed to submit print request");
                      }
                    } catch (err) {
                      if (!canUseLocalFallback) {
                        alert("Unable to submit print request. Please try again.");
                        return;
                      }

                      // Fallback to localStorage
                      const printJobs = JSON.parse(localStorage.getItem("printJobs")) || [];
                      const createdAt = new Date().toISOString();
                      printJobs.push({
                        userName: editName,
                        userId: userId,
                        printType: printType,
                        orientation: orientation,
                        color: color,
                        copies: copies,
                        pages: filePageCount,
                        totalPapers: totalPapers,
                        fileName: file.name,
                        date: new Date().toLocaleDateString('en-GB'),
                        createdAt,
                        status: "Pending"
                      });
                      localStorage.setItem("printJobs", JSON.stringify(printJobs));
                    }
                    // ✅ Auto-print the uploaded document
                    printDocument(file, orientation, color);
                    setSubmitted(true);
                  }}
                >
                  📤 Submit Print Request
                </button>
              </div>
            </>
          )}

          {selectedOption === "paper" && (
            <>
              <div className="content-header">
               <h2>📄 Paper Request</h2>
                <p>Request paper supplies</p>
              </div>
              <div className="paper-request-section">
                <div className="paper-type-grid">
                  <div 
                    className={`paper-type-card ${paperType === "A4" ? "selected" : ""}`}
                    onClick={() => setPaperType("A4")}
                  >
                    <div className="icon">📄</div>
                    <h4>A4 Paper</h4>
                    <p>Standard office paper</p>
                  </div>
                  <div 
                    className={`paper-type-card ${paperType === "Bond" ? "selected" : ""}`}
                    onClick={() => setPaperType("Bond")}
                  >
                    <div className="icon">📑</div>
                    <h4>Bond Paper</h4>
                    <p>High quality paper</p>
                  </div>
                </div>

                <div className="quantity-selector">
                  <label>Quantity (papers):</label>
                  <div className="quantity-controls">
                    <button 
                      className="quantity-btn"
                      onClick={() => setPaperQuantity(Math.max(1, paperQuantity - 1))}
                    >-</button>
                    <span className="quantity-value">{paperQuantity}</span>
                    <button 
                      className="quantity-btn"
                      onClick={() => setPaperQuantity(paperQuantity + 1)}
                    >+</button>
                  </div>
                </div>

                <button
                  className="submit-request-btn"
                  disabled={!paperType}
                  onClick={async () => {
                    try {
                      const response = await fetch(`${API_URL}/paper-requests`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          userName: editName,
                          userId: userId,
                          paperType: paperType,
                          quantity: paperQuantity
                        }),
                      });

                      if (!response.ok) {
                        throw new Error("Failed to submit paper request");
                      }
                    } catch (err) {
                      if (!canUseLocalFallback) {
                        alert("Unable to submit paper request. Please try again.");
                        return;
                      }

                      const paperRequests = JSON.parse(localStorage.getItem("paperRequests")) || [];
                      const createdAt = new Date().toISOString();
                      paperRequests.push({
                        userName: editName,
                        userId: userId,
                        paperType: paperType,
                        quantity: paperQuantity,
                        date: new Date().toLocaleDateString("en-GB"),
                        createdAt,
                        status: "Pending"
                      });
                      localStorage.setItem("paperRequests", JSON.stringify(paperRequests));
                    }
                    setPaperSubmitted(true);
                  }}
                >
                  📤 Submit Paper Request
                </button>
              </div>
            </>
          )}

{selectedOption === "printHistory" && (
            <>
              <div className="content-header">
                <h2>🖨 Print History</h2>
                <p>View your print request history</p>
              </div>
              <div className="history-section">
                {staffPrintJobs.length === 0 ? (
                  <div className="empty-state">
                    <p>No print jobs yet</p>
                  </div>
                ) : (
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Print Type</th>
                        <th>Copies</th>
                        <th>Pages</th>
                        <th>Total Papers</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffPrintJobs
                        .sort((a, b) => getHistorySortValue(b) - getHistorySortValue(a))
                        .map((job, index) => (
                        <tr key={index}>
                          <td>{job.printType === "single-side" ? "Single Side" : job.printType === "front-and-back" ? "Front and Back" : job.printType}</td>
                          <td>{job.copies || 1}</td>
                          <td>{job.pages || 1}</td>
                          <td>{job.totalPapers || ((job.copies || 1) * (job.pages || 1))}</td>
                          <td>{job.date || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

{selectedOption === "paperHistory" && (
            <>
              <div className="content-header">
                <h2>📄 Paper History</h2>
                <p>View your paper request history</p>
              </div>
              <div className="history-section">
                {staffPaperRequests.length === 0 ? (
                  <div className="empty-state">
                    <p>No paper requests yet</p>
                  </div>
                ) : (
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>Paper Type</th>
                        <th>Quantity</th>
                        <th>Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffPaperRequests
                        .sort((a, b) => getHistorySortValue(b) - getHistorySortValue(a))
                        .map((request, index) => (
                        <tr key={index}>
                          <td>{request.paperType || "A4"}</td>
                          <td>{request.quantity || 1} papers</td>
                          <td>{formatDateAsDDMMYYYY(request.date)}</td>
                          <td>
                            <span className={`status-badge ${(request.status || "pending").toLowerCase()}`}>
                              {request.status || "Pending"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


/* ---------- ADMIN DASHBOARD ---------- */

function AdminDashboard({ setPage }) {
  const [selectedOption, setSelectedOption] = useState("printHistory");
  const [printerStatus, setPrinterStatus] = useState("online");
  const [printerPaused, setPrinterPaused] = useState(false);
  const [printJobs, setPrintJobs] = useState([]);
  const [paperRequests, setPaperRequests] = useState([]);

  // Force re-render to refresh data
  const [, setTick] = useState(0);
  const refreshData = () => setTick(t => t + 1);

  const loadAdminData = async () => {
    try {
      const [printRes, paperRes] = await Promise.all([
        fetch(`${API_URL}/print-jobs`),
        fetch(`${API_URL}/paper-requests`),
      ]);

      if (!printRes.ok || !paperRes.ok) {
        throw new Error("Failed to load admin data");
      }

      const [printData, paperData] = await Promise.all([
        printRes.json(),
        paperRes.json(),
      ]);

      setPrintJobs(printData);
      setPaperRequests(paperData);
    } catch (error) {
      if (canUseLocalFallback) {
        const savedPrintJobs = localStorage.getItem("printJobs");
        const savedPaperRequests = localStorage.getItem("paperRequests");
        setPrintJobs(savedPrintJobs ? JSON.parse(savedPrintJobs) : []);
        setPaperRequests(savedPaperRequests ? JSON.parse(savedPaperRequests) : []);
        return;
      }

      setPrintJobs([]);
      setPaperRequests([]);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  // Handle option change with refresh
  const handleOptionChange = (option) => {
    setSelectedOption(option);
    loadAdminData();
  };

  // Approve paper request
  const approvePaperRequest = async (request) => {
    try {
      const response = await fetch(`${API_URL}/paper-requests/${request.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Approved" }),
      });

      if (!response.ok) {
        throw new Error("Failed to approve paper request");
      }

      loadAdminData();
    } catch (error) {
      if (!canUseLocalFallback) {
        alert("Unable to approve paper request. Please try again.");
        return;
      }

      const updated = [...paperRequests];
      const index = updated.findIndex((item) => item === request);

      if (index === -1) {
        return;
      }

      updated[index].status = "Approved";
      setPaperRequests(updated);
      localStorage.setItem("paperRequests", JSON.stringify(updated));
    }
  };

  // Reject paper request
  const rejectPaperRequest = async (request) => {
    try {
      const response = await fetch(`${API_URL}/paper-requests/${request.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Rejected" }),
      });

      if (!response.ok) {
        throw new Error("Failed to reject paper request");
      }

      loadAdminData();
    } catch (error) {
      if (!canUseLocalFallback) {
        alert("Unable to reject paper request. Please try again.");
        return;
      }

      const updated = [...paperRequests];
      const index = updated.findIndex((item) => item === request);

      if (index === -1) {
        return;
      }

      updated[index].status = "Rejected";
      setPaperRequests(updated);
      localStorage.setItem("paperRequests", JSON.stringify(updated));
    }
  };

  // Update print job status
  const updatePrintStatus = async (job, status) => {
    try {
      const response = await fetch(`${API_URL}/print-jobs/${job.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error("Failed to update print status");
      }

      loadAdminData();
    } catch (error) {
      if (!canUseLocalFallback) {
        alert("Unable to update print status. Please try again.");
        return;
      }

      const updated = [...printJobs];
      const index = updated.findIndex((item) => item === job);

      if (index === -1) {
        return;
      }

      updated[index].status = status;
      setPrintJobs(updated);
      localStorage.setItem("printJobs", JSON.stringify(updated));
    }
  };

  return (
    <div className="dashboard-bg">
      <div className="staff-layout">
        {/* Left Sidebar - 30% */}
        <div className="staff-sidebar">
          <div className="sidebar-profile">
            <div className="sidebar-avatar">⚙️</div>
            <h3>Admin</h3>
            <p>Administrator</p>
          </div>

          <div className="sidebar-menu">
            <button
              className={`menu-item ${selectedOption === "printHistory" ? "active" : ""}`}
              onClick={() => handleOptionChange("printHistory")}
            >
              <span className="menu-icon">🖨</span> Print History
            </button>

            <button
              className={`menu-item ${selectedOption === "paperHistory" ? "active" : ""}`}
              onClick={() => handleOptionChange("paperHistory")}
            >
              <span className="menu-icon">📄</span> Paper History
            </button>

            <button
              className={`menu-item ${selectedOption === "paperRequest" ? "active" : ""}`}
              onClick={() => handleOptionChange("paperRequest")}
            >
              <span className="menu-icon">📄</span> Paper Request
            </button>

            <button
              className={`menu-item ${selectedOption === "printControl" ? "active" : ""}`}
              onClick={() => handleOptionChange("printControl")}
            >
              <span className="menu-icon">⚙️</span> Print Control
            </button>
          </div>

          <button className="sidebar-logout" onClick={() => setPage("login")}>
            🚪 Logout
          </button>
        </div>

        {/* Right Content Area - 70% */}
        <div className="staff-content">
          {selectedOption === "printHistory" && (
            <>
              <div className="content-header">
                <h2>🖨 Print History</h2>
                <p>View all print requests from staff</p>
              </div>
              <div className="history-section">
                {printJobs.length === 0 ? (
                  <div className="empty-state">
                    <p>No print jobs yet</p>
                  </div>
                ) : (
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>User Name</th>
                        <th>Print Type</th>
                        <th>Copies</th>
                        <th>Pages</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {printJobs
                        .sort((a, b) => getHistorySortValue(b) - getHistorySortValue(a))
                        .map((job, index) => (
                        <tr key={index}>
                          <td>{job.userName || "Staff User"}</td>
                          <td>{job.printType === "single-side" ? "Single Side" : job.printType === "front-and-back" ? "Front and Back" : job.printType}</td>
                          <td>{job.copies || 1}</td>
                          <td>{job.pages || 1}</td>
                          <td>{job.date || new Date().toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {selectedOption === "paperHistory" && (
            <>
              <div className="content-header">
                <h2>📄 Paper History</h2>
                <p>View all paper requests from staff</p>
              </div>
              <div className="history-section">
                {paperRequests.length === 0 ? (
                  <div className="empty-state">
                    <p>No paper requests yet</p>
                  </div>
                ) : (
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>User Name</th>
                        <th>Paper Type</th>
                        <th>Quantity</th>
                        <th>Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paperRequests
                        .sort((a, b) => getHistorySortValue(b) - getHistorySortValue(a))
                        .map((request, index) => (
                        <tr key={index}>
                          <td>{request.userName || "Staff User"}</td>
                          <td>{request.paperType || "A4"}</td>
                          <td>{request.quantity || 1} papers</td>
                          <td>{request.date || new Date().toLocaleDateString()}</td>
                          <td>
                            <span className={`status-badge ${(request.status || "pending").toLowerCase()}`}>
                              {request.status || "Pending"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}

          {selectedOption === "paperRequest" && (
            <>
              <div className="content-header">
                <h2>📄 Paper Request</h2>
                <p>Approve or reject paper requests from staff</p>
              </div>
              <div className="paper-request-admin-section">
                {paperRequests.filter(req => !req.status || req.status === "Pending").length === 0 ? (
                  <div className="empty-state">
                    <p>No pending paper requests</p>
                  </div>
                ) : (
                  <div className="paper-requests-list">
                    {paperRequests
                      .filter(req => !req.status || req.status === "Pending")
                      .sort((a, b) => getHistorySortValue(b) - getHistorySortValue(a))
                      .map((request) => {
                        return (
                          <div
                            key={request.id || `${request.userId}-${request.paperType}-${request.date}`}
                            className="paper-request-card"
                          >
                            <div className="request-info">
                              <div className="request-field">
                                <label>User Name</label>
                                <span>{request.userName || "Staff User"}</span>
                              </div>
                              <div className="request-field">
                                <label>Paper Type</label>
                                <span>{request.paperType || "A4"}</span>
                              </div>
                              <div className="request-field">
                                <label>Quantity</label>
                                <span>{request.quantity || 1} papers</span>
                              </div>
                              <div className="request-field">
                                <label>Date</label>
                                <span>{request.date || new Date().toLocaleDateString()}</span>
                              </div>
                              <div className="request-field">
                                <label>Status</label>
                                <span className={`status-badge ${request.status?.toLowerCase() || "pending"}`}>
                                  {request.status || "Pending"}
                                </span>
                              </div>
                            </div>
                            <div className="request-actions">
                              {(request.status || "Pending") === "Pending" && (
                                <>
                                  <button
                                    className="approve-btn"
                                    onClick={() => {
                                      approvePaperRequest(request);
                                      refreshData();
                                    }}
                                  >
                                    ✓ Approve
                                  </button>
                                  <button
                                    className="reject-btn"
                                    onClick={() => {
                                      rejectPaperRequest(request);
                                      refreshData();
                                    }}
                                  >
                                    ✗ Reject
                                  </button>
                                </>
                              )}
                              {request.status === "Approved" && (
                                <span className="approved-text">✓ Approved</span>
                              )}
                              {request.status === "Rejected" && (
                                <span className="rejected-text">✗ Rejected</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </>
          )}

          {selectedOption === "printControl" && (
            <>
              <div className="content-header">
                <h2>⚙️ Print Control</h2>
                <p>Manage printing operations</p>
              </div>
              <div className="print-control-section">
                <div className="control-card">
                  <h3>Print Operations</h3>
                  <div className="operation-controls">
                    <div className="printer-state-buttons">
                      <button 
                        className={`printer-btn ${!printerPaused ? 'active' : ''}`}
                        onClick={() => {
                          setPrinterPaused(false);
                          window.printerBlocked = false;
                        }}
                      >
                        ✅ Unblock
                      </button>
                      <button 
                        className={`printer-btn ${printerPaused ? 'active' : ''}`}
                        onClick={() => {
                          setPrinterPaused(true);
                          window.printerBlocked = true;
                        }}
                      >
                        ❌ Block
                      </button>
                    </div>

                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

