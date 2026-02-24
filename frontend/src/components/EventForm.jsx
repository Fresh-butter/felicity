// EventForm.jsx — Form for creating new events (normal or merchandise)

import { useState } from "react";
import FormField from "./FormField";

export default function EventForm({ initialData = null, onSubmit, onCancel }) {
    // Determine editing mode and strictness
    const isEditMode = !!initialData;
    const liveStatus = initialData?.status || "draft";
    const isDraft = liveStatus === "draft";
    const isPublished = liveStatus === "published";
    const isOngoing = liveStatus === "ongoing";
    const isCompleted = liveStatus === "completed";
    // Can edit most fields only in draft
    const isLocked = isEditMode && !isDraft;
    // Forms/merchandise are locked once any registrations exist (regardless of status)
    const hasRegistrations = (initialData?.registrationCount || 0) > 0;

    // Format dates to datetime-local friendly strings
    const formatDateTime = (dateStr) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    };

    // Native datetime-local input — browser renders 24h clock on most platforms
    function DateTimeInput({ value, onChange, disabled, required }) {
        return (
            <input
                type="datetime-local"
                className="form-input datetime-input"
                value={value || ""}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                required={required}
            />
        );
    }

    // Core event fields
    const [name, setName] = useState(initialData?.name || "");
    const [description, setDescription] = useState(initialData?.description || "");
    const [eventType, setEventType] = useState(initialData?.eventType || "normal");
    const [startDate, setStartDate] = useState(formatDateTime(initialData?.startDate));
    const [endDate, setEndDate] = useState(formatDateTime(initialData?.endDate));
    const [eligibility, setEligibility] = useState(initialData?.eligibility || "all");
    const [registrationLimit, setRegistrationLimit] = useState(initialData?.registrationLimit || 100);
    const [registrationFee, setRegistrationFee] = useState(initialData?.registrationFee || 0);
    const [tags, setTags] = useState(initialData?.tags?.join(", ") || "");
    const [status, setStatus] = useState(initialData?.status || "draft");

    // Custom form fields (for normal events)
    const [customFormFields, setCustomFormFields] = useState(initialData?.customForm || []);

    // Merchandise items (for merchandise events)
    const [merchandiseItems, setMerchandiseItems] = useState(initialData?.merchandiseItems || []);

    // Update a single property of a custom form field at a given index
    function updateCustomField(index, property, value) {
        const updatedFields = [...customFormFields];
        updatedFields[index][property] = value;
        setCustomFormFields(updatedFields);
    }

    // Update a single property of a merchandise item at a given index
    function updateMerchandiseItem(index, property, value) {
        const updatedItems = [...merchandiseItems];
        updatedItems[index][property] = value;
        setMerchandiseItems(updatedItems);
    }

    // Remove a custom form field by index
    function removeCustomField(index) {
        const updatedFields = customFormFields.filter((_, fieldIndex) => fieldIndex !== index);
        setCustomFormFields(updatedFields);
    }

    // Remove a merchandise item by index
    function removeMerchandiseItem(index) {
        const updatedItems = merchandiseItems.filter((_, itemIndex) => itemIndex !== index);
        setMerchandiseItems(updatedItems);
    }

    // Add a new blank custom form field
    function addCustomField() {
        setCustomFormFields([
            ...customFormFields,
            { label: "", fieldType: "text", options: [], required: false },
        ]);
    }

    // Add a new blank merchandise item (dropdown-style with options)
    function addMerchandiseItem() {
        setMerchandiseItems([
            ...merchandiseItems,
            { itemName: "", required: false, options: [] },
        ]);
    }

    // Split a comma-separated string into a trimmed array
    function splitCommas(text) {
        return text.split(",").map((item) => item.trim()).filter(Boolean);
    }

    // Validation error state
    const [validationError, setValidationError] = useState("");

    // Validate the form data and return error message or empty string
    function validateForm() {
        if (!name.trim()) return "Event name is required";
        if (!description.trim()) return "Event description is required";

        // Check fields are non-empty before parsing
        if (!startDate) return "Start date is required";
        if (!endDate) return "End date is required";

        const start = new Date(startDate);
        const end = new Date(endDate);
        const now = new Date();

        // Guard against invalid date values (e.g. empty string → NaN)
        if (isNaN(start.getTime())) return "Start date is invalid";
        if (isNaN(end.getTime())) return "End date is invalid";

        if (end <= start) {
            return "End date must be after start date";
        }
        // Only validate future dates for new events
        if (!isEditMode && start <= now) {
            return "Event start date must be in the future";
        }
        if (Number(registrationLimit) < 1) {
            return "Registration limit must be at least 1";
        }
        // In edit mode for a locked event, limit can only stay the same or increase
        if (isLocked && Number(registrationLimit) < initialData.registrationLimit) {
            return `Registration limit cannot be decreased below the current limit (${initialData.registrationLimit})`;
        }
        if (Number(registrationFee) < 0) {
            return "Registration fee cannot be negative";
        }

        // For merchandise events, at least one item is required
        if (eventType === "merchandise" && merchandiseItems.length === 0) {
            return "Add at least one merchandise item";
        }
        // Each merchandise item must have a name and at least one option with thorough validation
        for (let i = 0; i < merchandiseItems.length; i++) {
            const item = merchandiseItems[i];
            const itemLabel = item.itemName?.trim() || `Item #${i + 1}`;
            if (!item.itemName?.trim()) return `${itemLabel}: Item name is required`;
            if (!item.options || item.options.length === 0) {
                return `"${itemLabel}": Must have at least one option/variant`;
            }
            const seenLabels = new Set();
            for (let j = 0; j < item.options.length; j++) {
                const opt = item.options[j];
                const optLabel = opt.label?.trim() || `Option #${j + 1}`;
                if (!opt.label?.trim()) return `"${itemLabel}" → ${optLabel}: Option label is required`;
                if (seenLabels.has(opt.label.trim().toLowerCase())) {
                    return `"${itemLabel}": Duplicate option label "${opt.label.trim()}"`;
                }
                seenLabels.add(opt.label.trim().toLowerCase());
                const price = Number(opt.price);
                const stock = Number(opt.stock);
                if (isNaN(price) || price < 0) return `"${itemLabel}" → "${optLabel}": Price must be ≥ 0`;
                if (isNaN(stock) || stock < 0) return `"${itemLabel}" → "${optLabel}": Stock must be ≥ 0`;
                if (!Number.isInteger(stock)) return `"${itemLabel}" → "${optLabel}": Stock must be a whole number`;
            }
        }

        // Each custom form field must have a label
        for (const field of customFormFields) {
            if (!field.label.trim()) return "All custom form fields must have a label";
            if ((field.fieldType === "dropdown" || field.fieldType === "checkbox") && field.options.length === 0) {
                return `Field "${field.label || "unnamed"}" must have at least one option`;
            }
        }

        return "";
    }

    // Build the event body and submit
    function handleSubmit(event) {
        event.preventDefault();

        // Run validation
        const error = validateForm();
        if (error) {
            setValidationError(error);
            return;
        }
        setValidationError("");

        const body = {
            name,
            description,
            eventType,
            startDate,
            endDate,
            eligibility,
            registrationLimit: Number(registrationLimit),
            registrationFee: Number(registrationFee),
            tags: splitCommas(tags),
            status,
        };

        // Attach custom form fields for normal events
        // Only include in the payload when no registrations exist
        if (eventType === "normal" && !hasRegistrations) {
            const orderedFields = customFormFields.map((field, index) => ({
                ...field,
                order: index,
            }));
            body.customForm = orderedFields;
        }

        // Attach merchandise items for merchandise events
        // Only include in the payload when no registrations exist
        if (eventType === "merchandise" && !hasRegistrations) {
            const processedItems = merchandiseItems.map((item, index) => ({
                itemName: item.itemName,
                required: item.required || false,
                order: index,
                options: (item.options || []).map((opt) => ({
                    label: opt.label,
                    price: Number(opt.price) || 0,
                    stock: Number(opt.stock) || 0,
                })),
            }));
            body.merchandiseItems = processedItems;
        }

        onSubmit(body);
    }

    return (
        <form onSubmit={handleSubmit} className="card" style={{ marginBottom: 14 }}>
            {validationError && (
                <div className="msg msg-error" style={{ marginBottom: 15 }}>
                    <strong>Validation Error:</strong> {validationError}
                </div>
            )}
            {isEditMode && isLocked && (
                <div className="msg msg-error" style={{ marginBottom: 15 }}>
                    <strong>Note:</strong> Event is <em>{liveStatus}</em>.
                    {isPublished && " You can update description, increase limit, and edit tags."}
                    {isOngoing && " You can mark the event as completed."}
                    {isCompleted && " No further edits are allowed."}
                </div>
            )}

            {/* ── Core fields ── */}
            <FormField label="Event Name" required>
                <input className="form-input" value={name} onChange={(event) => setName(event.target.value)} disabled={isLocked} required />
            </FormField>
            <FormField label="Description" required>
                <textarea className="form-input form-textarea" value={description} onChange={(event) => setDescription(event.target.value)} disabled={isOngoing || isCompleted} required placeholder="Describe the event…" />
            </FormField>
            <FormField label="Event Type" required>
                <select className="form-input" value={eventType} onChange={(event) => setEventType(event.target.value)} disabled={isLocked}>
                    <option value="normal">Normal</option>
                    <option value="merchandise">Merchandise</option>
                </select>
            </FormField>
            <FormField label="Eligibility" required>
                <select className="form-input" value={eligibility} onChange={(event) => setEligibility(event.target.value)} disabled={isLocked}>
                    <option value="all">All</option>
                    <option value="iiit">IIIT</option>
                    <option value="non-iiit">Non-IIIT</option>
                </select>
            </FormField>
            <FormField label="Start Date & Time" required>
                <DateTimeInput
                    value={startDate}
                    onChange={(val) => setStartDate(val)}
                    disabled={isLocked}
                    required
                />
            </FormField>
            <FormField label="End Date & Time" required>
                <DateTimeInput
                    value={endDate}
                    onChange={(val) => setEndDate(val)}
                    disabled={isLocked}
                    required
                />
            </FormField>
            <FormField
                label="Registration Limit"
                hint={isLocked ? `Cannot decrease (current: ${initialData.registrationLimit})` : undefined}
            >
                <input
                    className="form-input"
                    type="number"
                    min={isLocked ? initialData.registrationLimit : 1}
                    value={registrationLimit}
                    onChange={(event) => setRegistrationLimit(event.target.value)}
                    disabled={isOngoing || isCompleted}
                />
            </FormField>
            <FormField label="Registration Fee (₹)" hint="Set to 0 for free events">
                <input className="form-input" type="number" min="0" value={registrationFee} onChange={(event) => setRegistrationFee(event.target.value)} disabled={isLocked} />
            </FormField>
            <FormField label="Tags" hint="Comma-separated. Use interest categories for better discoverability: Technical, Cultural, Sports, Music, Art, Gaming, Academic, Social, Workshop, Hackathon">
                <input className="form-input" value={tags} onChange={(event) => setTags(event.target.value)} disabled={isOngoing || isCompleted} placeholder="tech, coding, workshop" />
            </FormField>

            {/* Custom Form Fields Builder (normal events — editable until first registration) */}
            {eventType === "normal" && (
                <div className="section">
                    <h4>Custom Form Fields {hasRegistrations && <span className="muted">(locked — registrations exist)</span>}</h4>
                    {customFormFields.map((field, index) => (
                        <div key={index} className="form-builder-field">
                            <input
                                placeholder="Label"
                                value={field.label}
                                onChange={(event) => updateCustomField(index, "label", event.target.value)}
                                disabled={hasRegistrations}
                            />
                            <select
                                value={field.fieldType}
                                onChange={(event) => updateCustomField(index, "fieldType", event.target.value)}
                                disabled={hasRegistrations}
                            >
                                <option value="text">Text</option>
                                <option value="textarea">Textarea</option>
                                <option value="dropdown">Dropdown</option>
                                <option value="checkbox">Checkbox</option>
                                <option value="file">File Upload</option>
                            </select>
                            {(field.fieldType === "dropdown" || field.fieldType === "checkbox") && (
                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                    {field.options.map((opt, optIdx) => (
                                        <div key={optIdx} style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                            <input
                                                style={{ margin: 0 }}
                                                placeholder={`Option ${optIdx + 1}`}
                                                value={opt}
                                                disabled={hasRegistrations}
                                                onChange={(e) => {
                                                    const newOpts = [...field.options];
                                                    newOpts[optIdx] = e.target.value;
                                                    updateCustomField(index, "options", newOpts);
                                                }}
                                            />
                                            {!hasRegistrations && (
                                                <button type="button" className="btn-danger-sm" onClick={() => {
                                                    const newOpts = field.options.filter((_, i) => i !== optIdx);
                                                    updateCustomField(index, "options", newOpts);
                                                }}>x</button>
                                            )}
                                        </div>
                                    ))}
                                    {!hasRegistrations && (
                                        <button type="button" className="btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => {
                                            updateCustomField(index, "options", [...field.options, ""]);
                                        }}>+ Option</button>
                                    )}
                                </div>
                            )}
                            <button type="button"
                                className={!field.required ? "chip chip-active" : "chip"}
                                style={!field.required ? { background: "brown", borderColor: "brown" } : {}}
                                onClick={() => updateCustomField(index, "required", false)}
                                disabled={hasRegistrations}
                            >Optional</button>
                            <button type="button"
                                className={field.required ? "chip chip-active" : "chip"}
                                style={field.required ? { background: "brown", borderColor: "brown" } : {}}
                                onClick={() => updateCustomField(index, "required", true)}
                                disabled={hasRegistrations}
                            >Required</button>
                            {/* Reorder buttons */}
                            <button type="button" disabled={hasRegistrations || index === 0}
                                onClick={() => {
                                    const updated = [...customFormFields];
                                    const temp = updated[index - 1];
                                    updated[index - 1] = updated[index];
                                    updated[index] = temp;
                                    setCustomFormFields(updated);
                                }}>↑</button>
                            <button type="button" disabled={hasRegistrations || index === customFormFields.length - 1}
                                onClick={() => {
                                    const updated = [...customFormFields];
                                    const temp = updated[index + 1];
                                    updated[index + 1] = updated[index];
                                    updated[index] = temp;
                                    setCustomFormFields(updated);
                                }}>↓</button>
                            <button type="button" className="btn-danger-sm" onClick={() => removeCustomField(index)} disabled={hasRegistrations}>Delete</button>
                        </div>
                    ))}
                    {!hasRegistrations && <button type="button" className="btn-secondary" onClick={addCustomField}>+ Field</button>}
                </div>
            )}

            {/* Merchandise Items Builder (dropdown-style with options) */}
            {eventType === "merchandise" && (
                <div className="section">
                    <h4>Merchandise Items {hasRegistrations && <span className="muted">(locked — registrations exist)</span>}</h4>
                    <p className="form-hint" style={{ marginBottom: 10 }}>
                        Each item acts as a dropdown for participants. Add options (variants) with their own price and stock.
                    </p>
                    {merchandiseItems.map((item, index) => {
                        const totalStock = (item.options || []).reduce((s, o) => s + (Number(o.stock) || 0), 0);
                        const allSoldOut = item.options?.length > 0 && totalStock === 0;
                        return (
                            <div key={index} className={`merch-builder-card${allSoldOut ? " merch-all-sold-out" : ""}`}>
                                {/* Item header row */}
                                <div className="merch-builder-header">
                                    <span className="merch-item-number">#{index + 1}</span>
                                    <input
                                        placeholder="Item name (e.g. T-Shirt, Hoodie)"
                                        value={item.itemName}
                                        onChange={(e) => updateMerchandiseItem(index, "itemName", e.target.value)}
                                        disabled={hasRegistrations}
                                    />
                                    <button type="button"
                                        className={!item.required ? "chip chip-active" : "chip"}
                                        style={!item.required ? { background: "brown", borderColor: "brown" } : {}}
                                        onClick={() => updateMerchandiseItem(index, "required", false)}
                                        disabled={hasRegistrations}
                                    >Optional</button>
                                    <button type="button"
                                        className={item.required ? "chip chip-active" : "chip"}
                                        style={item.required ? { background: "brown", borderColor: "brown" } : {}}
                                        onClick={() => updateMerchandiseItem(index, "required", true)}
                                        disabled={hasRegistrations}
                                    >Required</button>
                                    <button type="button" disabled={hasRegistrations || index === 0}
                                        onClick={() => {
                                            const updated = [...merchandiseItems];
                                            [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
                                            setMerchandiseItems(updated);
                                        }}>↑</button>
                                    <button type="button" disabled={hasRegistrations || index === merchandiseItems.length - 1}
                                        onClick={() => {
                                            const updated = [...merchandiseItems];
                                            [updated[index + 1], updated[index]] = [updated[index], updated[index + 1]];
                                            setMerchandiseItems(updated);
                                        }}>↓</button>
                                    <button type="button" className="btn-danger-sm" onClick={() => removeMerchandiseItem(index)} disabled={hasRegistrations}>Delete</button>
                                </div>

                                {allSoldOut && (
                                    <p className="merch-selector-sold-out-msg" style={{ marginBottom: 6 }}>⚠ All options sold out</p>
                                )}

                                {/* Options list with column headers */}
                                <div className="merch-options-list">
                                    {(item.options || []).length > 0 && (
                                        <div className="merch-option-header">
                                            <span>Option Label</span>
                                            <span>Price (₹)</span>
                                            <span>Stock</span>
                                            <span></span>
                                        </div>
                                    )}
                                    {(item.options || []).map((opt, optIdx) => {
                                        const optStock = Number(opt.stock) || 0;
                                        const isSoldOut = optStock === 0;
                                        const isLowStock = optStock > 0 && optStock <= 5;
                                        return (
                                            <div key={optIdx} className={`merch-option-row${isSoldOut ? " merch-option-sold-out" : ""}`}>
                                                <input
                                                    placeholder={`e.g. Red - M, Blue - L`}
                                                    value={opt.label || ""}
                                                    disabled={hasRegistrations}
                                                    onChange={(e) => {
                                                        const newOpts = [...(item.options || [])];
                                                        newOpts[optIdx] = { ...newOpts[optIdx], label: e.target.value };
                                                        updateMerchandiseItem(index, "options", newOpts);
                                                    }}
                                                />
                                                <input
                                                    type="number"
                                                    placeholder="0"
                                                    min="0"
                                                    step="1"
                                                    value={opt.price ?? 0}
                                                    disabled={hasRegistrations}
                                                    onChange={(e) => {
                                                        const newOpts = [...(item.options || [])];
                                                        newOpts[optIdx] = { ...newOpts[optIdx], price: e.target.value };
                                                        updateMerchandiseItem(index, "options", newOpts);
                                                    }}
                                                />
                                                <input
                                                    type="number"
                                                    placeholder="0"
                                                    min="0"
                                                    step="1"
                                                    value={opt.stock ?? 0}
                                                    disabled={hasRegistrations}
                                                    onChange={(e) => {
                                                        const newOpts = [...(item.options || [])];
                                                        newOpts[optIdx] = { ...newOpts[optIdx], stock: e.target.value };
                                                        updateMerchandiseItem(index, "options", newOpts);
                                                    }}
                                                />
                                                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                                    {isSoldOut && <span className="stock-badge stock-badge-out">Sold out</span>}
                                                    {isLowStock && <span className="stock-badge stock-badge-low">Low</span>}
                                                    {!isSoldOut && !isLowStock && optStock > 0 && <span className="stock-badge stock-badge-ok">{optStock} left</span>}
                                                    {!hasRegistrations && (
                                                        <button type="button" className="btn-danger-sm" onClick={() => {
                                                            const newOpts = (item.options || []).filter((_, i) => i !== optIdx);
                                                            updateMerchandiseItem(index, "options", newOpts);
                                                        }}>×</button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {!hasRegistrations && (
                                        <button type="button" className="btn-sm" style={{ marginTop: 6 }} onClick={() => {
                                            const newOpts = [...(item.options || []), { label: "", price: 0, stock: 10 }];
                                            updateMerchandiseItem(index, "options", newOpts);
                                        }}>+ Add Option</button>
                                    )}
                                </div>


                            </div>
                        );
                    })}
                    {!hasRegistrations && <button type="button" className="btn-secondary" onClick={addMerchandiseItem}>+ Add Merchandise Item</button>}
                </div>
            )}

            <div className="btn-row" style={{ marginTop: 10 }}>
                {/* Completed events: no save button */}
                {!isCompleted && (
                    <button type="submit" className="btn-accent">{isEditMode ? "Save Changes" : "Create (Draft)"}</button>
                )}
                <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
            </div>
        </form>
    );
}
