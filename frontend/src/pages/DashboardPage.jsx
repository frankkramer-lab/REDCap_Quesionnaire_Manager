import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function DashboardPage() {
  const [profile, setProfile] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [csvList, setCsvList] = useState([]);
  const [expandedCsvId, setExpandedCsvId] = useState(null);
  const [expandedCsvContent, setExpandedCsvContent] = useState(null);
  const navigate = useNavigate();

  const fetchCsvList = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/imported-csvs");
      setCsvList(res.data);
    } catch (err) {
      console.error("Error fetching CSV list");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return alert("Please select a CSV file first.");
    const formData = new FormData();
    formData.append("file", selectedFile);

    const token = localStorage.getItem("token");

    try {
      const res = await axios.post("http://localhost:5000/api/import-csv", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      setUploadMessage(res.data.message);
      setSelectedFile(null);
      fetchCsvList();
    } catch (err) {
      alert(err.response?.data?.error || "Upload failed");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this file?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.delete(`http://localhost:5000/api/imported-csvs/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      fetchCsvList();
    } catch (err) {
      alert("Error deleting file");
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    axios
      .get("http://localhost:5000/api/user/profile", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setProfile(res.data))
      .catch(() => {
        alert("Session expired");
        localStorage.removeItem("token");
        navigate("/login");
      });

    fetchCsvList();
  }, [navigate]);

  const renderQuestionsSorted = (content) => {
    return content
      .slice()
      .sort((a, b) => {
        const numA = parseInt(a["Question Number (surveys only)"]) || 0;
        const numB = parseInt(b["Question Number (surveys only)"]) || 0;
        return numA - numB;
      })
      .map((row, idx) => (
        <div key={idx} className="border-b py-1 text-sm">
          <p>
            <strong>{row["Question Number (surveys only)"] || "-"}</strong>{" "}
            – <strong>{row["Field Label"]}</strong>{" "}
            <span className="text-gray-600">({row["Variable / Field Name"]})</span>
          </p>
        </div>
      ));
  };

  const renderQuestionsWithBranching = (content) => {
    return content.map((row, idx) => (
      <div key={idx} className="border-b py-1 text-sm">
        <p>
          <strong>{row["Field Label"]}</strong>{" "}
          <span className="text-gray-600">({row["Variable / Field Name"]})</span>
        </p>
        {row["Branching Logic (Show field only if...)"] && (
          <p className="text-gray-500 text-xs">
            🔀 Branching: {row["Branching Logic (Show field only if...)"]}
          </p>
        )}
      </div>
    ));
  };

  return (
    <>
      <div className="mt-10 p-6 bg-white rounded shadow">
        <h2 className="text-xl font-semibold mb-4">📁 Import CSV File</h2>

        <div className="flex items-center gap-4 mb-4">
          <label className="cursor-pointer bg-gray-200 px-4 py-2 rounded hover:bg-gray-300 transition text-sm font-medium">
            📂 Choose File
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setSelectedFile(e.target.files[0])}
              className="hidden"
            />
          </label>
          <span className="text-sm text-gray-700">
            {selectedFile ? selectedFile.name : "No file selected"}
          </span>
        </div>

        <button
          onClick={handleUpload}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
        >
          Upload
        </button>

        {uploadMessage && <p className="mt-2 text-green-700">{uploadMessage}</p>}
      </div>

      <div className="mt-10 p-6 bg-white rounded shadow">
        <h2 className="text-xl font-semibold mb-4">🗂️ Imported CSV Files</h2>
        {csvList.length === 0 ? (
          <p className="text-gray-500">No CSV files have been imported yet.</p>
        ) : (
          <ul className="list-disc pl-5">
            {csvList.map((csv) => (
              <li key={csv.id} className="mb-4">
                <div className="flex items-center justify-between">
                  <span>
                    <strong>{csv.filename}</strong>{" "}
                    <span className="text-sm text-gray-500">
                      (Imported on {new Date(csv.created_at).toLocaleString()}) – by{" "}
                      <strong>{csv.imported_by || "Unknown"}</strong>
                    </span>
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (expandedCsvId === csv.id) {
                          setExpandedCsvId(null);
                          setExpandedCsvContent(null);
                        } else {
                          setExpandedCsvId(csv.id);
                          setExpandedCsvContent(csv.content);
                        }
                      }}
                      className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                    >
                      {expandedCsvId === csv.id ? "Hide" : "Show"}
                    </button>

                    <button
                      onClick={() => handleDelete(csv.id)}
                      disabled={profile?.user_id !== csv.imported_by_id}
                      className={`px-3 py-1 text-sm rounded transition ${
                        profile?.user_id === csv.imported_by_id
                          ? "bg-red-600 text-white hover:bg-red-700"
                          : "bg-gray-300 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>

                {expandedCsvId === csv.id && (
                  <div className="mt-4 flex flex-col md:flex-row gap-6">
                    <div className="w-full md:w-1/2 bg-gray-50 p-4 rounded shadow">
                      <h3 className="text-md font-semibold mb-2 text-gray-800">
                        🧾 Questions by Import Order (Question Number)
                      </h3>
                      {renderQuestionsSorted(expandedCsvContent)}
                    </div>

                    <div className="w-full md:w-1/2 bg-gray-50 p-4 rounded shadow">
                      <h3 className="text-md font-semibold mb-2 text-gray-800">
                        🔗 Questions with Branching Logic
                      </h3>
                      {renderQuestionsWithBranching(expandedCsvContent)}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
