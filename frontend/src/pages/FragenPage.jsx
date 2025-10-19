import React, {useEffect, useState} from "react";
import axios from "axios";

export default function QuestionsPage() {
    const [forms, setForms] = useState([]);
    const [profile, setProfile] = useState(null);
    const [editedQuestions, setEditedQuestions] = useState({});
    const [savingStatus, setSavingStatus] = useState({});
    const [validationErrors, setValidationErrors] = useState({});
    const [expandedForms, setExpandedForms] = useState({});
    const [expandedSections, setExpandedSections] = useState({});
    const [activeVersions, setActiveVersions] = useState({});
    const [searchTerm, setSearchTerm] = useState("");
    const [changeTypes, setChangeTypes] = useState({});
    const [branchingLogicErrors, setBranchingLogicErrors] = useState({});
    const [activeMatrixTab, setActiveMatrixTab] = useState({});
    const [branchingSelection, setBranchingSelection] = useState({});
    const [changeAnnotations, setChangeAnnotations] = useState({});
    const [cloningKey, setCloningKey] = useState(null);
    const [cloneInput, setCloneInput] = useState("");
    const [cloneError, setCloneError] = useState("");
    const [expandedMatrixRows, setExpandedMatrixRows] = useState({});
    const [activeMatrixEntry, setActiveMatrixEntry] = useState(null);
    const [addingToMatrix, setAddingToMatrix] = useState({});
    const [matrixAddSelection, setMatrixAddSelection] = useState({});
    const [matrixConfigInputs, setMatrixConfigInputs] = useState({});
    const [showMatrixConfig, setShowMatrixConfig] = useState({});


    const [activeCustomVersion, setActiveCustomVersion] = useState(() => {
        const saved = localStorage.getItem("activeCustomVersions");
        return saved ? JSON.parse(saved) : {};
    });

    /**
     * Wird aufgerufen, wenn der User im Add-UI eine Frage ausgewählt und auf "Add" klickt.
     */
    const handleAddToMatrix = async (formId, sectionName, matrixGroupName, uniqueGroupKey) => {
  const variableName = matrixAddSelection[uniqueGroupKey];
  if (!variableName) return;

  const formObj = forms.find(f => f.form_id === formId);
  if (!formObj) return;

  let foundSection = null;
  let qObj = null;

  // Suche über jede Section und jede Version der Frage
  for (const s of formObj.sections) {
    const match = s.questions.find(q =>
      q.versions.some(v => v.variable_name === variableName)
    );
    if (match) {
      foundSection = s;
      qObj = match;
      break;
    }
  }

  if (!qObj || !foundSection) {
    alert("Question not found.");
    return;
  }

  // Wir updaten IMMER die aktuellste Version (index 0)
  const v0 = qObj.versions[0];

        // 2) Matrix-Referenzfrage finden, um Werte zu übernehmen
let refVersion = null;
for (const sec of formObj.sections) {
  for (const q of sec.questions) {
    // suche in allen Versionen, nicht nur in index 0
    const found = q.versions.find(v => v.matrix_group_name === matrixGroupName);
    if (found) {
      refVersion = found;
      break;
    }
  }
  if (refVersion) break;
}


        if (!refVersion) {
            alert("Reference matrix question not found.");
            return;
        }

        // 3) Clonen mit Matrix-Werten (außer variable_name und question_text)
        const baseClone = {
            variable_name: v0.variable_name,
            question_text: v0.question_text,
            type: refVersion.type,
            required: refVersion.required,
            choices: normalizeChoicesToString(refVersion.choices),
            slider_min: refVersion.slider_min || "",
            slider_mid: refVersion.slider_mid || "",
            slider_max: refVersion.slider_max || "",
            validation_type: refVersion.validation_type || "",
            validation_min: refVersion.validation_min || "",
            validation_max: refVersion.validation_max || "",
            identifier: refVersion.identifier === "y",
            branching_logic: refVersion.branching_logic || "",
            field_annotation: refVersion.field_annotation || "",
            matrix_group_name: matrixGroupName,
            matrix_ranking: Boolean(matrixGroupName),
        };

        const newKey = `${formId}_${foundSection.section_name}_${variableName}`;
        setEditedQuestions(prev => ({
            ...prev,
            [newKey]: baseClone
        }));

        // 4) Direkt speichern (API-Call)
        try {
            const token = localStorage.getItem("token");
            const payload = {
                ...baseClone,
                change_type: "changed",
                change_annotation: "Added to matrix group",
            };

            await axios.put(
                `http://localhost:5000/api/questions/${v0.id}`,
                {new_data: payload},
                {headers: {Authorization: `Bearer ${token}`}}
            );

            await fetchAllQuestions(); // aktualisiert das UI
        } catch (err) {
            console.error("Error while adding to matrix:", err);
            alert("Could not add question to matrix.");
        }

        // 5) Add-UI wieder schließen
        setAddingToMatrix(prev => {
            const c = {...prev};
            delete c[uniqueGroupKey];
            return c;
        });
    };

    const handleRemoveFromMatrix = async (questionId, variableName, formId, sectionName) => {
  const token = localStorage.getItem("token");

  try {
    const payload = {
      matrix_group_name: "",
      change_type: "changed",
      change_annotation: "Removed from matrix group"
    };

    const res = await axios.put(
      `http://localhost:5000/api/questions/${questionId}`,
      { new_data: payload },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const updatedVersion = res.data.all_versions[0];

    // Frage im forms-State ersetzen
    setForms(prevForms =>
      prevForms.map(f => {
        if (f.form_id !== formId) return f;

        return {
          ...f,
          sections: f.sections.map(sec => {
            if (sec.section_name !== sectionName) return sec;

            return {
              ...sec,
              questions: sec.questions.map(q => {
                if (q.versions[0].variable_name !== variableName) return q;

                return {
                  ...q,
                  versions: [updatedVersion, ...q.versions]
                };
              })
            };
          })
        };
      })
    );

    // ❌ nachdem du forms aktualisiert hast, lösche die geladene Version:
const questionKey = `${formId}_${sectionName}_${variableName}`;
setActiveVersions(prev => {
  const copy = { ...prev };
  delete copy[questionKey];
  return copy;
});


    alert("✅ Question removed from matrix group.");
  } catch (err) {
    console.error("❌ Fehler beim Entfernen:", err);
    alert("Fehler beim Entfernen");
  }
};




    const toggleMatrixRow = (rowKey) => {
        setExpandedMatrixRows(prev => ({
            ...prev,
            [rowKey]: !prev[rowKey]
        }));
    };

    const validateBranchingLogic = (questionKey, value) => {
  const trimmed = value.trim();
  // leer = keine Fehlermeldung
  if (!trimmed) {
    setBranchingLogicErrors(prev => ({ ...prev, [questionKey]: "" }));
    return;
  }
  // nur Syntax prüfen, exakt wie in REDCap
  const regex = /^(\s*\[[^\[\]]+\]\s*(=|<>|<=|>=|<|>)\s*".*?"\s*)(\s*(and|or)\s*\[[^\[\]]+\]\s*(=|<>|<=|>=|<|>)\s*".*?"\s*)*$/i;
  const ok = regex.test(trimmed);
  setBranchingLogicErrors(prev => ({
    ...prev,
    [questionKey]: ok ? "" : 'Ungültige Syntax. Nutze z.B. [frage1] = "1" and [frage2] = "2"',
  }));
};


    const toggleActiveCustomVersion = (questionId, versionId) => {
        const current = activeCustomVersion[questionId];
        const updated =
            current === versionId
                ? {...activeCustomVersion, [questionId]: undefined} // 🟡 Deaktivieren
                : {...activeCustomVersion, [questionId]: versionId}; // 🟢 Aktivieren

        setActiveCustomVersion(updated);
        localStorage.setItem("activeCustomVersions", JSON.stringify(updated));
    };


    // --------------------------------------------------
    // Predefined options for "field_type"
    // --------------------------------------------------
    const fieldTypeOptions = [
        "text",
        "notes",
        "calc",
        "dropdown",
        "radio",
        "checkbox",
        "yesno",
        "truefalse",
        "file",
        "slider",
        "descriptive",
    ];

    // --------------------------------------------------
    // Predefined options for "validation_type"
    // --------------------------------------------------
    const validationTypeOptions = [
        "date_dmy",
        "date_mdy",
        "date_ymd",
        "datetime_dmy",
        "datetime_mdy",
        "datetime_ymd",
        "datetime_seconds_dmy",
        "datetime_seconds_mdy",
        "datetime_seconds_ymd",
        "email",
        "integer",
        "number",
        "number_1dp_comma_decimal",
        "number_2dp_comma_decimal",
        "number_3dp_comma_decimal",
        "number_4dp_comma_decimal",
        "phone",
        "postalcode_germany",
        "time_hh_mm_ss",
        "time",
        "zipcode",
    ];

    const normalizeChoicesToString = (choices) => {
        if (typeof choices === "string") return choices;
        if (Array.isArray(choices))
            return choices.map((c) => `${c.value}, ${c.label}`).join(" | ");
        if (typeof choices === "object" && choices !== null)
            return Object.entries(choices)
                .map(([value, label]) => `${value}, ${label}`)
                .join(" | ");
        return "";
    };

    const buildSliderChoicesString = (min, mid, max) => {
        const parts = [];
        if (min) parts.push(min.trim());
        if (mid) parts.push(mid.trim());
        if (max) parts.push(max.trim());
        return parts.join(" | ");
    };

    // Validation types that should not show Min/Max fields
    const skipMinMaxTypes = new Set([
        "email",
        "phone",
        "postalcode_germany",
        "zipcode",
    ]);

    // --------------------------------------------------
    // Helper functions for validation
    // --------------------------------------------------
    const parseDateDMY = (str) => {
        const parts = str.split("-");
        if (parts.length !== 3) return null;
        const [d, m, y] = parts.map((p) => parseInt(p, 10));
        if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
        const date = new Date(y, m - 1, d);
        return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
            ? date
            : null;
    };

    const parseDateMDY = (str) => {
        const parts = str.split("-");
        if (parts.length !== 3) return null;
        const [m, d, y] = parts.map((p) => parseInt(p, 10));
        if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
        const date = new Date(y, m - 1, d);
        return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
            ? date
            : null;
    };

    const parseDateYMD = (str) => {
        const parts = str.split("-");
        if (parts.length !== 3) return null;
        const [y, m, d] = parts.map((p) => parseInt(p, 10));
        if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
        const date = new Date(y, m - 1, d);
        return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
            ? date
            : null;
    };

    const parseTimeHMS = (str) => {
        const parts = str.split(":");
        if (parts.length !== 3) return null;
        const [h, m, s] = parts.map((p) => parseInt(p, 10));
        if ([h, m, s].some((x) => isNaN(x))) return null;
        if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return null;
        return h * 3600 + m * 60 + s;
    };

    const parseTimeHM = (str) => {
        const parts = str.split(":");
        if (parts.length !== 2) return null;
        const [h, m] = parts.map((p) => parseInt(p, 10));
        if (isNaN(h) || isNaN(m)) return null;
        if (h < 0 || h > 23 || m < 0 || m > 59) return null;
        return h * 3600 + m * 60;
    };

    const isInteger = (str) => /^[+-]?\d+$/.test(str);
    const isNumber = (str) => /^[+-]?\d+(\.\d+)?$/.test(str);

    const validateMinMax = (questionKey, newValues) => {
        const valType = (newValues.validation_type || "").trim();
        const minRaw = (newValues.validation_min || "").trim();
        const maxRaw = (newValues.validation_max || "").trim();

        let minError = "";
        let maxError = "";
        let minParsed = null;
        let maxParsed = null;

        // 👉 Skip completely for slider
        if (newValues.type === "slider") {
            return;
        }

        // If valType is in skipMinMaxTypes, skip min/max validation
        if (skipMinMaxTypes.has(valType)) {
            setValidationErrors((prev) => ({
                ...prev,
                [questionKey]: {min: "", max: ""},
            }));
            return;
        }

        // For all other validation_types (Date, Datetime, Integer, Number, Time):
        // Min & Max must be provided
        if (!minRaw) {
            minError = "Please enter a min value";
        }
        if (!maxRaw) {
            maxError = "Please enter a max value";
        }

        switch (valType) {
            case "date_dmy": {
                if (minRaw) {
                    const d = parseDateDMY(minRaw);
                    if (d === null) {
                        minError = "Invalid date format, expected: DD-MM-YYYY";
                    } else {
                        minParsed = d;
                    }
                }
                if (maxRaw) {
                    const d = parseDateDMY(maxRaw);
                    if (d === null) {
                        maxError = "Invalid date format, expected: DD-MM-YYYY";
                    } else {
                        maxParsed = d;
                    }
                }
                break;
            }
            case "date_mdy": {
                if (minRaw) {
                    const d = parseDateMDY(minRaw);
                    if (d === null) {
                        minError = "Invalid date format, expected: MM-DD-YYYY";
                    } else {
                        minParsed = d;
                    }
                }
                if (maxRaw) {
                    const d = parseDateMDY(maxRaw);
                    if (d === null) {
                        maxError = "Invalid date format, expected: MM-DD-YYYY";
                    } else {
                        maxParsed = d;
                    }
                }
                break;
            }
            case "date_ymd": {
                if (minRaw) {
                    const d = parseDateYMD(minRaw);
                    if (d === null) {
                        minError = "Invalid date format, expected: YYYY-MM-DD";
                    } else {
                        minParsed = d;
                    }
                }
                if (maxRaw) {
                    const d = parseDateYMD(maxRaw);
                    if (d === null) {
                        maxError = "Invalid date format, expected: YYYY-MM-DD";
                    } else {
                        maxParsed = d;
                    }
                }
                break;
            }
            case "datetime_dmy": {
                if (minRaw) {
                    const [datePart, timePart] = minRaw.split(" ");
                    const d = parseDateDMY(datePart);
                    const t = timePart ? parseTimeHM(timePart) : null;
                    if (d === null || t === null) {
                        minError = "Invalid date/time, correct format: DD-MM-YYYY HH:MM";
                    } else {
                        minParsed = new Date(d.getTime() + t * 1000);
                    }
                }
                if (maxRaw) {
                    const [datePart, timePart] = maxRaw.split(" ");
                    const d = parseDateDMY(datePart);
                    const t = timePart ? parseTimeHM(timePart) : null;
                    if (d === null || t === null) {
                        maxError = "Invalid date/time, correct format: DD-MM-YYYY HH:MM";
                    } else {
                        maxParsed = new Date(d.getTime() + t * 1000);
                    }
                }
                break;
            }
            case "datetime_mdy": {
                if (minRaw) {
                    const [datePart, timePart] = minRaw.split(" ");
                    const d = parseDateMDY(datePart);
                    const t = timePart ? parseTimeHM(timePart) : null;
                    if (d === null || t === null) {
                        minError = "Invalid date/time, correct format: MM-DD-YYYY HH:MM";
                    } else {
                        minParsed = new Date(d.getTime() + t * 1000);
                    }
                }
                if (maxRaw) {
                    const [datePart, timePart] = maxRaw.split(" ");
                    const d = parseDateMDY(datePart);
                    const t = timePart ? parseTimeHM(timePart) : null;
                    if (d === null || t === null) {
                        maxError = "Invalid date/time, correct format: MM-DD-YYYY HH:MM";
                    } else {
                        maxParsed = new Date(d.getTime() + t * 1000);
                    }
                }
                break;
            }
            case "datetime_ymd": {
                if (minRaw) {
                    const [datePart, timePart] = minRaw.split(" ");
                    const d = parseDateYMD(datePart);
                    const t = timePart ? parseTimeHM(timePart) : null;
                    if (d === null || t === null) {
                        minError = "Invalid date/time, correct format: YYYY-MM-DD HH:MM";
                    } else {
                        minParsed = new Date(d.getTime() + t * 1000);
                    }
                }
                if (maxRaw) {
                    const [datePart, timePart] = maxRaw.split(" ");
                    const d = parseDateYMD(datePart);
                    const t = timePart ? parseTimeHM(timePart) : null;
                    if (d === null || t === null) {
                        maxError = "Invalid date/time, correct format: YYYY-MM-DD HH:MM";
                    } else {
                        maxParsed = new Date(d.getTime() + t * 1000);
                    }
                }
                break;
            }
            case "datetime_seconds_dmy": {
                if (minRaw) {
                    const [datePart, timePart] = minRaw.split(" ");
                    const d = parseDateDMY(datePart);
                    const t = timePart ? parseTimeHMS(timePart) : null;
                    if (d === null || t === null) {
                        minError = "Invalid date/time, correct format: DD-MM-YYYY HH:MM:SS";
                    } else {
                        minParsed = new Date(d.getTime() + t * 1000);
                    }
                }
                if (maxRaw) {
                    const [datePart, timePart] = maxRaw.split(" ");
                    const d = parseDateDMY(datePart);
                    const t = timePart ? parseTimeHMS(timePart) : null;
                    if (d === null || t === null) {
                        maxError = "Invalid date/time, correct format: DD-MM-YYYY HH:MM:SS";
                    } else {
                        maxParsed = new Date(d.getTime() + t * 1000);
                    }
                }
                break;
            }
            case "datetime_seconds_mdy": {
                if (minRaw) {
                    const [datePart, timePart] = minRaw.split(" ");
                    const d = parseDateMDY(datePart);
                    const t = timePart ? parseTimeHMS(timePart) : null;
                    if (d === null || t === null) {
                        minError = "Invalid date/time, correct format: MM-DD-YYYY HH:MM:SS";
                    } else {
                        minParsed = new Date(d.getTime() + t * 1000);
                    }
                }
                if (maxRaw) {
                    const [datePart, timePart] = maxRaw.split(" ");
                    const d = parseDateMDY(datePart);
                    const t = timePart ? parseTimeHMS(timePart) : null;
                    if (d === null || t === null) {
                        maxError = "Invalid date/time, correct format: MM-DD-YYYY HH:MM:SS";
                    } else {
                        maxParsed = new Date(d.getTime() + t * 1000);
                    }
                }
                break;
            }
            case "datetime_seconds_ymd": {
                if (minRaw) {
                    const [datePart, timePart] = minRaw.split(" ");
                    const d = parseDateYMD(datePart);
                    const t = timePart ? parseTimeHMS(timePart) : null;
                    if (d === null || t === null) {
                        minError = "Invalid date/time, correct format: YYYY-MM-DD HH:MM:SS";
                    } else {
                        minParsed = new Date(d.getTime() + t * 1000);
                    }
                }
                if (maxRaw) {
                    const [datePart, timePart] = maxRaw.split(" ");
                    const d = parseDateYMD(datePart);
                    const t = timePart ? parseTimeHMS(timePart) : null;
                    if (d === null || t === null) {
                        maxError = "Invalid date/time, correct format: YYYY-MM-DD HH:MM:SS";
                    } else {
                        maxParsed = new Date(d.getTime() + t * 1000);
                    }
                }
                break;
            }
            case "integer": {
                if (!minRaw) {
                    minError = "Please enter a min value";
                } else if (!isInteger(minRaw)) {
                    minError = "Only whole numbers allowed";
                } else {
                    minParsed = parseInt(minRaw, 10);
                }

                if (!maxRaw) {
                    maxError = "Please enter a max value";
                } else if (!isInteger(maxRaw)) {
                    maxError = "Only whole numbers allowed";
                } else {
                    maxParsed = parseInt(maxRaw, 10);
                }
                break;
            }
            case "number": {
                if (!minRaw) {
                    minError = "Please enter a min value";
                } else if (!isNumber(minRaw)) {
                    minError = "Only numeric values allowed";
                } else {
                    minParsed = parseFloat(minRaw.replace(",", "."));
                }

                if (!maxRaw) {
                    maxError = "Please enter a max value";
                } else if (!isNumber(maxRaw)) {
                    maxError = "Only numeric values allowed";
                } else {
                    maxParsed = parseFloat(maxRaw.replace(",", "."));
                }
                break;
            }
            case "number_1dp_comma_decimal": {
                const regex = /^[+-]?\d+,\d{1}$/;
                if (!minRaw) {
                    minError = "Please enter a min value";
                } else if (!regex.test(minRaw)) {
                    minError = "Only numbers with exactly 1 decimal place allowed";
                } else {
                    minParsed = parseFloat(minRaw.replace(",", "."));
                }

                if (!maxRaw) {
                    maxError = "Please enter a max value";
                } else if (!regex.test(maxRaw)) {
                    maxError = "Only numbers with exactly 1 decimal place allowed";
                } else {
                    maxParsed = parseFloat(maxRaw.replace(",", "."));
                }
                break;
            }
            case "number_2dp_comma_decimal": {
                const regex = /^[+-]?\d+,\d{2}$/;
                if (!minRaw) {
                    minError = "Please enter a min value";
                } else if (!regex.test(minRaw)) {
                    minError = "Only numbers with exactly 2 decimal places allowed";
                } else {
                    minParsed = parseFloat(minRaw.replace(",", "."));
                }

                if (!maxRaw) {
                    maxError = "Please enter a max value";
                } else if (!regex.test(maxRaw)) {
                    maxError = "Only numbers with exactly 2 decimal places allowed";
                } else {
                    maxParsed = parseFloat(maxRaw.replace(",", "."));
                }
                break;
            }
            case "number_3dp_comma_decimal": {
                const regex = /^[+-]?\d+,\d{3}$/;
                if (!minRaw) {
                    minError = "Please enter a min value";
                } else if (!regex.test(minRaw)) {
                    minError = "Only numbers with exactly 3 decimal places allowed";
                } else {
                    minParsed = parseFloat(minRaw.replace(",", "."));
                }

                if (!maxRaw) {
                    maxError = "Please enter a max value";
                } else if (!regex.test(maxRaw)) {
                    maxError = "Only numbers with exactly 3 decimal places allowed";
                } else {
                    maxParsed = parseFloat(maxRaw.replace(",", "."));
                }
                break;
            }
            case "number_4dp_comma_decimal": {
                const regex = /^[+-]?\d+,\d{4}$/;
                if (!minRaw) {
                    minError = "Please enter a min value";
                } else if (!regex.test(minRaw)) {
                    minError = "Only numbers with exactly 4 decimal places allowed";
                } else {
                    minParsed = parseFloat(minRaw.replace(",", "."));
                }

                if (!maxRaw) {
                    maxError = "Please enter a max value";
                } else if (!regex.test(maxRaw)) {
                    maxError = "Only numbers with exactly 4 decimal places allowed";
                } else {
                    maxParsed = parseFloat(maxRaw.replace(",", "."));
                }
                break;
            }
            case "time_hh_mm_ss": {
                if (!minRaw) {
                    minError = "Please enter a min value";
                } else {
                    const t = parseTimeHMS(minRaw);
                    if (t === null) {
                        minError = "Only time format HH:MM:SS allowed";
                    } else {
                        minParsed = t;
                    }
                }

                if (!maxRaw) {
                    maxError = "Please enter a max value";
                } else {
                    const t = parseTimeHMS(maxRaw);
                    if (t === null) {
                        maxError = "Only time format HH:MM:SS allowed";
                    } else {
                        maxParsed = t;
                    }
                }
                break;
            }
            case "time": {
                if (!minRaw) {
                    minError = "Please enter a min value";
                } else {
                    const t = parseTimeHM(minRaw);
                    if (t === null) {
                        minError = "Only time format HH:MM allowed";
                    } else {
                        minParsed = t;
                    }
                }

                if (!maxRaw) {
                    maxError = "Please enter a max value";
                } else {
                    const t = parseTimeHM(maxRaw);
                    if (t === null) {
                        maxError = "Only time format HH:MM allowed";
                    } else {
                        maxParsed = t;
                    }
                }
                break;
            }
            default:
                break;
        }

        if (!minError && !maxError && minParsed !== null && maxParsed !== null) {
            if (typeof minParsed === "number" && typeof maxParsed === "number") {
                if (!(maxParsed > minParsed)) {
                    maxError = "Max must be greater than Min";
                }
            } else if (minParsed instanceof Date && maxParsed instanceof Date) {
                if (!(maxParsed.getTime() > minParsed.getTime())) {
                    maxError = "Max date must be after Min date";
                }
            }
        }

        setValidationErrors((prev) => ({
            ...prev,
            [questionKey]: {
                min: minError,
                max: maxError,
            },
        }));
    };

    // --------------------------------------------------
    // Load all questions/forms from the backend
    // --------------------------------------------------
    const fetchAllQuestions = async () => {
        try {
            const res = await axios.get("http://localhost:5000/api/questions/all");
            setForms(res.data);
        } catch (err) {
            console.error("Error loading questions:", err);
            alert("Error loading questions.");
        }
    };

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const token = localStorage.getItem("token");

                // Load all questions
                const questionsRes = await axios.get("http://localhost:5000/api/questions/all");
                setForms(questionsRes.data);

                // Load profile
                const profileRes = await axios.get("http://localhost:5000/api/user/profile", {
                    headers: {Authorization: `Bearer ${token}`},
                });
                setProfile(profileRes.data);
            } catch (err) {
                console.error("Error loading questions or profile:", err);
                alert("Error loading data.");
            }
        };

        fetchAll();
    }, []);

    // --------------------------------------------------
    // Toggle form open/close
    // --------------------------------------------------
    const toggleForm = (formId) => {
        setExpandedForms((prev) => ({
            ...prev,
            [formId]: !prev[formId],
        }));
    };

    // --------------------------------------------------
    // Toggle section open/close
    // --------------------------------------------------
    const toggleSection = (formId, sectionName) => {
        const key = `${formId}-${sectionName}`;
        setExpandedSections((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const validateSliderFields = (questionKey, values) => {
        const errors = {};

        const validate = (field, value) => {
            if (!value) {
                return "This field cannot be empty";
            }
            const parts = value.split(",").map((p) => p.trim());
            if (parts.length !== 2) {
                return "Format must be: Number, Text";
            }
            const [num, label] = parts;
            if (!/^\d+$/.test(num)) {
                return "The first part must be a whole number";
            }
            if (!label) {
                return "The second part cannot be empty";
            }
            return "";
        };

        errors.slider_min = validate("slider_min", values.slider_min);
        errors.slider_max = validate("slider_max", values.slider_max);
        if (values.slider_mid) {
            errors.slider_mid = validate("slider_mid", values.slider_mid);
        }

        setValidationErrors((prev) => ({
            ...prev,
            [questionKey]: {
                ...(prev[questionKey] || {}),
                ...errors,
            },
        }));
    };

    function validateChoiceOptions(questionKey, choicesString, type) {
        let errorMessage = "";
        let isValid = true;

        // 1) Dropdown/Radio/Checkbox prüfen
        if (["radio", "checkbox", "dropdown"].includes(type)) {
            const parts = choicesString.split("|").map(p => p.trim());
            if (
                parts.length === 0 ||
                parts.some(p => !/^\d+\s*,\s*.+$/.test(p))
            ) {
                errorMessage = "Choices must be in the format: `1, Option A | 2, Option B`";
                isValid = false;
            }
        }

        // 2) Calc‑Feld prüfen
        if (type === "calc") {
            const cleaned = choicesString.trim();

            // Leer ist okay
            if (!cleaned) {
                isValid = true;
            } else {
                // a) mindestens eine Ziffer oder eine [Variable] muss drin sein
                if (!/[0-9\[]/.test(cleaned)) {
                    errorMessage = "Calc muss mindestens eine Zahl oder eine [Variable] enthalten.";
                    isValid = false;
                }
                // b) nur Zahlen, Operatoren, Leerzeichen, runde und eckige Klammern erlauben
                else {
                    const strictPattern = /^[0-9+\-*/^()\s\[\]]+$/;
                    if (!strictPattern.test(cleaned)) {
                        errorMessage = "Nur Zahlen, Operatoren (+ - * / ^), runde Klammern und [Variablen] erlaubt.";
                        isValid = false;
                    } else {
                        // c) Klammernbalance prüfen
                        const open = (cleaned.match(/\[/g) || []).length;
                        const close = (cleaned.match(/\]/g) || []).length;
                        if (open !== close) {
                            errorMessage = "Ungepaarte eckige Klammern in der Formel.";
                            isValid = false;
                        }
                    }
                }
            }
        }

        // Ergebnis in den State schreiben
        setValidationErrors(prev => ({
            ...prev,
            [questionKey]: {
                ...prev[questionKey],
                choices: isValid ? "" : errorMessage,
            },
        }));

        return isValid;
    }


    // --------------------------------------------------
    // Handle individual input field changes
    // --------------------------------------------------
    const handleInputChange = (
  questionKey,
  field,
  value,
  formId,
  sectionName = null
) => {
  // 1) Aktuellen Draft holen und neues Feld setzen
  const current = editedQuestions[questionKey] || {};
  const newValues = { ...current, [field]: value };

  // 2) Standard-Resets für Validation-Felder
  if (field === "type" && value !== "text") {
    newValues.validation_type = "";
    newValues.validation_min = "";
    newValues.validation_max = "";
  }
  if (field === "validation_type") {
    newValues.validation_min = "";
    newValues.validation_max = "";
  }
  if (["slider_min", "slider_mid", "slider_max"].includes(field)) {
    newValues.choices = buildSliderChoicesString(
      field === "slider_min" ? value : current.slider_min,
      field === "slider_mid" ? value : current.slider_mid,
      field === "slider_max" ? value : current.slider_max
    );
  }

  // ───────────── NEUE MATRIX-LOGIK ─────────────
  // Sobald matrix_group_name geändert wird, setzen wir matrix_ranking
  if (field === "matrix_group_name") {
    // true, wenn der Name nicht nur aus Leerzeichen besteht
    newValues.matrix_ranking = newValues.matrix_group_name.trim() !== "";
  }
  // ───────────── ENDE MATRIX-LOGIK ─────────────

  // 3) Draft-State speichern und ggf. Choice-Validation auslösen
  setEditedQuestions(prev => {
    const updated = { ...prev, [questionKey]: newValues };
    const updatedType = newValues.type || "text";
    if (
      ["radio", "checkbox", "dropdown", "calc"].includes(updatedType)
    ) {
      validateChoiceOptions(questionKey, newValues.choices, updatedType);
    }
    return updated;
  });

  // 4) übrige Validierungen
  if (["validation_type", "validation_min", "validation_max"].includes(field)) {
    validateMinMax(questionKey, newValues);
  }
  if (["slider_min", "slider_mid", "slider_max"].includes(field)) {
    validateSliderFields(questionKey, newValues);
  }
  if (field === "branching_logic") {
    const validVars =
      forms
        .find(f => f.form_id === formId)
        ?.sections.flatMap(sec =>
          sec.questions.map(q => q.versions[0].variable_name)
        ) || [];
    validateBranchingLogic(questionKey, value, validVars);
  }
};



    // --------------------------------------------------
    // Load a specific version (new or old) for editing
    // --------------------------------------------------
    const loadVersion = (formId, sectionName, variableName, versionData) => {
        const questionKey = `${formId}_${sectionName}_${variableName}`;
        setActiveVersions((prev) => ({
            ...prev,
            [questionKey]: versionData,
        }));

        let choicesStr = "";
        let sliderMin = "";
        let sliderMid = "";
        let sliderMax = "";

        if (versionData.type === "slider") {
            const parts = (typeof versionData.choices === "string" ? versionData.choices : "")
                .split("|")
                .map((p) => p.trim());

            if (parts.length >= 1) sliderMin = parts[0];
            if (parts.length === 3) {
                sliderMid = parts[1];
                sliderMax = parts[2];
            } else if (parts.length === 2) {
                sliderMax = parts[1];
            }

            choicesStr = parts.join(" | ");
        } else {
            if (Array.isArray(versionData.choices)) {
                choicesStr = versionData.choices.map((c) => `${c.value}, ${c.label}`).join(" | ");
            } else if (typeof versionData.choices === "string") {
                choicesStr = versionData.choices;
            } else if (typeof versionData.choices === "object" && versionData.choices !== null) {
                choicesStr = Object.entries(versionData.choices)
                    .map(([value, label]) => `${value}, ${label}`)
                    .join(" | ");
            }
        }

        const toEdit = {
            variable_name: versionData.variable_name || "",
            question_text: versionData.question_text || "",
            type: versionData.type || "",
            required: versionData.required ?? false,
            choices: choicesStr,
            slider_min: sliderMin,
            slider_mid: sliderMid,
            slider_max: sliderMax,
            validation_type: versionData.validation_type || "",
            validation_min: versionData.validation_min || "",
            validation_max: versionData.validation_max || "",
            identifier: versionData.identifier || "",
            branching_logic: versionData.branching_logic || "",
            field_annotation: versionData.field_annotation || "",
            matrix_group_name: versionData.matrix_group_name || "",
            matrix_ranking: versionData.matrix_ranking ?? false,
        };

        setEditedQuestions((prev) => ({
            ...prev,
            [questionKey]: toEdit,
        }));

        if (["radio", "checkbox", "dropdown"].includes(versionData.type)) {
            setTimeout(() => validateChoiceOptions(questionKey, choicesStr), 0);
        }

        validateMinMax(questionKey, toEdit);
        if (versionData.type === "slider") {
            validateSliderFields(questionKey, toEdit);
        }
        if (["radio", "checkbox", "dropdown"].includes(versionData.type)) {
            validateChoiceOptions(questionKey, choicesStr);
        }
    };

// --------------------------------------------------
// Save (create new version) and refresh state
// --------------------------------------------------
    const handleSave = async (questionId, questionKey, formId) => {
        const errs = validationErrors[questionKey] || {};
        const updated = {...(editedQuestions[questionKey] || {})};
        const active = activeVersions[questionKey] || {};
        const changeType = changeTypes[questionKey] || "changed";

        // 1) Check auf Änderungen
        const hasChanged = Object.keys(updated).some(k =>
            updated[k] !== undefined && updated[k] !== active[k]
        );
        if (!hasChanged) {
            alert("No changes were made.");
            return;
        }

        if (updated.type === "text") {
            // nur dann Validation Type erzwingen, wenn min oder max gesetzt sind
            const wantsMinMax = updated.validation_min || updated.validation_max;
            if (wantsMinMax && !updated.validation_type) {
                alert("Please select a validation type for your Min/Max values.");
                return;
            }
            // falls ein Validation Type gewählt wurde und Min/Max nicht übersprungen werden,
            // prüfe auf bestehende Fehler
            if (
                updated.validation_type &&
                !skipMinMaxTypes.has(updated.validation_type) &&
                (errs.min || errs.max)
            ) {
                alert("Please fix all validation errors first.");
                return;
            }
        }

        setSavingStatus(prev => ({...prev, [questionKey]: "saving"}));

        // ───────────────────────────────
        // 3) JOIN EXISTIERENDER MATRIX
        if (
            updated.matrix_group_name &&
            updated.matrix_group_name !== active.matrix_group_name
        ) {
            // finde das Form-Objekt per Parameter formId
            const formObj = forms.find(f => f.form_id === formId);
            let repVersion = null;
            if (formObj) {
                outer: for (const sec of formObj.sections) {
                    for (const qObj of sec.questions) {
                        const v0 = qObj.versions[0];
                        if (v0.matrix_group_name === updated.matrix_group_name) {
                            const repKey = `${formId}_${sec.section_name}_${v0.variable_name}`;
                            repVersion = activeVersions[repKey] || v0;
                            break outer;
                        }
                    }
                }
            }

            console.group("🔍 Matrix-Join Debug");
            console.log(" questionKey:", questionKey);
            console.log(" formId:", formId);
            console.log(" updated.matrix_group_name:", updated.matrix_group_name);
            console.log(" found repVersion:", repVersion);
            console.groupEnd();

            if (repVersion) {
                // **Kopiere ALLE Felder 1:1** außer question_text und variable_name
                updated.type = repVersion.type;
                updated.required = repVersion.required;
                updated.choices = normalizeChoicesToString(repVersion.choices);

                // ⚠️ hier prüfen wir auf repVersion.type, nicht repVersion.field_type
                if (repVersion.type === "slider") {
                    const parts = updated.choices.split("|").map(p => p.trim());
                    updated.slider_min = parts[0] || "";
                    updated.slider_mid = parts[1] || "";
                    updated.slider_max = parts[2] || "";
                }

                updated.validation_type = repVersion.validation_type;
                updated.validation_min = repVersion.validation_min;
                updated.validation_max = repVersion.validation_max;
                updated.identifier = repVersion.identifier;
                updated.branching_logic = repVersion.branching_logic;
                updated.field_annotation = repVersion.field_annotation;
                // matrix-Props beibehalten
                updated.matrix_ranking = true;
            }
        }
        // ───────────────────────────────

        // 4) Choices parsen
        let parsedChoices = updated.choices;
        if (typeof parsedChoices === "string" && parsedChoices.includes("|")) {
            parsedChoices = parsedChoices.split("|").map(pair => {
                const [value, label] = pair.split(",").map(s => s.trim());
                return {value, label};
            });
        }

        // 5) Payload bauen
        const cleanedData = {
  variable_name: updated.variable_name,
  label:           updated.question_text,
  field_type:      updated.type,
  choices:         parsedChoices,
  required:        updated.required ?? false,
  dependencies:    updated.dependencies ?? "",
  validation_type: updated.validation_type ?? "",
  validation_min:  updated.validation_min ?? "",
  validation_max:  updated.validation_max ?? "",
  identifier:      updated.identifier ? "y" : "",
  branching_logic: updated.branching_logic ?? "",
  field_annotation: updated.field_annotation ?? "",
  change_type:     changeType,
  change_annotation: changeAnnotations[questionKey] || "",
  // Matrix-Felder: group-name immer mitgeben, ranking automatisch aus dem Namen ableiten
  matrix_group_name: updated.matrix_group_name ?? "",
  matrix_ranking:    Boolean(updated.matrix_group_name),
};


        console.log("→ Final payload for save:", cleanedData);

        // 6) Request ans Backend
        try {
            const token = localStorage.getItem("token");
            const res = await axios.put(
                `http://localhost:5000/api/questions/${questionId}`,
                {new_data: cleanedData},
                {headers: {"Content-Type": "application/json", Authorization: `Bearer ${token}`}}
            );
            console.log("→ Save response:", res.data);

            setSavingStatus(prev => ({...prev, [questionKey]: "saved"}));
            setTimeout(() => {
                setSavingStatus(prev => {
                    const n = {...prev};
                    delete n[questionKey];
                    return n;
                });
            }, 3000);

            await fetchAllQuestions();
        } catch (err) {
            console.error("❌ Error saving:", err);
            setSavingStatus(prev => ({...prev, [questionKey]: "error"}));
        }
    };




    const handleCloneQuestion = async (questionId) => {
        const newVar = cloneInput.trim();
        if (!newVar) {
            setCloneError("Please enter a variable name");
            return;
        }

        try {
            const token = localStorage.getItem("token");
            await axios.put(
                `http://localhost:5000/api/questions/${questionId}`,
                {new_data: {variable_name: newVar}},
                {headers: {Authorization: `Bearer ${token}`}}
            );
            // Refetch & reset UI
            await fetchAllQuestions();
            setCloneInput("");
            setCloneError("");
            setCloningKey(null);
        } catch (err) {
            console.error("Fehler beim Anlegen der neuen Frage:", err);
            setCloneError("Could not clone this question. Please try again.");
        }
    };


    // --------------------------------------------------
    // Delete a single version
    // --------------------------------------------------
    const handleDelete = async (questionId) => {
        const confirmed = window.confirm(
            "Are you sure you want to delete this version? This action cannot be undone."
        );
        if (!confirmed) return;

        try {
            await axios.delete(`http://localhost:5000/api/questions/${questionId}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                },
            });
            await fetchAllQuestions();

            setActiveVersions((prev) => {
                const copy = {...prev};
                Object.keys(copy).forEach((key) => {
                    if (copy[key].id === questionId) {
                        delete copy[key];
                    }
                });
                return copy;
            });

            setEditedQuestions((prev) => {
                const copy = {...prev};
                Object.keys(copy).forEach((key) => {
                    if (key.includes(questionId)) {
                        delete copy[key];
                    }
                });
                return copy;
            });

            setValidationErrors((prev) => {
                const copy = {...prev};
                Object.keys(copy).forEach((key) => {
                    if (copy[key] && copy[key].questionKey === questionId) {
                        delete copy[key];
                    }
                });
                return copy;
            });
        } catch (err) {
            console.error("❌ Error deleting version:", err);
            alert("Error deleting version.");
        }
    };

    // --------------------------------------------------
    // Live filter: filter forms, sections, and questions
    // --------------------------------------------------
    const getFilteredForms = () => {
        if (!searchTerm.trim()) {
            return forms;
        }
        const term = searchTerm.toLowerCase();

        return forms
            .map((form) => {
                const filteredSections = form.sections
                    .map((section) => {
                        const filteredQuestions = section.questions.filter((q) => {
                            const questionKey = `${form.form_id}_${section.section_name}_${q.versions[0].variable_name}`;
                            const active = activeVersions[questionKey] || q.versions[0];
                            const edited = editedQuestions[questionKey] || {};
                            const text =
                                (edited.question_text || active.question_text || "").toLowerCase();
                            return text.includes(term);
                        });
                        if (filteredQuestions.length > 0) {
                            return {
                                ...section,
                                questions: filteredQuestions,
                            };
                        }
                        return null;
                    })
                    .filter(Boolean);

                if (filteredSections.length > 0) {
                    return {
                        ...form,
                        sections: filteredSections,
                    };
                }
                return null;
            })
            .filter(Boolean);
    };

    const filteredForms = getFilteredForms();


// --------------------------------------------------
// Render function
// --------------------------------------------------
    return (
        <div className="p-8">
            <h1 className="text-4xl font-bold text-blue-800 mb-6">Edit Questions</h1>

            {/* Search field (live filter) */}
            <div className="mb-6">
                <input
                    type="text"
                    placeholder="🔍 Search question..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full border px-2 py-1 rounded"
                />
            </div>

            {filteredForms.map(form => {
                // ──────────────────────────────────────────────
                // ① Gruppierung pro Form
                const allWithDyn = form.sections.flatMap(section =>
  section.questions.map(q => {
    const questionKey = `${form.form_id}_${section.section_name}_${q.versions[0].variable_name}`;

    // 1) Wurde per loadVersion eine Version zum Editieren geladen?
    const loadedVersion = activeVersions[questionKey];

// Fallback: finde die Version mit dem neuesten last_edited_at
const latestEditedVersion = q.versions.reduce((best, v) => {
  return new Date(v.last_edited_at) > new Date(best.last_edited_at) ? v : best;
}, q.versions[0]);

const versionForGrouping = loadedVersion || latestEditedVersion;


    return {
      section,
      q,
      versionForGrouping,
      dynRank: !!versionForGrouping.matrix_group_name,
      dynGroup: versionForGrouping.matrix_group_name
    };
  })
);



                // ② Matrix-Gruppen
                const matrixGroups = allWithDyn
                    .filter(item => item.dynRank && item.dynGroup)
                    .reduce((acc, {section, q, versionForGrouping, dynGroup}) => {
                        if (!acc[dynGroup]) acc[dynGroup] = [];
                        acc[dynGroup].push({section, q, versionForGrouping});
                        return acc;
                    }, {});

                // ③ Single-Gruppen
                const singleGroups = allWithDyn
                    .filter(item => !(item.dynRank && item.dynGroup))
                    .map(item => [{section: item.section, q: item.q, versionForGrouping: item.versionForGrouping}]);

                // ④ Alle Gruppen
                const groups = [
                    ...Object.values(matrixGroups),
                    ...singleGroups
                ];
                // ──────────────────────────────────────────────

                return (
                    <div key={form.form_id} className="mb-8">
                        {/* Form heading */}
                        <div
                            onClick={() => toggleForm(form.form_id)}
                            className="cursor-pointer select-none text-2xl font-semibold text-gray-800 mb-2"
                        >
                            {expandedForms[form.form_id] ? "📂" : "📁"} {form.form_name}
                        </div>

                        {expandedForms[form.form_id] &&
                            form.sections.map(section => {
                                const sectionKey = `${form.form_id}-${section.section_name}`;
                                const sectionGroups = groups.filter(group =>
                                    group[0].section.section_name === section.section_name
                                );
                                if (sectionGroups.length === 0) return null;

                                return (
                                    <div key={sectionKey} className="mb-6 pl-4 border-l-4 border-blue-200">
                                        {/* Section heading */}
                                        <div
                                            onClick={() => toggleSection(form.form_id, section.section_name)}
                                            className="cursor-pointer select-none text-xl font-medium text-gray-700 mb-3"
                                        >
                                            {expandedSections[sectionKey] ? "📖" : "📘"} {section.section_name}
                                        </div>

                                        {expandedSections[sectionKey] && sectionGroups.map(groupEntries => {
                                            const repMatrix = groupEntries.find(e => !!e.versionForGrouping.matrix_group_name);
                      const rep = repMatrix
                        ? repMatrix.versionForGrouping
                        : groupEntries[0].versionForGrouping;

                      // 2) Den Gruppennamen aus allen Einträgen extrahieren (oder null)
                      const matrixGroupName = [...new Set(
                        groupEntries
                          .map(e => e.versionForGrouping.matrix_group_name)
                          .filter(Boolean)
                      )][0] || null;

                      // 3) Ist es eine Matrix-Gruppe?
                      const isMatrix = matrixGroupName !== null;

const groupKey = isMatrix ? matrixGroupName : rep.variable_name;

                                            const prefix = isMatrix ? "matrix" : "single";
                                            const uniqueGroupKey = `${prefix}--${sectionKey}--${groupKey}`;

                                            return (
                                                <div key={uniqueGroupKey} className="bg-white shadow rounded mb-6">
                                                    {/* Group header */}
                                                    <div className="px-4 pt-4 font-semibold text-blue-800">
                                                        {isMatrix ? "🧮" : "❓"} {isMatrix ? rep.matrix_group_name : rep.question_text}
                                                    </div>

                                                    {/* ── INLINE-EDIT TABLE ── */}
                                                    <div className="px-4 pb-4 border overflow-x-auto">
                                                        <table
                                                            className="min-w-full border-collapse border border-gray-300 table-fixed">
                                                            <colgroup>
                                                                <col style={{width: "30%"}}/>
                                                                <col style={{width: "50%"}}/>
                                                                {isMatrix && <col style={{width: "20%"}}/>}
                                                            </colgroup>
                                                            <thead className="bg-gray-100">
                                                            <tr>
                                                                <th className="px-4 py-2 border text-left">variable_name</th>
                                                                <th className="px-4 py-2 border text-left">question</th>
                                                                {isMatrix &&
                                                                    <th className="px-4 py-2 border text-left">options</th>}
                                                            </tr>
                                                            </thead>
                                                            <tbody>
                                                            {groupEntries.map(({section, versionForGrouping, q}) => {
                                                                const rowKey = `${form.form_id}_${section.section_name}_${versionForGrouping.variable_name}`;
                                                                const isOpen = !!expandedMatrixRows[rowKey];

                                                                // Hilfsdaten für das Edit-Form
                                                                const questionKey = rowKey;
                                                                const validVariables = form.sections
                                                                    .flatMap(sec => sec.questions.map(q => q.versions[0].variable_name));
                                                                const sel = branchingSelection[questionKey] || {
                                                                    variable: "",
                                                                    operator: "=",
                                                                    value: ""
                                                                };
                                                                const active = activeVersions[questionKey] || versionForGrouping;
                                                                const edited = editedQuestions[questionKey] || {};
                                                                const allVersionsSorted = [...q.versions].sort(
                                                                    (a, b) => parseFloat(a.version) - parseFloat(b.version)

                                                                );

                                                                // Slider/Choices zusammenbauen
                                                                let sliderMin = "", sliderMid = "", sliderMax = "";
                                                                let rawChoices = edited.choices ?? normalizeChoicesToString(active.choices);
                                                                if (active.type === "slider" || edited.type === "slider") {
                                                                    const parts = rawChoices.split("|").map(p => p.trim()).filter(Boolean);
                                                                    if (parts.length >= 1) sliderMin = parts[0];
                                                                    if (parts.length === 2) sliderMax = parts[1];
                                                                    if (parts.length === 3) {
                                                                        sliderMid = parts[1];
                                                                        sliderMax = parts[2];
                                                                    }
                                                                    sliderMin = edited.slider_min ?? sliderMin;
                                                                    sliderMid = edited.slider_mid ?? sliderMid;
                                                                    sliderMax = edited.slider_max ?? sliderMax;
                                                                }

                                                                // Alle kombinierten Werte
                                                                const combined = {
                                                                    variable_name: edited.variable_name ?? active.variable_name,
                                                                    question_text: edited.question_text ?? active.question_text,
                                                                    type: edited.type ?? active.type,
                                                                    required: edited.required ?? active.required,
                                                                    choices: rawChoices,
                                                                    slider_min: sliderMin,
                                                                    slider_mid: sliderMid,
                                                                    slider_max: sliderMax,
                                                                    validation_type: edited.validation_type ?? active.validation_type,
                                                                    validation_min: edited.validation_min ?? active.validation_min,
                                                                    validation_max: edited.validation_max ?? active.validation_max,
                                                                    identifier: typeof edited.identifier === "boolean"
                                                                        ? edited.identifier
                                                                        : active.identifier === "y",
                                                                    branching_logic: edited.branching_logic ?? active.branching_logic,
                                                                    field_annotation: edited.field_annotation ?? active.field_annotation,
                                                                    matrix_group_name: edited.matrix_group_name ?? active.matrix_group_name,
                                                                    matrix_ranking: edited.matrix_ranking ?? active.matrix_ranking,
                                                                };

                                                                // Validierungsflags
                                                                const isTextBoxType = combined.type === "text";
                                                                const showMinMax = isTextBoxType && combined.validation_type && !skipMinMaxTypes.has(combined.validation_type);
                                                                const errs = validationErrors[questionKey] || {};
                                                                const isEmpty = !combined.question_text?.trim();
                                                                const needMinMax = combined.validation_type
                                                                    ? (!combined.validation_min || !combined.validation_max || errs.min || errs.max)
                                                                    : false;
                                                                const needChoice = ["radio", "checkbox", "dropdown", "calc"].includes(combined.type) && !!errs.choices;
                                                                const sliderErr = combined.type === "slider" && (!combined.slider_min || !!errs.slider_min || !combined.slider_max || !!errs.slider_max);
                                                                const branchErr = !!branchingLogicErrors[questionKey];
                                                                const existingGroupNames = Object.keys(matrixGroups);
                                                                const newGroupName = combined.matrix_group_name?.trim();
                                                                // questionKey und matrixGroupName hast du ja schon
const editingGroupName = (matrixConfigInputs[questionKey]?.matrix_group_name ?? combined.matrix_group_name).trim();

// prüfe Duplicate nur, wenn wir gerade im Matrix-Modus sind
const isDuplicateGroupName =
  editingGroupName &&
  existingGroupNames
    .filter(n => n !== matrixGroupName) // eigene Gruppe rausfiltern
    .includes(editingGroupName)

if (isDuplicateGroupName) {
  errs.matrixGroupName = "This matrix name already exists."
}
                                                                const disableSave = isEmpty || needMinMax || needChoice || sliderErr || branchErr || isDuplicateGroupName;
                                                                const isMatrixQuestion = matrixGroupName !== null && matrixGroupName !== "";



                                                                return (
                                                                    <React.Fragment key={rowKey}>
  {/* Zusammenfassung / Klick-Zeile */}
  <tr
    className="cursor-pointer hover:bg-gray-50"
    onClick={() => toggleMatrixRow(rowKey)}
  >
    <td className="px-4 py-2 border text-left">{versionForGrouping.variable_name}</td>
    <td className="px-4 py-2 border text-left">{versionForGrouping.question_text}</td>

    {isMatrix && (
      <td className="px-4 py-2 border text-left space-x-2">
        {versionForGrouping.matrix_group_name && (
          <button
  onClick={async (e) => {
    e.stopPropagation();
    await handleRemoveFromMatrix(
      versionForGrouping.id,
      versionForGrouping.variable_name,
      form.form_id,
      section.section_name
    );

    handleInputChange(
      questionKey,
      "matrix_group_name",
      "",
      form.form_id,
      section.section_name
    );
  }}
  className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded"
>
  &lt;remove from matrix&gt;
</button>



        )}
      </td>
    )}
  </tr>


                                                                        {/* Inline-Editor */}
                                                                        {isOpen && (
                                                                            <tr>
                                                                                <td colSpan={3}
                                                                                    className="border px-4 py-4 bg-gray-50">
                                                                                    <div
                                                                                        className="grid grid-cols-2 gap-4">
                                                                                        {/* Variable Name */}
                                                                                        <label className="text-sm">
                                                                                            Variable Name:
                                                                                            <input
                                                                                                className="w-full border px-2 py-1 mt-1"
                                                                                                value={combined.variable_name}
                                                                                                onChange={e =>
                                                                                                    handleInputChange(
                                                                                                        questionKey, "variable_name", e.target.value,
                                                                                                        form.form_id, section.section_name
                                                                                                    )
                                                                                                }
                                                                                            />
                                                                                        </label>
                                                                                        {/* Question Text */}
                                                                                        <label className="text-sm">
                                                                                            Question:
                                                                                            <input
                                                                                                className="w-full border px-2 py-1 mt-1"
                                                                                                value={combined.question_text}
                                                                                                onChange={e =>
                                                                                                    handleInputChange(
                                                                                                        questionKey, "question_text", e.target.value,
                                                                                                        form.form_id, section.section_name
                                                                                                    )
                                                                                                }
                                                                                            />
                                                                                        </label>
                                                                                        {/* Type */}
                                                                                        <label className="text-sm">
                                                                                            Type:
                                                                                            <select
                                                                                                disabled={isMatrixQuestion && !["variable_name", "question_text", "choices", "field_annotation"].includes("type")}
                                                                                                className="w-full border px-2 py-1 mt-1"
                                                                                                value={combined.type}
                                                                                                onChange={e =>
                                                                                                    handleInputChange(
                                                                                                        questionKey, "type", e.target.value,
                                                                                                        form.form_id, section.section_name
                                                                                                    )
                                                                                                }
                                                                                            >
                                                                                                {fieldTypeOptions.map(opt => (
                                                                                                    <option key={opt}
                                                                                                            value={opt}>{opt}</option>
                                                                                                ))}
                                                                                                {!fieldTypeOptions.includes(combined.type) && combined.type && (
                                                                                                    <option
                                                                                                        value={combined.type}>{combined.type}</option>
                                                                                                )}
                                                                                            </select>
                                                                                        </label>
                                                                                        {/* Required */}
                                                                                        <label
                                                                                            className="flex items-center space-x-2 text-sm">
                                                                                            <input
                                                                                                type="checkbox"
                                                                                                checked={combined.required}
                                                                                                disabled={isMatrixQuestion}
                                                                                                onChange={e =>
                                                                                                    handleInputChange(questionKey, "required", e.target.checked)
                                                                                                }
                                                                                                className="form-checkbox"
                                                                                            />
                                                                                            <span>Required</span>
                                                                                        </label>
                                                                                        {/* Choices oder Slider-Felder */}
                                                                                        {combined.type === "slider" ? (
                                                                                            <>
                                                                                                <label
                                                                                                    className="text-sm">
                                                                                                    Slider minimum:
                                                                                                    <input
                                                                                                        className="w-full border px-2 py-1 mt-1"
                                                                                                        value={combined.slider_min}
                                                                                                        onChange={e =>
                                                                                                            handleInputChange(questionKey, "slider_min", e.target.value)
                                                                                                        }
                                                                                                    />
                                                                                                    {errs.slider_min &&
                                                                                                        <div
                                                                                                            className="text-red-600 text-xs mt-1">{errs.slider_min}</div>}
                                                                                                </label>
                                                                                                <label
                                                                                                    className="text-sm">
                                                                                                    Slider middle:
                                                                                                    <input
                                                                                                        className="w-full border px-2 py-1 mt-1"
                                                                                                        value={combined.slider_mid}
                                                                                                        onChange={e =>
                                                                                                            handleInputChange(questionKey, "slider_mid", e.target.value)
                                                                                                        }
                                                                                                    />
                                                                                                    {errs.slider_mid &&
                                                                                                        <div
                                                                                                            className="text-red-600 text-xs mt-1">{errs.slider_mid}</div>}
                                                                                                </label>
                                                                                                <label
                                                                                                    className="text-sm">
                                                                                                    Slider maximum:
                                                                                                    <input
                                                                                                        className="w-full border px-2 py-1 mt-1"
                                                                                                        value={combined.slider_max}
                                                                                                        onChange={e =>
                                                                                                            handleInputChange(questionKey, "slider_max", e.target.value)
                                                                                                        }
                                                                                                    />
                                                                                                    {errs.slider_max &&
                                                                                                        <div
                                                                                                            className="text-red-600 text-xs mt-1">{errs.slider_max}</div>}
                                                                                                </label>
                                                                                            </>
                                                                                        ) : (
                                                                                            <label className="text-sm">
                                                                                                Choices:
                                                                                                <input
                                                                                                    className={`w-full border px-2 py-1 mt-1 ${
                                                                                                        !["radio", "checkbox", "dropdown", "calc"].includes(combined.type)
                                                                                                            ? "bg-gray-100 cursor-not-allowed"
                                                                                                            : ""
                                                                                                    }`}
                                                                                                    disabled={!["radio", "checkbox", "dropdown", "calc"].includes(combined.type)}
                                                                                                    value={combined.choices}
                                                                                                    onChange={e => {
                                                                                                        handleInputChange(questionKey, "choices", e.target.value);
                                                                                                        validateChoiceOptions(questionKey, e.target.value, combined.type);
                                                                                                    }}
                                                                                                    onBlur={() =>
                                                                                                        validateChoiceOptions(questionKey, combined.choices, combined.type)
                                                                                                    }
                                                                                                />
                                                                                                {["radio", "checkbox", "dropdown", "calc"].includes(combined.type) && errs.choices && (
                                                                                                    <div
                                                                                                        className="text-red-600 text-xs mt-1">{errs.choices}</div>
                                                                                                )}
                                                                                            </label>
                                                                                        )}
                                                                                        {/* Validation type */}
                                                                                        <label className="text-sm">
                                                                                            Validation type:
                                                                                            <select
                                                                                                className={`w-full border px-2 py-1 mt-1 ${!isTextBoxType ? "bg-gray-100 cursor-not-allowed" : ""}`}
                                                                                                disabled={!isTextBoxType}
                                                                                                value={combined.validation_type}
                                                                                                onChange={e =>
                                                                                                    handleInputChange(questionKey, "validation_type", e.target.value)
                                                                                                }
                                                                                            >
                                                                                                <option value="">–
                                                                                                </option>
                                                                                                {validationTypeOptions.map(opt => (
                                                                                                    <option key={opt}
                                                                                                            value={opt}>{opt}</option>
                                                                                                ))}
                                                                                                {!validationTypeOptions.includes(combined.validation_type) && combined.validation_type && (
                                                                                                    <option
                                                                                                        value={combined.validation_type}>{combined.validation_type}</option>
                                                                                                )}
                                                                                            </select>
                                                                                        </label>
                                                                                        {/* Min & Max */}
                                                                                        {showMinMax && (
                                                                                            <label className="text-sm">
                                                                                                Min:
                                                                                                <input
                                                                                                    className="w-full border px-2 py-1 mt-1"
                                                                                                    value={combined.validation_min}
                                                                                                    onChange={e =>
                                                                                                        handleInputChange(questionKey, "validation_min", e.target.value)
                                                                                                    }
                                                                                                />
                                                                                                {errs.min && <div
                                                                                                    className="text-red-600 text-xs mt-1">{errs.min}</div>}
                                                                                            </label>
                                                                                        )}
                                                                                        {showMinMax && (
                                                                                            <label className="text-sm">
                                                                                                Max:
                                                                                                <input
                                                                                                    className="w-full border px-2 py-1 mt-1"
                                                                                                    value={combined.validation_max}
                                                                                                    onChange={e =>
                                                                                                        handleInputChange(questionKey, "validation_max", e.target.value)
                                                                                                    }
                                                                                                />
                                                                                                {errs.max && <div
                                                                                                    className="text-red-600 text-xs mt-1">{errs.max}</div>}
                                                                                            </label>
                                                                                        )}
                                                                                        {/* Identifier */}
                                                                                        <label
                                                                                            className="flex items-center space-x-2 text-sm">
                                                                                            <input
                                                                                                disabled={isMatrixQuestion}
                                                                                                type="checkbox"
                                                                                                checked={combined.identifier}
                                                                                                onChange={e =>
                                                                                                    handleInputChange(questionKey, "identifier", e.target.checked)
                                                                                                }
                                                                                                className="form-checkbox"
                                                                                            />
                                                                                            <span>Identifier (y)</span>
                                                                                        </label>
                                                                                        {/* Branching Logic */}
<label className="text-sm col-span-2">
  Branching logic
  <input
    type="text"
    className="w-full border px-2 py-1 mt-1"
    value={combined.branching_logic}
    disabled={isMatrixQuestion}
    onChange={e =>
      handleInputChange(questionKey, "branching_logic", e.target.value, form.form_id)
    }
    onBlur={e => validateBranchingLogic(questionKey, e.target.value)}
  />
  {branchingLogicErrors[questionKey] && (
    <div className="text-red-600 text-xs mt-1">
      {branchingLogicErrors[questionKey]}
    </div>
  )}
</label>


                                                                                        {/* Matrix ranking? */}
{/* Matrix ranking? */}
<label className="flex items-center space-x-2 text-sm">
  <input
    type="checkbox"
    checked={combined.matrix_ranking}
    disabled={!isMatrixQuestion}
    onChange={e =>
      handleInputChange(
        questionKey,
        "matrix_ranking",
        e.target.checked
      )
    }
    className="form-checkbox"
  />
  <span>Matrix ranking?</span>
</label>

{/* — Button to toggle matrix configuration — */}
<button
  className="mb-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
  onClick={() =>
    setShowMatrixConfig(prev => ({
      ...prev,
      [questionKey]: !prev[questionKey]
    }))
  }
>
  Change matrix configuration
</button>

{/* — Matrix configuration panel, always available after clicking — */}
{showMatrixConfig[questionKey] && (
  <div className="mt-3 space-y-2 border border-blue-200 p-3 bg-blue-50 rounded">
    <div className="text-sm font-semibold text-blue-900 mb-1">
      Matrix configuration:
    </div>

    {/* Matrix group name */}
    <label className="text-sm block">
      Matrix group name:
      <input
        className="w-full border px-2 py-1 mt-1"
        value={matrixConfigInputs[questionKey]?.matrix_group_name || ""}
        onChange={e =>
          setMatrixConfigInputs(prev => ({
            ...prev,
            [questionKey]: {
              ...prev[questionKey],
              matrix_group_name: e.target.value
            }
          }))
        }
      />
      {isDuplicateGroupName && (
        <div className="text-red-600 text-xs mt-1">
          This matrix name already exists.
        </div>
      )}
    </label>

    {/* Field type */}
    <label className="text-sm block">
      Field type:
      <select
        className="w-full border px-2 py-1 mt-1"
        value={matrixConfigInputs[questionKey]?.type || ""}
        onChange={e =>
          setMatrixConfigInputs(prev => ({
            ...prev,
            [questionKey]: {
              ...prev[questionKey],
              type: e.target.value
            }
          }))
        }
      >
        <option value="">— Select type —</option>
        <option value="radio">radio</option>
        <option value="checkbox">checkbox</option>
      </select>
    </label>

    {/* Choices */}
    <label className="text-sm block">
      Choices (e.g. `1, Poor | 2, Fair | 3, Good`):
      <input
        className="w-full border px-2 py-1 mt-1"
        value={matrixConfigInputs[questionKey]?.choices || ""}
        onChange={e =>
          setMatrixConfigInputs(prev => ({
            ...prev,
            [questionKey]: {
              ...prev[questionKey],
              choices: e.target.value
            }
          }))
        }
      />
    </label>

    {/* Apply button */}
    <button
      className={`mt-2 px-3 py-1 rounded ${
        matrixConfigInputs[questionKey]?.matrix_group_name &&
        matrixConfigInputs[questionKey]?.type &&
        matrixConfigInputs[questionKey]?.choices
          ? "bg-green-600 text-white hover:bg-green-700"
          : "bg-gray-300 text-gray-500 cursor-not-allowed"
      }`}
      disabled={
        !matrixConfigInputs[questionKey]?.matrix_group_name ||
        !matrixConfigInputs[questionKey]?.type ||
        !matrixConfigInputs[questionKey]?.choices
      }
      onClick={() => {
        const data = matrixConfigInputs[questionKey];
        if (!data) return;
        // update editedQuestions
        setEditedQuestions(prev => ({
          ...prev,
          [questionKey]: {
            ...(editedQuestions[questionKey] || {}),
            matrix_group_name: data.matrix_group_name,
            type: data.type,
            choices: data.choices
          }
        }));
        if (["radio", "checkbox", "dropdown", "calc"].includes(data.type)) {
          validateChoiceOptions(questionKey, data.choices, data.type);
        }
      }}
    >
      Apply
    </button>
  </div>
)}

{/* Immer sichtbares, aber deaktiviertes matrix_group_name-Feld */}
<label className="text-sm block">
  Matrix group name:
  <input
    type="text"
    className="w-full border px-2 py-1 mt-1 bg-gray-100 cursor-not-allowed"
    value={combined.matrix_group_name || ""}
    disabled
  />
</label>

{/* Always-visible, disabled matrix_group_name */}
<label className="text-sm block">
  Matrix group name:
  <input
    type="text"
    className="w-full border px-2 py-1 mt-1 bg-gray-100 cursor-not-allowed"
    value={combined.matrix_group_name || ""}
    disabled
  />
</label>

{/* If it’s empty, show a hint in English */}
{!combined.matrix_group_name && (
  <div className="text-sm text-yellow-700 italic mt-1">
    This question isn’t part of any matrix. Click “Change Matrix Configuration” to add it to a matrix.
  </div>
)}





                                                                                        {/* Annotation */}
                                                                                        <label
                                                                                            className="text-sm col-span-2">
                                                                                            Annotation:
                                                                                            <textarea
                                                                                                className="w-full border px-2 py-1 mt-1"
                                                                                                value={combined.field_annotation}
                                                                                                onChange={e =>
                                                                                                    handleInputChange(questionKey, "field_annotation", e.target.value)
                                                                                                }
                                                                                            />
                                                                                        </label>
                                                                                    </div>

                                                                                    {/* Save Button + Status */}
                                                                                    <div
                                                                                        className="mt-3 grid grid-cols-3 gap-4">
                                                                                        <label className="text-sm">
                                                                                            Change type:
                                                                                            <select
                                                                                                className="w-full border px-2 py-1 mt-1"
                                                                                                value={changeTypes[questionKey] || "changed"}
                                                                                                onChange={e =>
                                                                                                    setChangeTypes(prev => ({
                                                                                                        ...prev,
                                                                                                        [questionKey]: e.target.value
                                                                                                    }))
                                                                                                }
                                                                                            >
                                                                                                <option
                                                                                                    value="imported">imported
                                                                                                </option>
                                                                                                <option
                                                                                                    value="created">created
                                                                                                </option>
                                                                                                <option
                                                                                                    value="fixed">fixed
                                                                                                </option>
                                                                                                <option
                                                                                                    value="changed">changed
                                                                                                </option>
                                                                                            </select>
                                                                                        </label>
                                                                                        <div className="col-span-2">
                                                                                            <label className="text-sm">
                                                                                                Change note (optional):
                                                                                                <textarea
                                                                                                    className="w-full border px-2 py-1 mt-1"
                                                                                                    rows={2}
                                                                                                    value={changeAnnotations[questionKey] || ""}
                                                                                                    onChange={e =>
                                                                                                        setChangeAnnotations(prev => ({
                                                                                                            ...prev,
                                                                                                            [questionKey]: e.target.value
                                                                                                        }))
                                                                                                    }
                                                                                                />
                                                                                            </label>
                                                                                        </div>
                                                                                        <div
                                                                                            className="col-span-3 flex items-center gap-3">
                                                                                            <button
                                                                                                className={`px-4 py-1 rounded ${
                                                                                                    disableSave
                                                                                                        ? "bg-gray-400 cursor-not-allowed text-white"
                                                                                                        : "bg-blue-600 text-white hover:bg-blue-700"
                                                                                                }`}
                                                                                                disabled={disableSave}
                                                                                                onClick={() => handleSave(active.id, questionKey, form.form_id)}
                                                                                            >
                                                                                                💾 Save
                                                                                            </button>
                                                                                            {savingStatus[questionKey] === "saving" &&
                                                                                                <span
                                                                                                    className="text-blue-500">Saving...</span>}
                                                                                            {savingStatus[questionKey] === "saved" &&
                                                                                                <span
                                                                                                    className="text-green-600">Saved ✅</span>}
                                                                                            {savingStatus[questionKey] === "error" &&
                                                                                                <span
                                                                                                    className="text-red-500">Error ❌</span>}
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* Active Version Anzeige */}
                                                                                    {activeCustomVersion[questionKey] && (() => {
                                                                                        const activeV = allVersionsSorted.find(v => v.id === activeCustomVersion[questionKey]);
                                                                                        if (!activeV) return null;
                                                                                        const idx = allVersionsSorted.findIndex(v => v.id === activeV.id);
                                                                                        const prevV = allVersionsSorted[idx - 1];
                                                                                        const changedFields = [];
                                                                                        if (prevV) {
                                                                                            for (const k in activeV) {
                                                                                                if (["id", "version", "last_edited_at", "last_edited_by"].includes(k)) continue;
                                                                                                if (JSON.stringify(activeV[k]) !== JSON.stringify(prevV[k])) {
                                                                                                    changedFields.push(k);
                                                                                                }
                                                                                            }
                                                                                        }
                                                                                        return (
                                                                                            <div
                                                                                                className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
                                                                                                <div
                                                                                                    className="text-green-800 font-semibold text-sm mb-1">
                                                                                                    ✅ Active
                                                                                                    Version: {activeV.version}
                                                                                                </div>
                                                                                                <div
                                                                                                    className="text-sm text-gray-800 space-y-1">
                                                                                                    <div>
                                                                                                        <strong>Question:</strong> {activeV.question_text}
                                                                                                    </div>
                                                                                                    <div>
                                                                                                        <strong>Type:</strong> {activeV.type}
                                                                                                    </div>
                                                                                                    <div><strong>Edited
                                                                                                        by:</strong> {activeV.last_edited_by}
                                                                                                    </div>
                                                                                                    <div><strong>Edited
                                                                                                        on:</strong> {new Date(activeV.last_edited_at).toLocaleString()}
                                                                                                    </div>
                                                                                                    <div><strong>Change
                                                                                                        type:</strong> {activeV.change_type || "changed"}
                                                                                                    </div>
                                                                                                    {activeV.change_annotation &&
                                                                                                        <div>
                                                                                                            <strong>Note:</strong> {activeV.change_annotation}
                                                                                                        </div>}
                                                                                                    {changedFields.length > 0 && (
                                                                                                        <div
                                                                                                            className="mt-1 text-xs text-blue-700 flex items-center gap-1">
                                                                                                            <span
                                                                                                                className="text-sm">🧾</span>
                                                                                                            Changed
                                                                                                            fields: {changedFields.join(", ")}
                                                                                                        </div>
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    })()}

                                                                                    {/* Alle Versionen */}
                                                                                    {allVersionsSorted.length > 0 && (
                                                                                        <details
                                                                                            className="mt-4 border-t pt-2">
                                                                                            <summary
                                                                                                className="cursor-pointer text-sm text-gray-600">
                                                                                                Show versions
                                                                                                ({allVersionsSorted.length})
                                                                                            </summary>
                                                                                            <ul className="mt-2 space-y-4 text-sm text-gray-700">
                                                                                                {allVersionsSorted.map((v, i) => {
                                                                                                    const prevV = allVersionsSorted[i - 1];
                                                                                                    const changedFields = [];
                                                                                                    if (prevV) {
                                                                                                        for (const k in v) {
                                                                                                            if (["id", "version", "last_edited_at", "last_edited_by"].includes(k)) continue;
                                                                                                            if (JSON.stringify(v[k]) !== JSON.stringify(prevV[k])) {
                                                                                                                changedFields.push(k);
                                                                                                            }
                                                                                                        }
                                                                                                    }
                                                                                                    const majorVersion = Math.floor(parseFloat(v.version));
                                                                                                    const indentLevel = majorVersion > 1 ? majorVersion - 1 : 0;
                                                                                                    return (
                                                                                                        <li
                                                                                                            key={v.id}
                                                                                                            className={`border p-3 rounded flex justify-between items-start ${
                                                                                                                v.version === "1.0" ? "bg-blue-50" : "bg-gray-50"
                                                                                                            }`}
                                                                                                            style={{marginLeft: indentLevel * 20}}
                                                                                                        >
                                                                                                            <div>
                                                                                                                <div>
                                                                                                                    <strong>Version:</strong> {v.version}
                                                                                                                </div>
                                                                                                                <div>
                                                                                                                    <strong>Question:</strong> {v.question_text}
                                                                                                                </div>
                                                                                                                <div>
                                                                                                                    <strong>Type:</strong> {v.type}
                                                                                                                </div>
                                                                                                                <div>
                                                                                                                    <strong>Edited
                                                                                                                        by:</strong> {v.last_edited_by}
                                                                                                                </div>
                                                                                                                <div>
                                                                                                                    <strong>Edited
                                                                                                                        on:</strong> {new Date(v.last_edited_at).toLocaleString()}
                                                                                                                </div>
                                                                                                                <div>
                                                                                                                    <strong>Change
                                                                                                                        type:</strong> {v.change_type || "changed"}
                                                                                                                </div>
                                                                                                                {v.change_annotation &&
                                                                                                                    <div>
                                                                                                                        <strong>Note:</strong> {v.change_annotation}
                                                                                                                    </div>}
                                                                                                                {changedFields.length > 0 && (
                                                                                                                    <div
                                                                                                                        className="mt-1 text-xs text-blue-700 flex items-center gap-1">
                                                                                                                        <span
                                                                                                                            className="text-sm">🧾</span>
                                                                                                                        Changed
                                                                                                                        fields: {changedFields.join(", ")}
                                                                                                                    </div>
                                                                                                                )}
                                                                                                            </div>
                                                                                                            <div
                                                                                                                className="flex flex-col gap-2 items-end">
                                                                                                                <button
                                                                                                                    className="bg-yellow-400 text-white px-3 py-1 rounded hover:bg-yellow-500 text-sm"
                                                                                                                    onClick={() =>
                                                                                                                        loadVersion(form.form_id, section.section_name, q.versions[0].variable_name, v)
                                                                                                                    }
                                                                                                                >
                                                                                                                    Edit
                                                                                                                </button>
                                                                                                                {profile?.username === v.last_edited_by ? (
                                                                                                                    <button
                                                                                                                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm"
                                                                                                                        onClick={() => handleDelete(v.id)}
                                                                                                                    >
                                                                                                                        Delete
                                                                                                                    </button>
                                                                                                                ) : (
                                                                                                                    <button
                                                                                                                        className="bg-gray-400 text-white px-3 py-1 rounded text-sm cursor-not-allowed"
                                                                                                                        disabled
                                                                                                                    >
                                                                                                                        Delete
                                                                                                                    </button>
                                                                                                                )}
                                                                                                                <button
                                                                                                                    className={`px-3 py-1 rounded text-sm ${
                                                                                                                        activeCustomVersion[questionKey] === v.id
                                                                                                                            ? "bg-green-600 text-white"
                                                                                                                            : "bg-gray-200 hover:bg-green-200"
                                                                                                                    }`}
                                                                                                                    onClick={() => toggleActiveCustomVersion(questionKey, v.id)}
                                                                                                                >
                                                                                                                    {activeCustomVersion[questionKey] === v.id ? "✅ Active" : "Set Active"}
                                                                                                                </button>
                                                                                                                <div
                                                                                                                    className="mt-2">
                                                                                                                    <button
                                                                                                                        className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
                                                                                                                        onClick={() => {
                                                                                                                            setCloningKey(questionKey);
                                                                                                                            setCloneInput("");
                                                                                                                            setCloneError("");
                                                                                                                        }}
                                                                                                                    >
                                                                                                                        ➕
                                                                                                                        Clone
                                                                                                                        this
                                                                                                                        question
                                                                                                                    </button>
                                                                                                                    {cloningKey === questionKey && (
                                                                                                                        <div
                                                                                                                            className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded">
                                                                                                                            <label
                                                                                                                                className="block text-sm font-medium mb-1">
                                                                                                                                Enter
                                                                                                                                new
                                                                                                                                variable
                                                                                                                                name:
                                                                                                                            </label>
                                                                                                                            <input
                                                                                                                                type="text"
                                                                                                                                className="w-full border px-2 py-1 rounded"
                                                                                                                                value={cloneInput}
                                                                                                                                onChange={e => setCloneInput(e.target.value)}
                                                                                                                            />
                                                                                                                            {cloneError && (
                                                                                                                                <div
                                                                                                                                    className="text-red-600 text-xs mt-1">{cloneError}</div>
                                                                                                                            )}
                                                                                                                            <div
                                                                                                                                className="mt-2 flex space-x-2">
                                                                                                                                <button
                                                                                                                                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                                                                                                                                    onClick={async () => {
                                                                                                                                        if (!cloneInput.trim()) {
                                                                                                                                            setCloneError("Please enter a variable name");
                                                                                                                                            return;
                                                                                                                                        }
                                                                                                                                        try {
                                                                                                                                            await handleCloneQuestion(versionForGrouping.id, cloneInput.trim());
                                                                                                                                            setCloningKey(null);
                                                                                                                                        } catch {
                                                                                                                                            setCloneError("Failed to clone, try again.");
                                                                                                                                        }
                                                                                                                                    }}
                                                                                                                                >
                                                                                                                                    Clone
                                                                                                                                </button>
                                                                                                                                <button
                                                                                                                                    className="px-3 py-1 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 text-sm"
                                                                                                                                    onClick={() => setCloningKey(null)}
                                                                                                                                >
                                                                                                                                    Cancel
                                                                                                                                </button>
                                                                                                                            </div>
                                                                                                                        </div>
                                                                                                                    )}

                                                                                                                </div>
                                                                                                            </div>
                                                                                                        </li>
                                                                                                    );
                                                                                                })}
                                                                                            </ul>
                                                                                        </details>
                                                                                    )}
                                                                                </td>
                                                                            </tr>
                                                                        )}
                                                                    </React.Fragment>
                                                                );
                                                            })}

                                                            {/* — Zeile für „<hinzufügen>“ — Dropdown toggle und Auswahl */}
                                                            {isMatrix && (

                                                                <tr>
                                                                    <td colSpan={3}
                                                                        className="px-4 py-2 border text-center">
                                                                        {addingToMatrix[uniqueGroupKey] ? (
                                                                            <div
                                                                                className="flex items-center justify-center space-x-2">
                                                                                <select
                                                                                    className="border px-2 py-1 rounded"
                                                                                    value={matrixAddSelection[uniqueGroupKey] || ""}
                                                                                    onChange={e =>
                                                                                        setMatrixAddSelection(prev => ({
                                                                                            ...prev,
                                                                                            [uniqueGroupKey]: e.target.value
                                                                                        }))
                                                                                    }
                                                                                >
                                                                                    <option value="">— choose question
                                                                                        —
                                                                                    </option>
                                                                                    {form.sections
                                                                                        .flatMap(sec => sec.questions)
                                                                                        .map(qObj => qObj.versions[0].variable_name)
                                                                                        .filter(vn =>
                                                                                            // filtere alle, die schon in der Gruppe sind
                                                                                            !groupEntries
                                                                                                .map(({versionForGrouping}) => versionForGrouping.variable_name)
                                                                                                .includes(vn)
                                                                                        )
                                                                                        .map(vn => (
                                                                                            <option key={vn}
                                                                                                    value={vn}>{vn}</option>
                                                                                        ))
                                                                                    }
                                                                                </select>
                                                                                <button
                                                                                    className="px-2 py-1 text-sm bg-green-500 text-white rounded"
                                                                                    disabled={!matrixAddSelection[uniqueGroupKey]}
                                                                                    onClick={() =>
                                                                                        handleAddToMatrix(
                                                                                            form.form_id,
                                                                                            section.section_name,
                                                                                            rep.matrix_group_name,
                                                                                            uniqueGroupKey
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    Add
                                                                                </button>
                                                                                <button
                                                                                    className="px-2 py-1 text-sm bg-gray-300 rounded"
                                                                                    onClick={() =>
                                                                                        setAddingToMatrix(prev => {
                                                                                            const c = {...prev};
                                                                                            delete c[uniqueGroupKey];
                                                                                            return c;
                                                                                        })
                                                                                    }
                                                                                >
                                                                                    Cancel
                                                                                </button>
                                                                            </div>
                                                                        ) : (
                                                                            <button
                                                                                className="px-2 py-1 text-sm bg-blue-200 rounded"
                                                                                onClick={() =>
                                                                                    setAddingToMatrix(prev => ({
                                                                                        ...prev,
                                                                                        [uniqueGroupKey]: true
                                                                                    }))
                                                                                }
                                                                            >
                                                                                &lt;add&gt;
                                                                            </button>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            )}

                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                    </div>
                );
            })}
        </div>
    );
}



