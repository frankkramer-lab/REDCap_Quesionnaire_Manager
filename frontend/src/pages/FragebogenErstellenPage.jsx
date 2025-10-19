import React, { useEffect, useState } from "react";
import axios from "axios";
import ImportedFormsPage from "./ImportedFormsPage"; // Pfad ggf. anpassen


export function CreateQuestionnairePage() {
  const [forms, setForms] = useState([]); // contains imported + custom forms
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [expandedForms, setExpandedForms] = useState({});
  const [formTitle, setFormTitle] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState("create"); // "create" oder "imported"
  const allMatrix = selectedQuestions.length > 0 && selectedQuestions.every(q => !!q.matrix_group_name);



  // ---- Minimalistisches, robustes HTML5 DnD ----
const [draggingIndex, setDraggingIndex] = useState(null); // Index der Quelle
const [overIndex, setOverIndex] = useState(null);         // Index, über dem wir schweben, oder 'end'

// Start: Quelle merken
const onDragStartItem = (index) => (e) => {
  setDraggingIndex(index);
  try { e.dataTransfer.setData("text/plain", String(index)); } catch {}
  e.dataTransfer.effectAllowed = "move";
};

// Über Item schweben → Drop erlauben + Ziel merken
const onDragOverItem = (index) => (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  if (overIndex !== index) setOverIndex(index);
};

// Über End‑Zone schweben (Drop ans Listenende)
const onDragOverEnd = (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  if (overIndex !== "end") setOverIndex("end");
};

// Drop auf Item
const onDropOnItem = (index) => (e) => {
  e.preventDefault();
  const from =
    draggingIndex ?? parseInt(e.dataTransfer.getData("text/plain"), 10);
  if (Number.isNaN(from)) return;

  // Ziel: vor das Item mit "index" einfügen
  const to = index > from ? index - 1 : index;

  // Regel: erste Frage darf keine Matrix‑Frage sein
  const moved = selectedQuestions[from];
  if (to === 0 && !!moved?.matrix_group_name) {
    alert("The first question cannot be a matrix question. Please place a non‑matrix question first.");
    cleanupDnD();
    return;
  }

  const arr = [...selectedQuestions];
  arr.splice(from, 1);
  arr.splice(to, 0, moved);
  setSelectedQuestions(arr);
  cleanupDnD();
};

// Drop auf End‑Zone
const onDropAtEnd = (e) => {
  e.preventDefault();
  const from =
    draggingIndex ?? parseInt(e.dataTransfer.getData("text/plain"), 10);
  if (Number.isNaN(from)) return;

  const to = selectedQuestions.length - 1; // ans Ende

  const moved = selectedQuestions[from];
  // Ende == Index length → erlaubt, außer wir würden auf 0 landen (passiert hier nicht)
  const arr = [...selectedQuestions];
  arr.splice(from, 1);
  arr.push(moved);
  // Falls Liste leer war oder wir *theoretisch* auf Index 0 landen würden UND es Matrix ist, absichern:
  if (arr[0] && !!arr[0].matrix_group_name) {
    alert("The first question cannot be a matrix question. Please place a non‑matrix question first.");
    cleanupDnD();
    return;
  }

  setSelectedQuestions(arr);
  cleanupDnD();
};

const cleanupDnD = () => {
  setDraggingIndex(null);
  setOverIndex(null);
};




  // Sorgt dafür, dass die erste Frage keine Matrix-Frage ist
const ensureNonMatrixFirst = (list) => {
  if (!Array.isArray(list) || list.length === 0) return list;
  const idx = list.findIndex(q => !q.matrix_group_name); // non-matrix = kein Gruppenname
  if (idx <= 0) return list; // schon ok oder keine non-matrix vorhanden
  const copy = [...list];
  const [item] = copy.splice(idx, 1);
  copy.unshift(item);
  return copy;
};



  // Helper function: Extract all variable names from branching logic and calculation formulas
  const extractDependencies = (v) => {
    const deps = new Set();

    // Branching Logic z. B. [smoker]
    if (v.branching_logic) {
      const regex = /\[([a-zA-Z0-9_]+)(\(\d+\))?\]/g;
      let m;
      while ((m = regex.exec(v.branching_logic))) {
        deps.add(m[1]);
      }
    }

    // Referenzen in choices/options z. B. {"[a] + [b]": "text"}
    if (v.choices && typeof v.choices === "object") {
      const texts = [...Object.keys(v.choices), ...Object.values(v.choices)];
      texts.forEach((txt) => {
        if (typeof txt === "string") {
          const regex = /\[([a-zA-Z0-9_]+)\]/g;
          let m;
          while ((m = regex.exec(txt))) {
            deps.add(m[1]);
          }
        }
      });
    }

    // Auch Field Annotation und Field Note durchgehen
    ["field_annotation", "field_note"].forEach((key) => {
      if (v[key] && typeof v[key] === "string") {
        const regex = /\[([a-zA-Z0-9_]+)\]/g;
        let m;
        while ((m = regex.exec(v[key]))) {
          deps.add(m[1]);
        }
      }
    });

    // Manuell gespeicherte dependencies (z. B. bei gespeicherten Custom-Fragen)
    if (Array.isArray(v.dependencies)) {
      v.dependencies.forEach((d) => deps.add(d));
    }

    return Array.from(deps);
  };


  // Helper function: Find a version by its variable_name across all forms
  const findVersionByVariable = (varName) => {
    for (const form of forms) {
      for (const section of form.sections) {
        for (const qGroup of section.questions) {
          for (const ver of qGroup.versions) {
            if (normVar(ver.variable_name) === target) {
              return ver;
            }
          }
        }
      }
    }
    return null;
  };

  // 1) Load imported and custom forms, then normalize them
  const fetchForms = async () => {
    try {
      // 1a) Imported forms with question versions
      const importedRes = await axios.get(
          "http://localhost:5000/api/questions/all"
      );
      const importedForms = importedRes.data.map((form) => ({
        form_id: form.form_id,
        form_name: form.form_name,
        source: "imported",
        filename: form.filename,
        created_at: form.created_at,
        imported_by: form.imported_by || {username: "Unknown"},
        sections: form.sections.map((section) => ({
          section_name: section.section_name || section.title,
          questions: section.questions.map((qGroup) => ({
            versions: qGroup.versions.map((v) => ({
              id: v.id,
              variable_name: v.variable_name,
              question_text: v.question_text,
              field_type: v.field_type ?? v.type ?? "",
              choices: v.choices,
              required: v.required ?? "",
              field_note: v.field_note ?? "",
              dependencies: v.dependencies,
              validation_type: v.validation_type,
              validation_min: v.validation_min,
              validation_max: v.validation_max,
              identifier: v.identifier,
              branching_logic: v.branching_logic,
              field_annotation: v.field_annotation,
              version: v.version,
              last_edited_by: v.last_edited_by,
              last_edited_at: v.last_edited_at,
              custom_alignment: v.custom_alignment,
              question_number: v.question_number,
              matrix_group_name: v.matrix_group_name,
              matrix_ranking: v.matrix_ranking,
            })),
          })),
        })),
      }));

      // 1b) Custom forms  ➜ Fragen innerhalb einer Section nach variable_name gruppieren
const customRes = await axios.get("http://localhost:5000/api/custom-forms");
const customForms = customRes.data.map((form) => ({
  form_id: `custom_${form.id}`,
  form_name: form.name,
  source: "custom",
  filename: "",
  created_at: form.created_at,
  created_by: form.created_by,
  sections: form.sections.map((section) => {
    // Map für Gruppierung: variable_name => { versions: [...] }
    const groupsByVar = {};

    section.questions.forEach((q) => {
      const key = q.variable_name;
      if (!groupsByVar[key]) {
        groupsByVar[key] = { versions: [] };
      }
      groupsByVar[key].versions.push({
        id: q.id,
        variable_name: q.variable_name,
        question_text: q.label,
        field_type: q.field_type,
        choices: q.choices,
        required: q.required,
        dependencies: q.dependencies,
        validation_type: q.validation_type,
        validation_min: q.validation_min,
        validation_max: q.validation_max,
        identifier: q.identifier,
        branching_logic: q.branching_logic,
        field_annotation: q.field_annotation,
        version: q.version?.toString() || "1.0",
        last_edited_by: q.last_edited_by,
        last_edited_at: q.last_edited_at,
        field_note: q.field_note,
        custom_alignment: q.custom_alignment,
        question_number: q.question_number,
        matrix_group_name: q.matrix_group_name,
        matrix_ranking: q.matrix_ranking,
      });
    });

    return {
      section_name: section.title,
      // WICHTIG: Jetzt im selben Format wie importierte Forms: questions = [{ versions: [...] }, ...]
      questions: Object.values(groupsByVar),
    };
  }),
}));


      setForms([...importedForms, ...customForms]);
    } catch (err) {
      alert("Error loading forms");
      console.error(err);
    }
  };

  useEffect(() => {
    fetchForms();
  }, []);

  // Hilfsfunktion einmalig (außerhalb der Funktion platzieren)
const normVar = (s) => (s ?? "").trim().toLowerCase();

// akzeptiert optional workingVarNames (Set), das bereits hinzugefügte Namen enthält
const handleAddQuestion = (v, workingVarNames) => {
  // bestehende Namen normalisiert
  const existingVarNames = workingVarNames
    ? workingVarNames
    : new Set(selectedQuestions.map(q => normVar(q.variable_name)));

  // Helper: Version anhand normalisiertem variable_name finden
  const findVersionByVariable = (varName) => {
    const target = normVar(varName);
    for (const form of forms) {
      for (const section of form.sections) {
        for (const qGroup of section.questions) {
          for (const ver of qGroup.versions) {
            if (normVar(ver.variable_name) === target) return ver;
          }
        }
      }
    }
    return null;
  };

  // Dependencies extrahieren (unverändert)
  const depsOf = (ver) => {
    const deps = new Set();
    if (ver.branching_logic) {
      const rgx = /\[([a-zA-Z0-9_]+)(\(\d+\))?\]/g;
      let m;
      while ((m = rgx.exec(ver.branching_logic))) deps.add(m[1]);
    }
    if (ver.choices && typeof ver.choices === "object") {
      const texts = [...Object.keys(ver.choices), ...Object.values(ver.choices)];
      texts.forEach((txt) => {
        if (typeof txt === "string") {
          const rgx = /\[([a-zA-Z0-9_]+)\]/g;
          let m;
          while ((m = rgx.exec(txt))) deps.add(m[1]);
        }
      });
    }
    ["field_annotation", "field_note"].forEach((key) => {
      if (ver[key] && typeof ver[key] === "string") {
        const rgx = /\[([a-zA-Z0-9_]+)\]/g;
        let m;
        while ((m = rgx.exec(ver[key]))) deps.add(m[1]);
      }
    });
    if (Array.isArray(ver.dependencies)) ver.dependencies.forEach((d) => deps.add(d));
    return Array.from(deps);
  };

  // Traversal mit normalisierten Keys
  const toAdd = [];
  const visited = new Set();
  let duplicateFound = null;

  const traverse = (ver) => {
    if (!ver) return;
    const key = normVar(ver.variable_name);
    if (!key || visited.has(key)) return;
    visited.add(key);

    if (existingVarNames.has(key)) {
      if (key === normVar(v.variable_name)) duplicateFound = ver.variable_name;
      return; // schon vorhanden → nicht erneut hinzufügen
    }

    depsOf(ver).forEach((depVar) => {
      const parentVer = findVersionByVariable(depVar);
      if (parentVer) traverse(parentVer);
    });

    toAdd.push(ver);
  };

  traverse(v);

  if (duplicateFound) {
    alert(`Error: The question with variable_name "${duplicateFound}" has already been added.`);
    return;
  }

  setSelectedQuestions((prev) => {
    const existingIds = new Set(prev.map((q) => q.id));
    const additions = toAdd
      .filter((ver) => !existingIds.has(ver.id))
      .map((ver) => ({
        id: ver.id,
        variable_name: ver.variable_name,
        label: ver.question_text,
        field_type: ver.field_type,
        choices: ver.choices,
        required: ver.required,
        validation_type: ver.validation_type,
        validation_min: ver.validation_min,
        validation_max: ver.validation_max,
        identifier: ver.identifier,
        branching_logic: ver.branching_logic,
        field_annotation: ver.field_annotation,
        dependencies: ver.dependencies,
        version: ver.version,
        field_note: ver.field_note,
        custom_alignment: ver.custom_alignment,
        question_number: ver.question_number,
        matrix_group_name: ver.matrix_group_name,
        matrix_ranking: ver.matrix_ranking,
      }));

    // Working-Set live updaten (normalisiert)
    if (workingVarNames) {
      additions.forEach(a => workingVarNames.add(normVar(a.variable_name)));
    }

    // MERGE + finales Dedupe nach variable_name (normalisiert)
    const merged = [...prev, ...additions];
    const seen = new Set();
    const deduped = [];
    for (const item of merged) {
      const k = normVar(item.variable_name);
      if (!seen.has(k)) {
        seen.add(k);
        deduped.push(item);
      }
    }

    return ensureNonMatrixFirst(deduped);
  });
};



  const handleAddSection = (section) => {
  const working = new Set(selectedQuestions.map(q => normVar(q.variable_name)));
  const seenInThisBatch = new Set(); // schützt vor Mehrfachversionen im selben Form/Section
  const candidates = [];

  section.questions.forEach(qGroup => {
    qGroup.versions.forEach(ver => {
      if (!working.has(ver.variable_name) && !seenInThisBatch.has(ver.variable_name)) {
        candidates.push(ver);
        seenInThisBatch.add(ver.variable_name); // merken, dass dieses variable_name schon verarbeitet wurde
      }
    });
  });

  if (candidates.length === 0) {
    alert("All questions in this section have already been added.");
    return;
  }

  candidates.forEach(ver => handleAddQuestion(ver, working));
};



  const handleAddEntireForm = (form) => {
  const working = new Set(selectedQuestions.map(q => normVar(q.variable_name)));
  const seenInThisBatch = new Set();
  const candidates = [];

  form.sections.forEach(section => {
    section.questions.forEach(qGroup => {
      qGroup.versions.forEach(ver => {
        if (!working.has(ver.variable_name) && !seenInThisBatch.has(ver.variable_name)) {
          candidates.push(ver);
          seenInThisBatch.add(ver.variable_name);
        }
      });
    });
  });

  if (candidates.length === 0) {
    alert("This entire questionnaire has already been added.");
    return;
  }

  candidates.forEach(ver => handleAddQuestion(ver, working));
};




  // Removes a question and recursively all questions that depend on it
  const handleRemoveQuestion = (v) => {
    // 1) Build reverse dependency graph
    const rev = buildReverseGraph(selectedQuestions);
    // 2) Depth-first search from v.variable_name
    const toRemove = new Set();
    const stack = [v.variable_name];
    while (stack.length) {
      const cur = stack.pop();
      if (!toRemove.has(cur)) {
        toRemove.add(cur);
        (rev[cur] || []).forEach((child) => {
          if (!toRemove.has(child)) stack.push(child);
        });
      }
    }
    // 3) Remove all questions whose variable_name is in toRemove
    setSelectedQuestions((prev) =>
     ensureNonMatrixFirst(prev.filter((q) => !toRemove.has(q.variable_name)))
    );
  };

  const toggleForm = (formId) => {
    setExpandedForms((prev) => ({
      ...prev,
      [formId]: !prev[formId],
    }));
  };

  const handleSaveQuestionnaire = async () => {
    if (!formTitle.trim()) {
      alert("Please enter a title!");
      return;
    }

    const payload = {
      name: formTitle,
      sections: [
        {
          title: "Default",
          order: 0,
          questions: selectedQuestions.map((q) => ({
            variable_name: q.variable_name,
            label: q.label || "",
            field_type: q.field_type || "",
            choices: q.choices || null,
            required:
                q.required === true ||
                q.required === "y" ||
                q.required === "ja",
            validation_type: q.validation_type || null,
            validation_min: q.validation_min || null,
            validation_max: q.validation_max || null,
            identifier: q.identifier || null,
            branching_logic: q.branching_logic || null,
            field_annotation: q.field_annotation || null,
            dependencies: q.dependencies || null,
            field_note: q.field_note || null,
            custom_alignment: q.custom_alignment || null,
            question_number: q.question_number || null,
            matrix_group_name: q.matrix_group_name || null,
            matrix_ranking: q.matrix_ranking || null,
            version: q.version?.toString() || "1.0"
          })),
        },
      ],
    };

    try {
      const token = localStorage.getItem("token");
      await axios.post("http://localhost:5000/api/custom-forms", payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      alert("✅ Questionnaire saved!");
      setSelectedQuestions([]);
      setFormTitle("");
      setShowModal(false);
      await fetchForms();
    } catch (err) {
      alert("❌ Error saving.");
      console.error(err);
    }
  };


  // 3) Live filter: search in form_name or in any question version
  const formContainsSearch = (form) => {
    if (form.form_name?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return true;
    }
    return form.sections.some((section) =>
        section.questions.some((qGroup) =>
            qGroup.versions.some((v) =>
                (v.question_text || "")
                    .toLowerCase()
                    .includes(searchTerm.toLowerCase())
            )
        )
    );
  };

// Helper: build reverse dependency graph from selectedQuestions
  const buildReverseGraph = (questions) => {
    const graph = {}; // variable_name → [dependent variable_names]
    questions.forEach((q) => {
      extractDependencies(q).forEach((parent) => {
        if (!graph[parent]) graph[parent] = [];
        graph[parent].push(q.variable_name);
      });
    });
    return graph;
  };

  const filteredForms = forms.filter((form) => formContainsSearch(form));

  // 4) REDCap-compatible CSV export for a single form


  return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <h1 className="text-4xl font-bold text-blue-800 mb-4">
          Create a New Questionnaire
        </h1>

        <div className="mb-6">
          <input
              type="text"
              placeholder="🔍 Search questions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-gray-300 rounded px-4 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Existing Forms */}
          <div>
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">
              📂 Existing Questionnaires
            </h2>
            {filteredForms.map((form) => (
                <div
                    key={form.form_id}
                    className="bg-white rounded-lg shadow-md p-4 mb-6"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div
                        className="cursor-pointer flex-grow"
                        onClick={() => toggleForm(form.form_id)}
                    >
                      <h3 className="text-xl font-semibold text-green-700">
                        {form.form_name || "Untitled Questionnaire"}{" "}
                        {form.source === "custom" && (
                            <span className="text-sm text-blue-600">(Custom)</span>
                        )}
                      </h3>
                      <p>
                        {form.source === "custom"
                            ? `🧩 Created by ${form.created_by?.username || "Unknown"} `
                            : `📥 Imported by ${form.imported_by?.username || "Unknown"} `}
                        {new Date(form.created_at).toLocaleString()}
                      </p>
                    </div>


                  </div>

                  <div className="flex flex-wrap gap-2 mt-2">
                    <button
                        onClick={() => handleAddEntireForm(form)}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      ➕ Add Entire Form
                    </button>
                  </div>

                  {expandedForms[form.form_id] && (
                      <div className="mt-3">
                        {form.sections.map((section) => {
                          const matchedGroups = section.questions
                              .map((qGroup) => {
                                const versionsVisible = qGroup.versions.filter((v) =>
                                    (v.question_text || "")
                                        .toLowerCase()
                                        .includes(searchTerm.toLowerCase())
                                );
                                if (versionsVisible.length === 0) return null;
                                return {
                                  sectionName: section.section_name,
                                  versions: versionsVisible,
                                };
                              })
                              .filter(Boolean);

                          if (matchedGroups.length === 0) return null;

                          return (
                              <div
                                  key={section.section_name}
                                  className="mb-4 pl-2 border-l-2 border-gray-200"
                              >
                                <div className="flex justify-between items-center mb-1">
                                  <h4 className="text-lg font-medium text-gray-800">
                                    📂 {section.section_name || "General"}
                                  </h4>
                                  <button
                                      onClick={() => handleAddSection(section)}
                                      className="px-2 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                                  >
                                    ➕ Add Section
                                  </button>
                                </div>

                                <div className="space-y-4">
                                  {matchedGroups.map((group) =>
                                      group.versions.map((v) => (
                                          <div
                                              key={v.id}
                                              className="border rounded px-4 py-2 bg-gray-50 space-y-1"
                                          >
                                            <div className="flex justify-between items-start">
                                              <div>
                                                <p className="font-semibold text-gray-800">
                                                  {v.question_text}{" "}
                                                  <span className="text-xs text-gray-400">
                                      (v{v.version})
                                    </span>
                                                </p>
                                                <p className="text-sm text-gray-600">
                                                  🔹 Type: {v.field_type || "–"} | 🔸 Required:{" "}
                                                  {v.required ? "yes" : "no"}
                                                </p>
                                                {v.choices && (
                                                    <p className="text-sm text-gray-500">
                                                      ⚙️ Options: {JSON.stringify(v.choices)}
                                                    </p>
                                                )}
                                                {v.validation_type && (
                                                    <p className="text-sm text-gray-500">
                                                      📌 Validation: {v.validation_type} | Min:{" "}
                                                      {v.validation_min || "–"} | Max:{" "}
                                                      {v.validation_max || "–"}
                                                    </p>
                                                )}
                                                {v.identifier && (
                                                    <p className="text-sm text-gray-500">
                                                      🆔 Identifier: {v.identifier}
                                                    </p>
                                                )}
                                                {v.branching_logic && (
                                                    <p className="text-sm text-gray-500">
                                                      🔀 Branching Logic: {v.branching_logic}
                                                    </p>
                                                )}
                                                {v.field_annotation && (
                                                    <p className="text-sm text-gray-500">
                                                      📝 Annotation: {v.field_annotation}
                                                    </p>
                                                )}
                                              </div>
                                              <button
                                                  onClick={() => handleAddQuestion(v)}
                                                  className="ml-4 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition h-fit"
                                              >
                                                ➕ Add
                                              </button>
                                            </div>
                                          </div>
                                      ))
                                  )}
                                </div>
                              </div>
                          );
                        })}
                      </div>
                  )}
                </div>
            ))}
          </div>

          {/* Right: Selected Questions */}
<div>
  <h2 className="text-2xl font-semibold text-gray-700 mb-4">
    🛠️ New Questionnaire
  </h2>

  <div className="bg-white rounded-lg shadow-md p-4">
    {selectedQuestions.length === 0 ? (
      <p className="text-gray-500">No questions selected yet.</p>
    ) : (
      <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {selectedQuestions.map((q, index) => (
          <React.Fragment key={q.id}>
            {/* Drop-Indikator (Linie) VOR dem Item */}
            {draggingIndex !== null && overIndex === index && (
              <div className="h-0.5 bg-blue-500 rounded-full mx-1" />
            )}

            <li
              draggable
              onDragStart={onDragStartItem(index)}
              onDragOver={onDragOverItem(index)}
              onDrop={onDropOnItem(index)}
              onDragEnd={cleanupDnD}
              className={[
                "flex items-center justify-between gap-3 rounded border border-gray-200 px-3 py-2 select-none",
                "transition-all duration-150",
                draggingIndex === index ? "bg-gray-50 shadow-sm" : "bg-white hover:bg-gray-50",
              ].join(" ")}
              // nur Info-Tooltip, kein Grabber sichtbar
              title="Drag to reorder"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-gray-900">{q.label}</div>
                <div className="text-xs text-gray-500 truncate">
                  ({q.field_type}) • v{q.version}
                  {!!q.matrix_group_name && (
                    <span className="ml-2 inline-block rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                      matrix: {q.matrix_group_name}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleRemoveQuestion(q)}
                className="px-2 py-1 text-xs rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
              >
                Remove
              </button>
            </li>
          </React.Fragment>
        ))}

        {/* End‑Drop‑Zone + Indikator */}
        {draggingIndex !== null && overIndex === "end" && (
          <div className="h-0.5 bg-blue-500 rounded-full mx-1" />
        )}
        <li
          onDragOver={onDragOverEnd}
          onDrop={onDropAtEnd}
          className="h-4"
          aria-hidden
        />
      </ul>
    )}

    {allMatrix && (
      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded">
        The first question cannot be a matrix question. Please add a non‑matrix
        question (e.g., an introduction) before saving.
      </div>
    )}

    <button
      className={`mt-6 px-4 py-2 rounded shadow w-full ${
        allMatrix
          ? "bg-gray-300 text-gray-600 cursor-not-allowed"
          : "bg-green-600 hover:bg-green-700 text-white"
      }`}
      onClick={() => {
        if (!allMatrix) setShowModal(true);
      }}
      disabled={allMatrix}
    >
      📤 Create Questionnaire
    </button>
  </div>
</div>


        </div>

        {/* Modal: Title Input */}
        {showModal && (
            <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 shadow-lg w-full max-w-md">
                <h3 className="text-xl font-semibold mb-4 text-gray-800">
                  📝 Save Questionnaire
                </h3>
                <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Enter questionnaire title"
                    className="w-full border border-gray-300 rounded px-4 py-2 mb-4 focus:outline-none"
                />
                <div className="flex justify-end space-x-3">
                  <button
                      className="px-4 py-2 bg-gray-300 rounded"
                      onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                      onClick={handleSaveQuestionnaire}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
        )}
      </div>
  );
}

export default function CreateQuestionnairePageWrapper() {
  const [activeTab, setActiveTab] = useState("create");

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h1 className="text-4xl font-bold text-blue-800 mb-6">🧾 Questionnaires</h1>

      <div className="mb-6 flex space-x-4">
        <button
          className={`px-4 py-2 rounded ${
            activeTab === "create"
              ? "bg-blue-600 text-white"
              : "bg-white text-blue-600 border border-blue-600"
          }`}
          onClick={() => setActiveTab("create")}
        >
          ✏️ Create Questionnaire
        </button>
        <button
          className={`px-4 py-2 rounded ${
            activeTab === "show"
              ? "bg-blue-600 text-white"
              : "bg-white text-blue-600 border border-blue-600"
          }`}
          onClick={() => setActiveTab("show")}
        >
          📚 Show Imported Questionnaires
        </button>
      </div>

      {activeTab === "create" ? (
        <CreateQuestionnairePage />
      ) : (
        <ImportedFormsPage />
      )}
    </div>
  );
}


