// AdminOrganizers.jsx — Admin page for creating and managing organizer accounts

import { useState, useEffect } from "react";
import useApi from "../hooks/useApi";
import FormField from "../components/FormField";

export default function AdminOrganizers() {
  const api = useApi();
  const [organizers, setOrganizers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [credentials, setCredentials] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  // Individual state for each form field
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");

  useEffect(() => {
    loadOrganizers();
  }, []);

  function loadOrganizers() {
    api.get("/admin/organizers").then((data) => {
      if (data) setOrganizers(data);
    });
  }

  // Create a new organizer
  async function handleCreateOrganizer(event) {
    event.preventDefault();

    const newOrganizerData = {
      name: newName,
      category: newCategory,
      description: newDescription,
      contactEmail: newContactEmail,
    };

    const { ok, data } = await api.post("/admin/organizers", newOrganizerData);

    if (ok) {
      setCredentials({ email: data.loginEmail, password: data.password });
      setShowForm(false);
      loadOrganizers();
    } else {
      setErrorMessage(data.message);
    }
  }

  // Toggle organizer active/inactive status
  async function handleToggleStatus(organizerId) {
    await api.patch(`/admin/organizers/${organizerId}/toggle`);
    loadOrganizers();
  }

  // Toggle organizer archive/unarchive status
  async function handleToggleArchive(organizerId) {
    await api.patch(`/admin/organizers/${organizerId}/archive`);
    loadOrganizers();
  }

  // Delete an organizer and all their events
  async function handleDeleteOrganizer(organizerId) {
    if (confirm("Delete organizer and all events?")) {
      await api.del(`/admin/organizers/${organizerId}`);
      loadOrganizers();
    }
  }

  const activeOrganizers = organizers.filter((o) => !o.isArchived);
  const archivedOrganizers = organizers.filter((o) => o.isArchived);

  return (
    <div className="page-container">
      <h2>Manage Clubs</h2>
      {errorMessage && <p className="msg msg-error">{errorMessage}</p>}

      {/* Show generated credentials after creating an organizer */}
      {credentials && (
        <div className="card msg-success" style={{ marginBottom: 10 }}>
          <p><strong>Email:</strong> {credentials.email} | <strong>Password:</strong> {credentials.password}</p>
          <button className="btn-secondary" onClick={() => setCredentials(null)}>Dismiss</button>
        </div>
      )}

      <button className="btn-accent" onClick={() => setShowForm(!showForm)} style={{ marginBottom: 20 }}>
        {showForm ? "Cancel" : "Create Organizer"}
      </button>

      {/* Create organizer form */}
      {showForm && (
        <form onSubmit={handleCreateOrganizer} className="card" style={{ marginBottom: 24 }}>
          <FormField label="Name">
            <input value={newName} onChange={(event) => setNewName(event.target.value)} required />
          </FormField>
          <FormField label="Category">
            <input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} required />
          </FormField>
          <FormField label="Description">
            <textarea value={newDescription} onChange={(event) => setNewDescription(event.target.value)} />
          </FormField>
          <FormField label="Contact Email">
            <input type="email" value={newContactEmail} onChange={(event) => setNewContactEmail(event.target.value)} required />
          </FormField>
          <button type="submit" className="btn-accent">Create</button>
        </form>
      )}

      <h3>Active / Disabled Organizers</h3>
      <table className="data-table" style={{ marginBottom: 30 }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Email</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {activeOrganizers.length === 0 && (
            <tr><td colSpan="5" className="muted" style={{ textAlign: "center" }}>No active or disabled organizers.</td></tr>
          )}
          {activeOrganizers.map((organizer) => (
            <tr key={organizer.id}>
              <td>{organizer.name}</td>
              <td>{organizer.category}</td>
              <td>{organizer.loginEmail}</td>
              <td>
                <span className={`badge ${organizer.isActive ? "badge-published" : "badge-closed"}`}>
                  {organizer.isActive ? "Active" : "Disabled"}
                </span>
              </td>
              <td className="action-cell">
                <button className="btn-sm" onClick={() => handleToggleStatus(organizer.id)} style={{ marginRight: 6 }}>
                  {organizer.isActive ? "Disable" : "Enable"}
                </button>
                <button className="btn-sm" onClick={() => handleToggleArchive(organizer.id)} style={{ marginRight: 6 }}>
                  Archive
                </button>
                <button className="btn-sm btn-danger" onClick={() => handleDeleteOrganizer(organizer.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {archivedOrganizers.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Archived Organizers ({archivedOrganizers.length})</h3>
            <button className="btn-sm btn-secondary" onClick={() => setShowArchived(!showArchived)}>
              {showArchived ? "Hide Archive" : "Show Archive"}
            </button>
          </div>

          {showArchived && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {archivedOrganizers.map((organizer) => (
                  <tr key={organizer.id}>
                    <td>{organizer.name}</td>
                    <td>{organizer.category}</td>
                    <td>{organizer.loginEmail}</td>
                    <td>
                      <span className={`badge ${organizer.isActive ? "badge-published" : "badge-closed"}`}>
                        {organizer.isActive ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="action-cell">
                      <button className="btn-sm" onClick={() => handleToggleStatus(organizer.id)} style={{ marginRight: 6 }}>
                        {organizer.isActive ? "Disable" : "Enable"}
                      </button>
                      <button className="btn-sm" onClick={() => handleToggleArchive(organizer.id)} style={{ marginRight: 6 }}>
                        Unarchive
                      </button>
                      <button className="btn-sm btn-danger" onClick={() => handleDeleteOrganizer(organizer.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
