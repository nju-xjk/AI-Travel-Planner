import React from 'react';

type InputProps = {
  label?: string;
  type?: string;
  value?: string | number;
  placeholder?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  textarea?: boolean;
  name?: string;
};

export default function Input({ label, type = 'text', value, placeholder, onChange, textarea, name }: InputProps) {
  return (
    <div className="stack">
      {label && <div className="label">{label}</div>}
      {textarea ? (
        <textarea className="textarea" placeholder={placeholder} value={value as string} onChange={onChange} name={name} />
      ) : (
        <input className="input" type={type} placeholder={placeholder} value={value as any} onChange={onChange} name={name} />
      )}
    </div>
  );
}