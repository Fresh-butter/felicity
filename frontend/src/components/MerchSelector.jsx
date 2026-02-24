// MerchSelector.jsx — Renders a single merchandise item as a dropdown
// Each item is like a form field: user picks one option from a dropdown.
// Each option shows label, price, and stock. Items can be required or optional.
// If ALL options are out of stock, the item is shown as "Sold Out" with the dropdown disabled.

export default function MerchSelector({ item, selectedOptionId, onChange }) {
    const allSoldOut = item.options.every((opt) => opt.stock <= 0);

    return (
        <div className={`merch-selector-card${allSoldOut ? " merch-selector-sold-out" : ""}`}>
            <div className="merch-selector-label">
                {item.itemName}
                {item.required && <span className="form-required"> *</span>}
                {allSoldOut && <span className="stock-badge stock-badge-out" style={{ marginLeft: 8 }}>Sold Out</span>}
            </div>

            {allSoldOut ? (
                <div>
                    <select className="form-input" disabled>
                        <option>— All options sold out —</option>
                    </select>
                    {item.required && (
                        <p className="merch-selector-sold-out-msg">
                            This item is required but all options are sold out. Registration is unavailable.
                        </p>
                    )}
                </div>
            ) : (
                <select
                    className="form-input"
                    value={selectedOptionId || ""}
                    onChange={(e) => onChange(item._id, e.target.value)}
                >
                    <option value="">— {item.required ? "Select an option" : "Skip (optional)"} —</option>
                    {item.options.map((opt) => {
                        const soldOut = opt.stock <= 0;
                        const lowStock = opt.stock > 0 && opt.stock <= 5;
                        return (
                            <option
                                key={opt._id}
                                value={opt._id}
                                disabled={soldOut}
                            >
                                {opt.label} — ₹{opt.price}
                                {soldOut ? " (Out of stock)" : lowStock ? ` (Only ${opt.stock} left!)` : ` (${opt.stock} available)`}
                            </option>
                        );
                    })}
                </select>
            )}
        </div>
    );
}
