export default function User() {
  const submitJob = async () => {
  const color = document.querySelectorAll("select")[0].value;
  const binding = document.querySelectorAll("select")[1].value;
  const copies = document.querySelector("input[type='number']").value;
  const file = document.querySelector("input[type='file']").files[0];

  if (!file) {
    alert("Please upload a file");
    return;
  }

  try {
    const res = await fetch("https://photocopy-backend-isnx.onrender.com/api/print-jobs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userName: "Dharshini",        // temporary
        userId: "123",                // temporary
        printType: binding,
        orientation: "Portrait",
        color: color,
        copies: Number(copies),
        pages: 1,
        fileName: file.name
      }),
    });

    const data = await res.json();

    if (res.ok) {
      alert("Print job submitted successfully!");
    } else {
      alert(data.error || "Failed to submit job");
    }
  } catch (err) {
    console.error(err);
    alert("Server error");
  }
};

  return (
    <div className="page">
      <h1>Print Request</h1>

      <div className="form-grid">

        <div className="form-card">
          <h3>Upload Document</h3>
          <input type="file" />
        </div>

        <div className="form-card">
          <h3>Print Options</h3>

          <label>Color</label>
          <select>
            <option>Black & White</option>
            <option>Color</option>
          </select>

          <label>Copies</label>
          <input type="number" defaultValue="1" />

          <label>Binding</label>
          <select>
            <option>None</option>
            <option>Spiral</option>
            <option>Hard Bind</option>
          </select>
        </div>

        <div className="form-card">
          <button
            onClick={submitJob}
            style={{ backgroundColor: '#007bff', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
          >
            Submit Print Request
          </button>
        </div>

      </div>
    </div>
  );
}

