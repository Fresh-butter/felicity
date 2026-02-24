// cloudinaryUpload.js — Upload a file to Cloudinary and return the secure URL
// Uses unsigned upload preset (no backend needed)

// How to set these values:
// 1. Create a free account at https://cloudinary.com
// 2. Go to Settings → Upload → Add unsigned upload preset
// 3. Create a file called .env in the frontend/ folder with:
//    VITE_CLOUD_NAME=your_cloud_name
//    VITE_UPLOAD_PRESET=your_upload_preset
// Vite automatically exposes env variables prefixed with VITE_

const CLOUD_NAME = import.meta.env.VITE_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_UPLOAD_PRESET;

export default async function cloudinaryUpload(file) {
    // Cloudinary's upload endpoint
    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`;

    // Build the form data with the file and upload preset
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    // Send the file to Cloudinary
    const response = await fetch(url, {
        method: "POST",
        body: formData,
    });

    // Parse the response
    const data = await response.json();

    // Return the secure URL if upload succeeded
    if (data.secure_url) {
        return data.secure_url;
    }

    // Otherwise throw an error
    throw new Error("Upload failed: " + (data.error?.message || "Unknown error"));
}
