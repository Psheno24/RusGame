export const ADMIN_CAR3D_EDIT_STYLES = `
.admin-car3d-edit { gap: 24px; }
.admin-car3d-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
}
.admin-car3d-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: nowrap;
}
.admin-car3d-section__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.3;
  flex: 1 1 auto;
  min-width: 0;
}
.admin-car3d-section__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: auto;
  min-width: 96px;
  min-height: 36px;
  padding: 6px 14px;
  margin-top: 0;
  font-size: 0.85rem;
  font-weight: 600;
  flex: 0 0 auto;
  white-space: nowrap;
}
.admin-car3d-tuning {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.admin-car3d-slider {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.88rem;
  line-height: 1.35;
}
.admin-car3d-slider .slider-with-number__label {
  color: var(--text);
}
.admin-car3d-slider input:disabled { opacity: 0.45; }
.admin-car3d-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.88rem;
  line-height: 1.35;
  color: var(--text);
  cursor: pointer;
}
.admin-car3d-checkbox input:disabled { opacity: 0.45; cursor: not-allowed; }
.admin-car3d-card-preview {
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--bg-card);
}
.admin-car3d-card-preview__title {
  margin: 0;
  padding: 10px 12px;
  font-size: 0.95rem;
  font-weight: 600;
  text-align: center;
}
.admin-car3d-json__pre {
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-card);
  font-size: 0.78rem;
  line-height: 1.45;
  overflow-x: auto;
  white-space: pre;
}
`;
