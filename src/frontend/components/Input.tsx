import React from 'react';

type InputProps = {
  label?: string;
  type?: string;
  value?: string | number;
  placeholder?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  textarea?: boolean;
  name?: string;
  error?: boolean;
};

export default function Input({ label, type = 'text', value, placeholder, onChange, textarea, name, error }: InputProps) {
  const errStyle = error ? { border: '1px solid #e11d48', boxShadow: '0 0 0 2px rgba(225,29,72,0.15)' } as React.CSSProperties : undefined;
  return (
    <div className="stack">
      {label && <div className="label" style={error ? { color: '#e11d48' } : undefined}>{label}</div>}
      {textarea ? (
        <textarea className="textarea" placeholder={placeholder} value={value as string} onChange={onChange} name={name} style={errStyle} />
      ) : (
        <input className="input" type={type} placeholder={placeholder} value={value as any} onChange={onChange} name={name} style={errStyle} />
      )}
    </div>
  );
}