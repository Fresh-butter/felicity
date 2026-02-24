import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function useApi() {
    const { token, logout } = useContext(AuthContext);

    // Build headers - add auth token if logged in, content-type if sending JSON
    function getHeaders(isJson) {
        const headers = {};
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
        if (isJson) {
            headers["Content-Type"] = "application/json";
        }
        return headers;
    }

    // Handle 401 responses by logging out (token expired or invalid)
    function handleUnauthorized(response) {
        if (response.status === 401 && token) {
            logout();
        }
    }

    // GET request - returns data directly, or null on error
    async function get(path) {
        const response = await fetch(`${BASE}${path}`, {
            headers: getHeaders(false),
        });
        if (!response.ok) {
            handleUnauthorized(response);
            return null;
        }
        return await response.json();
    }

    // POST request - returns { ok, data }
    async function post(path, body) {
        const response = await fetch(`${BASE}${path}`, {
            method: "POST",
            headers: getHeaders(true),
            body: JSON.stringify(body),
        });
        handleUnauthorized(response);
        const data = await response.json();
        return { ok: response.ok, data };
    }

    // PUT request - returns { ok, data }
    async function put(path, body) {
        const response = await fetch(`${BASE}${path}`, {
            method: "PUT",
            headers: getHeaders(true),
            body: JSON.stringify(body),
        });
        handleUnauthorized(response);
        const data = await response.json();
        return { ok: response.ok, data };
    }

    // PATCH request - returns { ok, data }
    async function patch(path, body) {
        const response = await fetch(`${BASE}${path}`, {
            method: "PATCH",
            headers: getHeaders(true),
            body: JSON.stringify(body || {}),
        });
        handleUnauthorized(response);
        const data = await response.json();
        return { ok: response.ok, data };
    }

    // DELETE request - returns { ok }
    async function del(path) {
        const response = await fetch(`${BASE}${path}`, {
            method: "DELETE",
            headers: getHeaders(false),
        });
        handleUnauthorized(response);
        return { ok: response.ok };
    }

    // GET request that returns a file blob (for CSV export)
    async function getBlob(path) {
        const response = await fetch(`${BASE}${path}`, {
            headers: getHeaders(false),
        });
        if (!response.ok) {
            handleUnauthorized(response);
            return null;
        }
        return await response.blob();
    }

    return { get, post, put, patch, del, getBlob };
}
