import React, { useEffect, useState } from "react";
import axios from "axios";

function buildQuestionTree(questions) {
  const map = {};
  questions.forEach((q) => {
    const key = q.variable_name || q.id;
    map[key] = { ...q, key, children: [] };
  });
  const roots = [];
  questions.forEach((q) => {
    const key = q.variable_name || q.id;
    const node = map[key];
    if (q.branching_logic) {
      const m = q.branching_logic.match(/\[([A-Za-z0-9_]+)\]/);
      const parentVar = m ? m[1] : null;
      const parentKey = parentVar && map[parentVar] ? parentVar : null;
      if (parentKey) {
        map[parentKey].children.push(node);
        return;
      }
    }
    roots.push(node);
  });
  return roots;
}

function TreeNode({ node, level = 0 }) {
  return (
    <div className="relative mb-4">
      {level > 0 && (
        <div
          className="absolute top-0 bottom-0 left-4 w-0.5 bg-blue-300"
          style={{ marginLeft: level * 20 }}
        />
      )}
      <div
        className="flex items-center space-x-3 bg-white border border-blue-200 rounded-lg p-3 shadow-sm hover:shadow-md transition"
        style={{ marginLeft: level * 20 }}
      >
        <div className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0" />
        <div className="flex-1">
          <div className="font-medium text-gray-800">{node.question_text}</div>
          {node.branching_logic && (
            <div className="text-sm italic text-gray-500">
              Bedingung: {node.branching_logic}
            </div>
          )}
        </div>
      </div>
      {node.children.map((child) => (
        <TreeNode key={child.key} node={child} level={level + 1} />
      ))}
    </div>
  );
}

