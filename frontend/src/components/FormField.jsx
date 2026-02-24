// FormField.jsx — Reusable labeled form field wrapper

export default function FormField({ label, children, hint, required }) {
    return (
        <div className="form-group">
            <label className="form-label">
                {label}
                {required && <span className="form-required"> *</span>}
            </label>
            {hint && <span className="form-hint">{hint}</span>}
            <div className="form-control-wrap">{children}</div>
        </div>
    );
}
