import React, { useState } from "react";
import { useTranslation } from "../../context/TranslationContext";
import "./VideoUpload.css";

interface VideoUploadProps {
  onUpload: (title: string, file: File) => void;
}

export default function VideoUpload({ onUpload }: VideoUploadProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title && file) {
      onUpload(title, file);
      setTitle("");
      setFile(null);
      // Reset file input
      const fileInput = document.getElementById("video-file") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  return (
    <div className="video-upload">
      <form onSubmit={handleSubmit}>
        <input
          id="video-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("upload.title")}
          className="upload-title-input"
          required
        />
        <div className="upload-row">
          <label htmlFor="video-file" className="file-label">
            {file ? file.name : t("upload.chooseFile")}
          </label>
          <input
            id="video-file"
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="file-input"
            required
          />
          <button type="submit" className="upload-button" disabled={!title || !file}>
            {t("upload.button")}
          </button>
        </div>
      </form>
    </div>
  );
}
