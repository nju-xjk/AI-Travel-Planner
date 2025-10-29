import React from 'react';

type CardProps = {
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export default function Card({ title, children, footer }: CardProps) {
  return (
    <div className="card">
      {title && <h2>{title}</h2>}
      <div>{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
}