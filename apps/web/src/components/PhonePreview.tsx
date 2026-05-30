import type { CSSProperties } from "react";

export type PhonePreviewProps = {
  brand: string;
  model: string;
  accent: string;
};

export function PhonePreview({ brand, model, accent }: PhonePreviewProps) {
  return (
    <div className="phone-preview" style={{ "--phone-accent": accent } as CSSProperties}>
      <div className="phone-preview-body">
        <div className="phone-preview-island" />
        <div className="phone-preview-screen">
          <span className="phone-preview-brand">{brand}</span>
          <span className="phone-preview-model">{model}</span>
        </div>
      </div>
    </div>
  );
}
