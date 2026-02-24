// FormFieldRenderer.jsx — Renders a single custom form field based on its type
// Supports: text, textarea, dropdown, checkbox, file
// Used in EventDetail.jsx to display the registration form

import { useState } from "react";

export default function FormFieldRenderer({ field, value, onChange }) {
    const [isUploading, setIsUploading] = useState(false);

    async function handleFileUpload(changeEvent) {
        const file = changeEvent.target.files[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const { default: cloudinaryUpload } = await import("../utils/cloudinaryUpload");
            const fileUrl = await cloudinaryUpload(file);
            onChange(fileUrl);
        } catch (error) {
            console.error("File upload failed:", error);
            alert("File upload failed. Please try again.");
        }
        setIsUploading(false);
    }

    return (
        <div className="form-group">
            <label className="form-label">
                {field.label}
                {field.required && <span className="form-required"> *</span>}
            </label>

            {/* Text input */}
            {field.fieldType === "text" && (
                <input
                    className="form-input"
                    type="text"
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                />
            )}

            {/* Textarea input */}
            {field.fieldType === "textarea" && (
                <textarea
                    className="form-input form-textarea"
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                />
            )}

            {/* Dropdown select */}
            {field.fieldType === "dropdown" && (
                <select
                    className="form-input"
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                >
                    <option value="">— Select an option —</option>
                    {field.options.map((option, optionIndex) => (
                        <option key={optionIndex} value={option}>
                            {option}
                        </option>
                    ))}
                </select>
            )}

            {/* Checkbox group (multiple selection) */}
            {field.fieldType === "checkbox" && (
                <div className="checkbox-group">
                    {field.options.map((option, optionIndex) => {
                        const currentValues = value || [];
                        const isChecked = currentValues.includes(option);

                        return (
                            <label key={optionIndex} className="checkbox-option">
                                <input
                                    type="checkbox"
                                    className="checkbox-input"
                                    checked={isChecked}
                                    onChange={(changeEvent) => {
                                        let updatedValues;
                                        if (changeEvent.target.checked) {
                                            updatedValues = [...currentValues, option];
                                        } else {
                                            updatedValues = currentValues.filter((v) => v !== option);
                                        }
                                        onChange(updatedValues);
                                    }}
                                />
                                <span>{option}</span>
                            </label>
                        );
                    })}
                </div>
            )}

            {/* File upload */}
            {field.fieldType === "file" && (
                <div className="file-upload-wrap">
                    <label className="file-upload-label">
                        <input type="file" className="file-upload-input" onChange={handleFileUpload} />
                        <span className="file-upload-btn">
                            {isUploading ? "Uploading…" : "Choose file"}
                        </span>
                    </label>
                    {value && (
                        <a href={value} target="_blank" rel="noreferrer" className="file-upload-link">
                            ✓ View uploaded file
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}