export default function ImportedFormsPage() {
  const [forms, setForms] = useState([]);
  const [expandedForms, setExpandedForms] = useState({});
  const [profile, setProfile] = useState(null);

useEffect(() => {
  const token = localStorage.getItem("token");
  if (!token) return;

  axios
    .get("http://localhost:5000/api/user/profile", {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((res) => setProfile(res.data))
    .catch((err) => {
      console.error("Fehler beim Laden des Profils:", err);
    });
}, []);


  useEffect(() => {
    const fetchAllForms = async () => {
      try {
        const [importedRes, customRes] = await Promise.all([
          axios.get("http://localhost:5000/api/imported-forms"),
          axios.get("http://localhost:5000/api/custom-forms"),
        ]);

        const importedForms = importedRes.data.map((form) => ({
          ...form,
          source: "imported",
        }));

        const customForms = customRes.data.map((form) => ({
          form_id: `custom_${form.id}`,
          form_name: form.name,
          source: "custom",
          filename: null,
          created_at: form.created_at,
          created_by: form.created_by,
          sections: form.sections.map((section) => ({
            section_name: section.title,
            questions: section.questions.map((q) => ({
              id: q.id,
              variable_name: q.variable_name,
              question_text: q.label,
              field_type: q.field_type,
              choices: q.choices,
              required: q.required,
              field_note: q.field_note,
              validation_type: q.validation_type,
              validation_min: q.validation_min,
              validation_max: q.validation_max,
              identifier: q.identifier,
              branching_logic: q.branching_logic,
              field_annotation: q.field_annotation,
              custom_alignment: q.custom_alignment,
              question_number: q.question_number,
              matrix_group_name: q.matrix_group_name,
              matrix_ranking: q.matrix_ranking,
            })),
          })),
        }));

        setForms([...importedForms, ...customForms]);
      } catch (err) {
        alert("Fehler beim Laden der Formulare");
        console.error(err);
      }
    };

    fetchAllForms();
  }, []);

  const handleExportForm = (form) => {
  const headers = [
    "Variable / Field Name",
    "Form Name",
    "Section Header",
    "Field Type",
    "Field Label",
    "Choices, Calculations, OR Slider Labels",
    "Field Note",
    "Text Validation Type OR Show Slider Number",
    "Text Validation Min",
    "Text Validation Max",
    "Identifier?",
    "Branching Logic (Show field only if...)",
    "Required Field?",
    "Custom Alignment",
    "Question Number (surveys only)",
    "Matrix Group Name",
    "Matrix Ranking?",
    "Field Annotation",
  ];

  const escapeCell = (value) => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const rows = [];

  form.sections.forEach((section) => {
    section.questions.forEach((q) => {
      // Unterstützt sowohl flache q-Objekte als auch versionsstruktur
      const versions = q.versions ?? [q];

      versions.forEach((v) => {
        const fieldType = v.field_type ?? v.type ?? "";
        const requiredFlag =
          v.required === true ||
          (typeof v.required === "string" && v.required.toLowerCase() === "y")
            ? "y"
            : "";

        let choicesStr = "";
        if (v.choices != null) {
          try {
            if (Array.isArray(v.choices)) {
              choicesStr = v.choices
                .map((item) => `${item.value ?? ""}, ${item.label ?? ""}`)
                .join(" | ");
            } else if (typeof v.choices === "object") {
              choicesStr = Object.entries(v.choices)
                .map(([key, label]) => `${key}, ${label}`)
                .join(" | ");
            } else {
              choicesStr = String(v.choices);
            }
          } catch {
            choicesStr = JSON.stringify(v.choices);
          }
        }

        const row = [
          v.variable_name || "",
          form.form_name || "",
          section.section_name || "",
          fieldType,
          v.question_text || "",
          choicesStr,
          v.field_note || "",
          v.validation_type || "",
          v.validation_min || "",
          v.validation_max || "",
          v.identifier || "",
          v.branching_logic || "",
          requiredFlag,
          v.custom_alignment || "",
          v.question_number || "",
          v.matrix_group_name || "",
          v.matrix_ranking ? "y" : "",
          v.field_annotation || "",
        ];

        rows.push(row);
      });
    });
  });

  // Sortiere nach Question Number (falls vorhanden)
  rows.sort((a, b) => {
    const n1 = parseInt(a[14], 10) || 0;
    const n2 = parseInt(b[14], 10) || 0;
    return n1 - n2;
  });

  let csvContent = headers.map(escapeCell).join(",") + "\n";
  rows.forEach((row) => {
    csvContent += row.map(escapeCell).join(",") + "\n";
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = (form.form_name || "questionnaire").replace(/\s+/g, "_");
  a.download = `export_${safeName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};


  const handleDeleteForm = async (formId) => {
    const id = formId.replace("custom_", "");
    if (!window.confirm("Do you really want to delete this questionnaire?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/custom-forms/${id}`);
      setForms((prev) => prev.filter((f) => f.form_id !== formId));
    } catch (err) {
      alert("❌ Error deleting questionnaire.");
      console.error(err);
    }
  };

  const toggleForm = (formId) => {
    setExpandedForms((prev) => ({ ...prev, [formId]: !prev[formId] }));
  };

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-4xl font-bold text-gray-800 mb-8">
        🧾 Imported Questionnaires
      </h1>
      {forms.length === 0 ? (
        <p className="text-gray-500 text-lg">No questionnaires imported yet.</p>
      ) : (
        <div className="space-y-6">
          {forms.map((form, idx) => (
            <div
              key={form.form_id || idx}
              className="bg-white rounded-xl shadow-lg p-6 hover:shadow-2xl transition"
            >
              <div className="flex justify-between items-start mb-3">
                <div
                  onClick={() => toggleForm(form.form_id || idx)}
                  className="cursor-pointer"
                >
                  <h2 className="text-2xl font-semibold text-green-700 mb-1">
                    {form.form_name || "Untitled Questionnaire"}
                  </h2>
                  <p className="text-sm text-gray-500">
                    📁 {form.filename || "–"} –{" "}
                    {new Date(form.created_at).toLocaleString()} –{" "}
                    <span className="text-sm text-gray-400">
                      ({form.source === "custom" ? "Custom" : "Imported"})
                    </span>{" "}
                    {form.source === "custom"
                      ? `🧩 Created by ${form.created_by?.username || "Unknown"}`
                      : `👤 Imported by ${form.imported_by?.username || "Unknown"}`}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleExportForm(form)}
                    className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
                  >
                    📥 Export
                  </button>

                  {form.source === "custom" && (
  <button
    onClick={() => handleDeleteForm(form.form_id)}
    disabled={profile?.user_id !== form.created_by?.id}
    className={`px-3 py-1 text-sm rounded transition ${
      profile?.user_id === form.created_by?.id
        ? "bg-red-600 text-white hover:bg-red-700"
        : "bg-gray-300 text-gray-500 cursor-not-allowed"
    }`}
  >
    🗑️ Delete
  </button>
)}


                </div>
              </div>

              {expandedForms[form.form_id || idx] && (
                <div className="mt-6 border-t pt-6 space-y-6">
                  {form.sections.map((section, i) => {
                    const questionsSorted = [...section.questions].sort((a, b) => {
                      const q1 = parseInt(a.question_number || "0", 10);
                      const q2 = parseInt(b.question_number || "0", 10);
                      return q1 - q2;
                    });
                    const tree = buildQuestionTree(section.questions);

                    return (
                      <div key={i} className="grid md:grid-cols-2 gap-6">
                        <div>
                          <h3 className="text-lg font-semibold mb-2">
                            📋 Original Order: {section.section_name || "General"}
                          </h3>
                          <ul className="space-y-2">
                            {questionsSorted.map((q, idx) => (
                              <li
                                key={idx}
                                className="bg-white border border-gray-200 rounded p-3 shadow-sm"
                              >
                                <div className="font-medium text-gray-800">{q.question_text}</div>
                                <div className="text-sm text-gray-500">
                                  Variable: {q.variable_name}{" "}
                                  {q.question_number && ` | No. ${q.question_number}`}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold mb-2">
                            🔀 Branching Logic Structure
                          </h3>
                          <div className="bg-blue-50 p-4 rounded-lg">
                            {tree.map((node) => (
                              <TreeNode key={node.key} node={node} />
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
