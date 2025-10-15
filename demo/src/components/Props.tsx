import React from "react";

export interface User {
  id: string;
  name: string;
  email: string;
}

export enum Status {
  Active = "active",
  Inactive = "inactive",
  Pending = "pending",
}

export enum Priority {
  Low = 0,
  Medium = 1,
  High = 2,
}

export interface PropsTestProps {
  // Primitive types
  title: string;
  count: number;
  isEnabled: boolean;

  // Complex types
  user: User;
  tags: string[];

  // Enums
  status: Status;
  priority: Priority;

  // Functions
  onClick: () => void;
}

export default function Props({
  title,
  count,
  isEnabled,
  user,
  tags,
  status,
  priority,
  onClick,
}: PropsTestProps) {
  return (
    <div className="props-test-page">
      <h1>Props Test Page</h1>

      <section className="prop-section">
        <h2>String Props</h2>
        <div className="prop-display">
          <strong>title:</strong> {title}
        </div>
      </section>

      <section className="prop-section">
        <h2>Number Props</h2>
        <div className="prop-display">
          <strong>count:</strong> {count}
        </div>
      </section>

      <section className="prop-section">
        <h2>Boolean Props</h2>
        <div className="prop-display">
          <strong>isEnabled:</strong> {isEnabled ? "✓ true" : "✗ false"}
        </div>
      </section>

      <section className="prop-section">
        <h2>Object Props</h2>
        <div className="prop-display">
          <strong>user:</strong>
          <pre>{JSON.stringify(user, null, 2)}</pre>
        </div>
      </section>

      <section className="prop-section">
        <h2>Array Props</h2>
        <div className="prop-display">
          <strong>tags:</strong>
          <ul>
            {tags.map((tag, i) => (
              <li key={i}>{tag}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="prop-section">
        <h2>Enum Props</h2>
        <div className="prop-display">
          <strong>status (string enum):</strong> {status}
        </div>
        <div className="prop-display">
          <strong>priority (numeric enum):</strong> {priority}
        </div>
      </section>

      <section className="prop-section">
        <h2>Function Props</h2>
        <div className="prop-display">
          <button onClick={onClick} className="test-button">
            Test onClick
          </button>
        </div>
      </section>

      <style>{`
        .props-test-page {
          padding: 24px;
          max-width: 800px;
        }

        .props-test-page h1 {
          margin-bottom: 32px;
          color: #e0e0e0;
        }

        .prop-section {
          margin-bottom: 32px;
          padding: 16px;
          background: #242424;
          border-radius: 8px;
        }

        .prop-section h2 {
          margin-top: 0;
          margin-bottom: 16px;
          font-size: 18px;
          color: #4a90e2;
        }

        .prop-display {
          margin-bottom: 12px;
          font-size: 14px;
          color: #e0e0e0;
        }

        .prop-display strong {
          color: #999;
          margin-right: 8px;
        }

        .prop-display pre {
          background: #1a1a1a;
          padding: 12px;
          border-radius: 4px;
          margin-top: 8px;
          overflow-x: auto;
        }

        .prop-display ul {
          margin: 8px 0;
          padding-left: 20px;
        }

        .prop-display li {
          margin: 4px 0;
        }

        .test-button {
          background: #4a90e2;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .test-button:hover {
          background: #357abd;
        }
      `}</style>
    </div>
  );
}
